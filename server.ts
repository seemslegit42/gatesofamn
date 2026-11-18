import http from 'node:http';
import { parse } from 'node:url';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import type {
  ChatMessage,
  ClientMessage,
  ServerMessage,
  WorldSnapshot,
} from './lib/game/types.ts';
import {
  createSimWorld,
  equipInventoryItem,
  executePlayerSkill,
  stepSimWorld,
  triggerPlayerDash,
  usePlayerPotion,
} from './lib/game/simulation.ts';
import { getSpawnPoint, groundHeightAt } from './lib/game/worldData.ts';
import {
  appendChatMessage,
  getDbMode,
  initDatabase,
  loadOrCreatePlayer,
  loadRecentChat,
  loadWorldShrines,
  savePlayerState,
  saveWorldShrine,
} from './lib/db/turso.ts';

const dev = process.env.NODE_ENV !== 'production';
const port = Number(
  process.env.APPLET_PORT ||
    (process.env.PORT && process.env.PORT !== '8080' ? process.env.PORT : 3000),
);
const hostname = '0.0.0.0';

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

interface ClientConn {
  ws: WebSocket;
  playerId: string | null;
}

async function startServer() {
  await app.prepare();
  await initDatabase();

  const initialShrines = await loadWorldShrines();
  const world = createSimWorld(initialShrines);
  const clients = new Set<ClientConn>();
  const socketByPlayer = new Map<string, WebSocket>();

  const sendToSocket = (ws: WebSocket, msg: ServerMessage) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  };

  const broadcastMessage = (msg: ServerMessage) => {
    const raw = JSON.stringify(msg);
    for (const c of clients) {
      if (c.ws.readyState === WebSocket.OPEN) {
        c.ws.send(raw);
      }
    }
  };

  world.onPersistPlayer = (player) => {
    savePlayerState(player).catch((err) => {
      console.error('Failed to persist player state to libSQL:', err);
    });
    const ws = socketByPlayer.get(player.id);
    if (ws) {
      sendToSocket(ws, { type: 'inventory', items: player.inventory });
    }
  };

  world.onPersistShrine = (shrine) => {
    saveWorldShrine(shrine).catch((err) => {
      console.error('Failed to persist shrine state to libSQL:', err);
    });
  };

  world.onWorldAnnouncement = (text) => {
    const msg: ChatMessage = {
      id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sender: 'Solis Beacon',
      heroClass: 'system',
      text,
      createdAt: Date.now(),
    };
    appendChatMessage(msg).catch(() => {});
    broadcastMessage({ type: 'chat', message: msg });
  };

  const server = http.createServer((req, res) => {
    const parsedUrl = parse(req.url || '/', true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });
  wss.on('error', (err) => {
    console.error('WebSocketServer error:', err);
  });

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url || '/', true);
    if (pathname === '/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws);
      });
    } else if (!dev) {
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WebSocket) => {
    const conn: ClientConn = { ws, playerId: null };
    clients.add(conn);

    ws.on('error', (err) => {
      console.warn('WebSocket client error:', err.message);
    });

    ws.on('message', async (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(String(raw)) as ClientMessage;
      } catch {
        return;
      }

      try {
        if (msg.type === 'join') {
          const cleanId = String(msg.playerId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
          if (!cleanId) return;

          conn.playerId = cleanId;
          socketByPlayer.set(cleanId, ws);

          const spawnIdx = world.players.size;
          const player = await loadOrCreatePlayer(cleanId, msg.name, msg.heroClass, spawnIdx);
          world.players.set(cleanId, player);

          const chatHistory = await loadRecentChat(14);
          sendToSocket(ws, {
            type: 'welcome',
            playerId: cleanId,
            dbMode: getDbMode(),
            chatHistory,
            inventory: player.inventory,
          });

          const joinMsg: ChatMessage = {
            id: `join-${Date.now()}`,
            sender: 'Realm',
            heroClass: 'system',
            text: `${player.name} (${player.heroClass}) entered Solis Reach.`,
            createdAt: Date.now(),
          };
          broadcastMessage({ type: 'chat', message: joinMsg });
          return;
        }

        if (!conn.playerId) return;
        const player = world.players.get(conn.playerId);
        if (!player) return;

        if (msg.type === 'input') {
          player.input.moveX = Math.max(-1, Math.min(1, Number(msg.moveX) || 0));
          player.input.moveZ = Math.max(-1, Math.min(1, Number(msg.moveZ) || 0));
          player.input.waypointX = msg.waypointX !== null ? Number(msg.waypointX) : null;
          player.input.waypointZ = msg.waypointZ !== null ? Number(msg.waypointZ) : null;
        } else if (msg.type === 'cast') {
          if (msg.targetEnemyId !== undefined) {
            player.targetEnemyId = msg.targetEnemyId;
          }
          executePlayerSkill(world, player, msg.skillIndex, Number(msg.aimX), Number(msg.aimZ));
        } else if (msg.type === 'dash') {
          triggerPlayerDash(world, player, Number(msg.dirX), Number(msg.dirZ));
        } else if (msg.type === 'target') {
          player.targetEnemyId = msg.enemyId;
        } else if (msg.type === 'use_potion') {
          usePlayerPotion(world, player);
        } else if (msg.type === 'equip_item') {
          if (equipInventoryItem(player, msg.itemId)) {
            savePlayerState(player).catch(() => {});
          }
        } else if (msg.type === 'respawn') {
          if (!player.alive) {
            const sp = getSpawnPoint(0);
            player.alive = true;
            player.hp = player.maxHp;
            player.mana = player.maxMana;
            player.x = sp.x;
            player.z = sp.z;
            player.y = groundHeightAt(sp.x, sp.z);
            player.invulnTimer = 2.0;
            savePlayerState(player).catch(() => {});
          }
        } else if (msg.type === 'chat') {
          const cleanText = String(msg.text || '').trim().slice(0, 140);
          if (!cleanText) return;
          const chatMsg: ChatMessage = {
            id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            sender: player.name,
            heroClass: player.heroClass,
            text: cleanText,
            createdAt: Date.now(),
          };
          appendChatMessage(chatMsg).catch(() => {});
          broadcastMessage({ type: 'chat', message: chatMsg });
        }
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    });

    ws.on('close', () => {
      clients.delete(conn);
      if (conn.playerId) {
        const pid = conn.playerId;
        const player = world.players.get(pid);
        if (player) {
          savePlayerState(player).catch(() => {});
          world.players.delete(pid);
        }
        if (socketByPlayer.get(pid) === ws) {
          socketByPlayer.delete(pid);
        }
      }
    });
  });

  // Authoritative 20Hz Simulation Loop
  let lastTick = Date.now();
  let persistAccum = 0;

  const tickInterval = setInterval(() => {
    const now = Date.now();
    const dt = Math.min((now - lastTick) / 1000, 0.05);
    lastTick = now;

    if (world.players.size > 0) {
      stepSimWorld(world, dt);
    }

    persistAccum += dt;
    if (persistAccum >= 4.0) {
      persistAccum = 0;
      for (const p of world.players.values()) {
        savePlayerState(p).catch(() => {});
      }
    }

    if (clients.size === 0) return;

    const snapshot: WorldSnapshot = {
      serverTime: now,
      onlineCount: world.players.size,
      dbMode: getDbMode(),
      players: Array.from(world.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        heroClass: p.heroClass,
        level: p.level,
        xp: Math.round(p.xp),
        xpToNext: p.xpToNext,
        hp: Math.round(p.hp),
        maxHp: Math.round(p.maxHp),
        mana: Math.round(p.mana),
        maxMana: Math.round(p.maxMana),
        gold: p.gold,
        kills: p.kills,
        potions: p.potions,
        x: Number(p.x.toFixed(3)),
        z: Number(p.z.toFixed(3)),
        facing: Number(p.facing.toFixed(3)),
        cooldowns: [
          Number(p.cooldowns[0].toFixed(2)),
          Number(p.cooldowns[1].toFixed(2)),
          Number(p.cooldowns[2].toFixed(2)),
        ],
        dashCooldown: Number(p.dashCooldown.toFixed(2)),
        dashTimer: Number(p.dashTimer.toFixed(2)),
        castFlashTimer: Number(p.castFlashTimer.toFixed(2)),
        castSkillIndex: p.castSkillIndex,
        hurtTimer: Number(p.hurtTimer.toFixed(2)),
        alive: p.alive,
        targetEnemyId: p.targetEnemyId,
        waypointX: p.input.waypointX,
        waypointZ: p.input.waypointZ,
        weaponPower: p.weaponPower,
        charmPower: p.charmPower,
      })),
      enemies: world.enemies.map((e) => ({
        id: e.id,
        archetype: e.archetype,
        name: e.name,
        level: e.level,
        isBoss: e.isBoss,
        x: Number(e.x.toFixed(3)),
        z: Number(e.z.toFixed(3)),
        facing: Number(e.facing.toFixed(3)),
        hp: Math.round(e.hp),
        maxHp: Math.round(e.maxHp),
        phase: e.phase,
        phaseTimer: Number(e.phaseTimer.toFixed(2)),
        telegraphX: Number(e.telegraphX.toFixed(2)),
        telegraphZ: Number(e.telegraphZ.toFixed(2)),
        telegraphRadius: e.telegraphRadius,
        telegraphKind: e.telegraphKind,
        hurtFlash: Number(e.hurtFlash.toFixed(2)),
      })),
      shrines: world.shrines,
      loot: world.loot,
      projectiles: world.projectiles,
      events: world.events,
    };

    broadcastMessage({ type: 'snapshot', data: snapshot });
  }, 50);

  server.on('error', (err) => {
    console.error('HTTP server error:', err);
    process.exit(1);
  });

  const shutdown = () => {
    clearInterval(tickInterval);
    for (const p of world.players.values()) {
      savePlayerState(p).catch(() => {});
    }
    wss.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  server.listen(port, hostname, () => {
    console.log(`Aethergate Realm Server listening on http://${hostname}:${port} (${getDbMode()})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Aethergate server:', err);
  process.exit(1);
});
