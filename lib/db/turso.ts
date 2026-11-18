import fs from 'node:fs';
import path from 'node:path';
import { createClient, type Client } from '@libsql/client';
import type {
  ChatMessage,
  HeroClass,
  InventoryItem,
  PlayerState,
  Rarity,
  ShrineState,
} from '../game/types.ts';
import { createDefaultPlayer } from '../game/simulation.ts';
import { CLASS_SPECS, INITIAL_SHRINES, groundHeightAt } from '../game/worldData.ts';
import {
  classifyLibsqlError,
  resolveTursoConnectionConfig,
  type DbMode,
} from './tursoConfig.ts';

export type { DbMode };

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    hero_class TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    xp INTEGER NOT NULL DEFAULT 0,
    xp_to_next INTEGER NOT NULL DEFAULT 100,
    hp INTEGER NOT NULL,
    max_hp INTEGER NOT NULL,
    mana INTEGER NOT NULL,
    max_mana INTEGER NOT NULL,
    gold INTEGER NOT NULL DEFAULT 25,
    kills INTEGER NOT NULL DEFAULT 0,
    potions INTEGER NOT NULL DEFAULT 3,
    x REAL NOT NULL DEFAULT 0,
    z REAL NOT NULL DEFAULT 14,
    weapon_power INTEGER NOT NULL DEFAULT 6,
    charm_power INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS inventory_items (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL,
    item_key TEXT NOT NULL,
    name TEXT NOT NULL,
    rarity TEXT NOT NULL,
    slot_type TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    power INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS idx_inventory_player ON inventory_items(player_id)`,
  `CREATE TABLE IF NOT EXISTS world_shrines (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    x REAL NOT NULL,
    z REAL NOT NULL,
    radius REAL NOT NULL,
    controlling_faction TEXT NOT NULL,
    capture_progress REAL NOT NULL,
    buff_label TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS world_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender TEXT NOT NULL,
    hero_class TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
];

let cachedClient: Client | null = null;
let cachedMode: DbMode = 'libsql-local';
let initPromise: Promise<void> | null = null;
let lastDbDiagnostic: string | null = null;

export function getDbMode(): DbMode {
  return cachedMode;
}

export function getDbDiagnostic(): string | null {
  return lastDbDiagnostic;
}

function ensureDataDir(): string {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
}

function createLocalFallbackClient(): Client {
  const dataDir = ensureDataDir();
  const dbFile = path.join(dataDir, 'aethergate.db');
  cachedMode = 'libsql-local';
  cachedClient = createClient({ url: `file:${dbFile}` });
  return cachedClient;
}

export function getLibsqlClient(): Client {
  if (cachedClient) return cachedClient;

  const dataDir = ensureDataDir();
  const config = resolveTursoConnectionConfig(process.env, dataDir);
  for (const warn of config.warnings) {
    console.warn(`[Turso Config] ${warn}`);
  }

  try {
    cachedMode = config.mode;
    if (config.mode === 'turso-replica' && config.syncUrl) {
      cachedClient = createClient({
        url: config.url,
        syncUrl: config.syncUrl,
        syncInterval: config.syncInterval ?? 60,
        authToken: config.authToken,
      });
    } else if (config.mode === 'turso-cloud') {
      cachedClient = createClient({
        url: config.url,
        authToken: config.authToken,
      });
    } else {
      cachedClient = createClient({ url: config.url });
    }
    return cachedClient;
  } catch (err) {
    const reason = classifyLibsqlError(err);
    lastDbDiagnostic = reason;
    console.error(`[Turso Init Error] ${reason}. Falling back to local libSQL file.`);
    return createLocalFallbackClient();
  }
}

async function applySchemaAndSeed(db: Client): Promise<void> {
  if (cachedMode === 'turso-replica') {
    try {
      await db.sync();
    } catch (syncErr) {
      console.warn(`[Turso Replica Sync Warning] ${classifyLibsqlError(syncErr)}`);
    }
  }

  for (const sql of SCHEMA_STATEMENTS) {
    await db.execute(sql);
  }

  const shrineRes = await db.execute('SELECT COUNT(*) as cnt FROM world_shrines');
  const count = Number(shrineRes.rows[0]?.cnt ?? 0);
  if (count === 0) {
    const now = Date.now();
    for (const s of INITIAL_SHRINES) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO world_shrines (id, name, x, z, radius, controlling_faction, capture_progress, buff_label, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [s.id, s.name, s.x, s.z, s.radius, s.controllingFaction, s.captureProgress, s.buffLabel, now],
      });
    }
  }
}

