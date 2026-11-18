'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ChatMessage,
  ClientMessage,
  GameLifecycleState,
  HeroClass,
  InventoryItem,
  ServerMessage,
  WorldSnapshot,
} from '@/lib/game/types';
import { gameAudio } from '@/lib/three/audio';
import IsometricWorldCanvas, {
  type HudBridgeState,
  type WorldControlApi,
} from './IsometricWorldCanvas';
import TitleScreen from './TitleScreen';
import GameHud from './GameHud';
import MobileTouchControls from './MobileTouchControls';
import GameModals from './GameModals';

function getOrCreateTabHeroId(): string {
  if (typeof window === 'undefined') return 'hero-ssr';
  const params = new URLSearchParams(window.location.search);
  const queryId = params.get('hero');
  if (queryId) return queryId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);

  let stored = window.sessionStorage.getItem('aethergate_hero_id');
  if (!stored) {
    stored = `hero-${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem('aethergate_hero_id', stored);
  }
  return stored;
}

export default function AethergateClient() {
  const [gameState, setGameState] = useState<GameLifecycleState>('title');
  const [heroName, setHeroName] = useState<string>('Aeloria');
  const [heroClass, setHeroClass] = useState<HeroClass>('vanguard');
  const [localPlayerId, setLocalPlayerId] = useState<string>('hero-init');
  const [muted, setMuted] = useState<boolean>(false);
  const [inventoryOpen, setInventoryOpen] = useState<boolean>(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [hud, setHud] = useState<HudBridgeState>({
    localPlayer: null,
    targetEnemy: null,
    shrines: [],
    allPlayers: [],
    allEnemies: [],
    onlineCount: 1,
    dbMode: 'libsql-local',
    zoneName: 'Solis Sanctuary',
  });

  const snapshotRef = useRef<WorldSnapshot | null>(null);
  const controlApiRef = useRef<WorldControlApi | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const gameStateRef = useRef<GameLifecycleState>('title');
  const heroCredsRef = useRef({ id: 'hero-init', name: 'Aeloria', heroClass: 'vanguard' as HeroClass });

  useEffect(() => {
    gameStateRef.current = gameState;
    document.body.dataset.state = gameState;
  }, [gameState]);

  const sendWs = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const connectFnRef = useRef<(id: string, name: string, cls: HeroClass) => void>(() => {});

  const connectAndJoin = useCallback((id: string, name: string, cls: HeroClass) => {
    heroCredsRef.current = { id, name, heroClass: cls };
    const existing = wsRef.current;
    if (existing && existing.readyState === WebSocket.OPEN) {
      existing.send(JSON.stringify({ type: 'join', playerId: id, name, heroClass: cls } satisfies ClientMessage));
      return;
    }
    if (existing && existing.readyState === WebSocket.CONNECTING) {
      return;
    }

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      const creds = heroCredsRef.current;
      ws.send(
        JSON.stringify({
          type: 'join',
          playerId: creds.id,
          name: creds.name,
          heroClass: creds.heroClass,
        } satisfies ClientMessage),
      );
    };

    ws.onmessage = (event) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(String(event.data)) as ServerMessage;
      } catch {
        return;
      }
      if (msg.type === 'welcome') {
        setChatMessages(msg.chatHistory);
        setInventory(msg.inventory);
      } else if (msg.type === 'snapshot') {
        snapshotRef.current = msg.data;
      } else if (msg.type === 'chat') {
        setChatMessages((prev) => [...prev.slice(-24), msg.message]);
      } else if (msg.type === 'inventory') {
        setInventory(msg.items);
      }
    };

    ws.onclose = () => {
      if (wsRef.current === ws) wsRef.current = null;
      if (gameStateRef.current === 'playing') {
        setTimeout(() => {
          if (gameStateRef.current === 'playing') {
            const creds = heroCredsRef.current;
            connectFnRef.current(creds.id, creds.name, creds.heroClass);
          }
        }, 1200);
      }
    };
  }, []);

  useEffect(() => {
    connectFnRef.current = connectAndJoin;
  }, [connectAndJoin]);

  const enterRealm = useCallback(
    (overrideId?: string, overrideName?: string, overrideClass?: HeroClass) => {
      const id = overrideId ?? localPlayerId;
      const name = (overrideName ?? heroName).trim() || 'Wanderer';
      const cls = overrideClass ?? heroClass;

      window.sessionStorage.setItem('aethergate_hero_name', name);
      window.sessionStorage.setItem('aethergate_hero_class', cls);
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      document.body.dataset.state = 'playing';
      setGameState('playing');
      connectAndJoin(id, name, cls);
    },
    [connectAndJoin, heroClass, heroName, localPlayerId],
  );

  // Initialize Tab Hero ID, Saved Preferences, & ?autostart=1
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const id = getOrCreateTabHeroId();
      setLocalPlayerId(id);

      const savedName = window.sessionStorage.getItem('aethergate_hero_name');
      const savedClass = window.sessionStorage.getItem('aethergate_hero_class') as HeroClass | null;
      const initName = savedName || 'Aeloria';
      const initClass =
        savedClass && (savedClass === 'vanguard' || savedClass === 'arcanist' || savedClass === 'ranger')
          ? savedClass
          : 'vanguard';
      setHeroName(initName);
      setHeroClass(initClass);

      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        document.body.dataset.state = 'playing';
        setGameState('playing');
        connectAndJoin(id, initName, initClass);
      }
    });

    return () => {
      active = false;
      wsRef.current?.close();
    };
  }, [connectAndJoin]);

  // Global Hotkeys (Title Enter/Space, Pause Esc/P, Mute M, Potion F, Inventory I)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (e.code === 'Escape') {
          (document.activeElement as HTMLElement).blur();
        }
        return;
      }

      if (gameStateRef.current === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          enterRealm();
        }
        return;
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        if (inventoryOpen) {
          setInventoryOpen(false);
        } else if (gameStateRef.current === 'playing') {
          setGameState('paused');
        } else if (gameStateRef.current === 'paused') {
          setGameState('playing');
        }
      } else if (e.code === 'KeyM' && !e.repeat) {
        setMuted((prev) => {
          const next = !prev;
          gameAudio.setMuted(next);
          return next;
        });
      } else if (e.code === 'KeyF' && !e.repeat && gameStateRef.current === 'playing') {
        sendWs({ type: 'use_potion' });
      } else if (e.code === 'KeyI' && !e.repeat && gameStateRef.current === 'playing') {
        setInventoryOpen((v) => !v);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enterRealm, inventoryOpen, sendWs]);

  const handleHudSync = useCallback((nextHud: HudBridgeState) => {
    setHud(nextHud);
    if (nextHud.localPlayer && !nextHud.localPlayer.alive && gameStateRef.current === 'playing') {
      setGameState('gameover');
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      gameAudio.setMuted(next);
      return next;
    });
  }, []);

  const handleRespawn = useCallback(() => {
    sendWs({ type: 'respawn' });
    document.body.dataset.state = 'playing';
    setGameState('playing');
  }, [sendWs]);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0c1018]">
      <IsometricWorldCanvas
        gameState={gameState}
        localPlayerId={localPlayerId}
        snapshotRef={snapshotRef}
        controlApiRef={controlApiRef}
        onSendInput={(moveX, moveZ, waypointX, waypointZ) =>
          sendWs({ type: 'input', moveX, moveZ, waypointX, waypointZ })
        }
        onCastSkill={(skillIndex, aimX, aimZ, targetEnemyId) =>
          sendWs({ type: 'cast', skillIndex, aimX, aimZ, targetEnemyId })
        }
        onDash={(dirX, dirZ) => sendWs({ type: 'dash', dirX, dirZ })}
        onSelectTarget={(enemyId) => sendWs({ type: 'target', enemyId })}
        onHudSync={handleHudSync}
      />

      {gameState === 'title' && (
        <TitleScreen
          heroName={heroName}
          heroClass={heroClass}
          onChangeName={setHeroName}
          onChangeClass={setHeroClass}
          onStart={() => enterRealm()}
        />
      )}

      {gameState === 'playing' && (
        <>
          <GameHud
            player={hud.localPlayer}
            targetEnemy={hud.targetEnemy}
            shrines={hud.shrines}
            allPlayers={hud.allPlayers}
            allEnemies={hud.allEnemies}
            onlineCount={hud.onlineCount}
            dbMode={hud.dbMode}
            zoneName={hud.zoneName}
            muted={muted}
            chatMessages={chatMessages}
            onToggleMute={handleToggleMute}
            onPause={() => setGameState('paused')}
            onOpenInventory={() => setInventoryOpen((v) => !v)}
            onUsePotion={() => sendWs({ type: 'use_potion' })}
            onCastSkill={(idx) => controlApiRef.current?.triggerSkill(idx)}
            onDash={() => controlApiRef.current?.triggerDash()}
            onRotateCam={(d) => controlApiRef.current?.rotateCamera(d)}
            onSendChat={(text) => sendWs({ type: 'chat', text })}
          />

          <MobileTouchControls
            player={hud.localPlayer}
            onJoystickMove={(x, y) => controlApiRef.current?.setJoystickVector(x, y)}
            onCastSkill={(idx) => controlApiRef.current?.triggerSkill(idx)}
            onDash={() => controlApiRef.current?.triggerDash()}
            onUsePotion={() => sendWs({ type: 'use_potion' })}
          />
        </>
      )}

      <GameModals
        gameState={gameState}
        player={hud.localPlayer}
        inventory={inventory}
        inventoryOpen={inventoryOpen && gameState === 'playing'}
        onCloseInventory={() => setInventoryOpen(false)}
        onEquipItem={(itemId) => sendWs({ type: 'equip_item', itemId })}
        onResume={() => setGameState('playing')}
        onRespawn={handleRespawn}
        onReturnTitle={() => {
          setInventoryOpen(false);
          setGameState('title');
        }}
      />
    </main>
  );
}