export async function initDatabase(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const db = getLibsqlClient();
    try {
      await applySchemaAndSeed(db);
      lastDbDiagnostic = null;
    } catch (err) {
      const reason = classifyLibsqlError(err);
      lastDbDiagnostic = reason;
      console.error(`[Turso Schema/Connection Error] ${reason}`);

      if (cachedMode !== 'libsql-local') {
        console.warn('[Turso Fallback] Switching active store to local libSQL so realm remains online.');
        const localDb = createLocalFallbackClient();
        await applySchemaAndSeed(localDb);
      } else {
        throw err;
      }
    }
  })().catch((err) => {
    initPromise = null;
    throw err;
  });

  return initPromise;
}

async function withAutoMigrate<T>(fn: (db: Client) => Promise<T>): Promise<T> {
  await initDatabase();
  const db = getLibsqlClient();
  try {
    return await fn(db);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes('no such table')) {
      console.warn('[Turso Auto-Migrate] Missing table detected; applying schema and retrying.');
      await applySchemaAndSeed(db);
      return await fn(db);
    }
    throw err;
  }
}

export async function loadWorldShrines(): Promise<ShrineState[]> {
  return withAutoMigrate(async (db) => {
    const res = await db.execute('SELECT * FROM world_shrines ORDER BY id ASC');
    return res.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      x: Number(row.x),
      z: Number(row.z),
      radius: Number(row.radius),
      controllingFaction: (String(row.controlling_faction) as ShrineState['controllingFaction']) || 'neutral',
      captureProgress: Number(row.capture_progress),
      buffLabel: String(row.buff_label),
    }));
  });
}

export async function saveWorldShrine(shrine: ShrineState): Promise<void> {
  try {
    await withAutoMigrate(async (db) => {
      await db.execute({
        sql: `INSERT INTO world_shrines (id, name, x, z, radius, controlling_faction, capture_progress, buff_label, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                controlling_faction = excluded.controlling_faction,
                capture_progress = excluded.capture_progress,
                updated_at = excluded.updated_at`,
        args: [
          shrine.id,
          shrine.name,
          shrine.x,
          shrine.z,
          shrine.radius,
          shrine.controllingFaction,
          shrine.captureProgress,
          shrine.buffLabel,
          Date.now(),
        ],
      });
    });
  } catch (err) {
    console.error(`[Turso Write Error - Shrine] ${classifyLibsqlError(err)}`);
  }
}

export async function loadOrCreatePlayer(
  id: string,
  name: string,
  heroClass: HeroClass,
  spawnIndex = 0,
): Promise<PlayerState> {
  return withAutoMigrate(async (db) => {
    const res = await db.execute({
      sql: 'SELECT * FROM players WHERE id = ?',
      args: [id],
    });

    if (res.rows.length === 0) {
      const fresh = createDefaultPlayer(id, name, heroClass, spawnIndex);
      await savePlayerState(fresh);
      return fresh;
    }

    const row = res.rows[0];
    const invRes = await db.execute({
      sql: 'SELECT * FROM inventory_items WHERE player_id = ?',
      args: [id],
    });

    const inventory: InventoryItem[] = invRes.rows.map((r) => ({
      id: String(r.id),
      itemKey: String(r.item_key),
      name: String(r.name),
      rarity: (String(r.rarity) as Rarity) || 'common',
      slotType: (String(r.slot_type) as InventoryItem['slotType']) || 'charm',
      quantity: Number(r.quantity),
      power: Number(r.power),
    }));

    const savedClass = (String(row.hero_class) as HeroClass) || heroClass;
    const spec = CLASS_SPECS[heroClass] ?? CLASS_SPECS[savedClass];
    const finalClass = heroClass || savedClass;
    const x = Number(row.x);
    const z = Number(row.z);
    const maxHp = Math.max(spec.baseHp, Number(row.max_hp));
    const maxMana = Math.max(spec.baseMana, Number(row.max_mana));
    const hp = Math.max(Math.round(maxHp * 0.5), Math.min(maxHp, Number(row.hp)));
    const mana = Math.max(Math.round(maxMana * 0.5), Math.min(maxMana, Number(row.mana)));

    const player: PlayerState = {
      id,
      name: name.trim().slice(0, 20) || String(row.name),
      heroClass: finalClass,
      level: Number(row.level),
      xp: Number(row.xp),
      xpToNext: Number(row.xp_to_next),
      hp,
      maxHp,
      mana,
      maxMana,
      gold: Number(row.gold),
      kills: Number(row.kills),
      potions: Number(row.potions),
      x,
      y: groundHeightAt(x, z),
      z,
      vx: 0,
      vz: 0,
      facing: Math.PI,
      cooldowns: [0, 0, 0],
      dashCooldown: 0,
      dashTimer: 0,
      dashDirX: 0,
      dashDirZ: -1,
      castFlashTimer: 0,
      castSkillIndex: 0,
      hurtTimer: 0,
      invulnTimer: 1.5,
      alive: true,
      respawnTimer: 0,
      targetEnemyId: null,
      weaponPower: Number(row.weapon_power),
      charmPower: Number(row.charm_power),
      input: {
        moveX: 0,
        moveZ: 0,
        waypointX: null,
        waypointZ: null,
      },
      inventory: inventory.length > 0 ? inventory : createDefaultPlayer(id, name, finalClass).inventory,
      lastHitTime: -10,
    };

    return player;
  });
}

export async function savePlayerState(player: PlayerState): Promise<void> {
  try {
    await withAutoMigrate(async (db) => {
      const now = Date.now();
      const statements = [
        {
          sql: `INSERT INTO players (id, name, hero_class, level, xp, xp_to_next, hp, max_hp, mana, max_mana, gold, kills, potions, x, z, weapon_power, charm_power, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  name = excluded.name,
                  hero_class = excluded.hero_class,
                  level = excluded.level,
                  xp = excluded.xp,
                  xp_to_next = excluded.xp_to_next,
                  hp = excluded.hp,
                  max_hp = excluded.max_hp,
                  mana = excluded.mana,
                  max_mana = excluded.max_mana,
                  gold = excluded.gold,
                  kills = excluded.kills,
                  potions = excluded.potions,
                  x = excluded.x,
                  z = excluded.z,
                  weapon_power = excluded.weapon_power,
                  charm_power = excluded.charm_power,
                  updated_at = excluded.updated_at`,
          args: [
            player.id,
            player.name,
            player.heroClass,
            player.level,
            Math.round(player.xp),
            Math.round(player.xpToNext),
            Math.round(player.hp),
            Math.round(player.maxHp),
            Math.round(player.mana),
            Math.round(player.maxMana),
            Math.round(player.gold),
            player.kills,
            player.potions,
            Number(player.x.toFixed(2)),
            Number(player.z.toFixed(2)),
            player.weaponPower,
            player.charmPower,
            now,
          ],
        },
        ...player.inventory.map((item) => ({
          sql: `INSERT INTO inventory_items (id, player_id, item_key, name, rarity, slot_type, quantity, power)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  quantity = excluded.quantity,
                  power = excluded.power`,
          args: [item.id, player.id, item.itemKey, item.name, item.rarity, item.slotType, item.quantity, item.power],
        })),
      ];

      await db.batch(statements, 'write');
    });
  } catch (err) {
    console.error(`[Turso Write Error - Player] ${classifyLibsqlError(err)}`);
  }
}

export async function appendChatMessage(msg: ChatMessage): Promise<void> {
  try {
    await withAutoMigrate(async (db) => {
      await db.execute({
        sql: 'INSERT INTO world_events (sender, hero_class, text, created_at) VALUES (?, ?, ?, ?)',
        args: [msg.sender, msg.heroClass ?? 'system', msg.text, msg.createdAt],
      });
    });
  } catch (err) {
    console.error(`[Turso Write Error - Chat] ${classifyLibsqlError(err)}`);
  }
}

export async function loadRecentChat(limit = 16): Promise<ChatMessage[]> {
  return withAutoMigrate(async (db) => {
    const res = await db.execute({
      sql: 'SELECT id, sender, hero_class, text, created_at FROM world_events ORDER BY id DESC LIMIT ?',
      args: [limit],
    });
    return res.rows
      .map((r) => ({
        id: `chat-${r.id}`,
        sender: String(r.sender),
        heroClass: (String(r.hero_class) as ChatMessage['heroClass']) || 'system',
        text: String(r.text),
        createdAt: Number(r.created_at),
      }))
      .reverse();
  });
}

export async function getLeaderboard(limit = 8) {
  return withAutoMigrate(async (db) => {
    const res = await db.execute({
      sql: 'SELECT id, name, hero_class, level, kills, gold FROM players ORDER BY level DESC, kills DESC, gold DESC LIMIT ?',
      args: [limit],
    });
    return res.rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      heroClass: String(r.hero_class),
      level: Number(r.level),
      kills: Number(r.kills),
      gold: Number(r.gold),
    }));
  });
}
