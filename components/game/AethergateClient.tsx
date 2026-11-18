'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ChatMessage,
  ClientMessage,
  CombatStance,
  GameLifecycleState,
  HeroAppearance,
  HeroClass,
  InventoryItem,
  PlayerMonetizationState,
  PlayerPhilosophyState,
  QuestProgress,
  ServerMessage,
  WorldSnapshot,
} from '@/lib/game/types';
import { getDefaultAppearance, sanitizeAppearance } from '@/lib/game/appearance';
import { createDefaultMonetizationState } from '@/lib/game/monetization';
import { createDefaultPhilosophyState } from '@/lib/game/philosophy';
import { gameAudio } from '@/lib/three/audio';
import {
  DEFAULT_GRAPHICS_SETTINGS,
  type GraphicsQuality,
  type GraphicsSettings,
  type TimeOfDayMode,
  type WeatherMode,
} from '@/lib/three/atmosphere';
import IsometricWorldCanvas, {
  type GraphicsStatusInfo,
  type HudBridgeState,
  type WorldControlApi,
} from './IsometricWorldCanvas';
import TitleScreen from './TitleScreen';
import GameHud from './GameHud';
import MobileTouchControls from './MobileTouchControls';
import GameModals from './GameModals';
import CharacterCreatorModal from './CharacterCreatorModal';
import QuestJournalModal from './QuestJournalModal';
import StorefrontModal from './StorefrontModal';
import EasyMarchDrawer from './EasyMarchDrawer';
import GameLoop from './GameLoop';

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
  const [appearance, setAppearance] = useState<HeroAppearance>(() => getDefaultAppearance('vanguard'));
  const [localPlayerId, setLocalPlayerId] = useState<string>('hero-init');
  const [muted, setMuted] = useState<boolean>(false);
  const [inventoryOpen, setInventoryOpen] = useState<boolean>(false);
  const [creatorOpen, setCreatorOpen] = useState<boolean>(false);
  const [questJournalOpen, setQuestJournalOpen] = useState<boolean>(false);
  const [storeOpen, setStoreOpen] = useState<boolean>(false);
  const [storeNotice, setStoreNotice] = useState<string | null>(null);
  const [campOpen, setCampOpen] = useState<boolean>(false);
  const [campNotice, setCampNotice] = useState<string | null>(null);
  const [atmosphereOpen, setAtmosphereOpen] = useState<boolean>(false);
  const [graphicsSettings, setGraphicsSettings] = useState<GraphicsSettings>(DEFAULT_GRAPHICS_SETTINGS);
  const [graphicsStatus, setGraphicsStatus] = useState<GraphicsStatusInfo | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [quests, setQuests] = useState<QuestProgress[]>([]);
  const [trackedQuestId, setTrackedQuestId] = useState<string | null>(null);
  const [monetization, setMonetization] = useState<PlayerMonetizationState>(() =>
    createDefaultMonetizationState(),
  );
  const [philosophy, setPhilosophy] = useState<PlayerPhilosophyState>(() =>
    createDefaultPhilosophyState(),
  );
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [hud, setHud] = useState<HudBridgeState>({
    localPlayer: null,
    targetEnemy: null,
    shrines: [],
    allPlayers: [],
    allEnemies: [],
    companions: [],
    tacticalAdvice: null,
    onlineCount: 1,
    dbMode: 'libsql-local',
    zoneName: 'Solis Sanctuary',
    dynamicEvent: null,
    nextEventInSec: 12,
    serverTime: 0,
  });

  const snapshotRef = useRef<WorldSnapshot | null>(null);
  const controlApiRef = useRef<WorldControlApi | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const gameStateRef = useRef<GameLifecycleState>('title');
  const customAppearanceTouchedRef = useRef<boolean>(false);
  const heroCredsRef = useRef<{
    id: string;
    name: string;
    heroClass: HeroClass;
    appearance: HeroAppearance;
  }>({
    id: 'hero-init',
    name: 'Aeloria',
    heroClass: 'vanguard',
    appearance: getDefaultAppearance('vanguard'),
  });

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

  const connectFnRef = useRef<
    (id: string, name: string, cls: HeroClass, app: HeroAppearance) => void
  >(() => {});

  const connectAndJoin = useCallback(
    (id: string, name: string, cls: HeroClass, app: HeroAppearance) => {
      heroCredsRef.current = { id, name, heroClass: cls, appearance: app };
      const existing = wsRef.current;
      if (existing && existing.readyState === WebSocket.OPEN) {
        existing.send(
          JSON.stringify({
            type: 'join',
            playerId: id,
            name,
            heroClass: cls,
            appearance: app,
          } satisfies ClientMessage),
        );
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
            appearance: creds.appearance,
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
          setQuests(msg.quests);
          setTrackedQuestId(msg.trackedQuestId);
          if (msg.appearance) {
            setAppearance(msg.appearance);
            window.sessionStorage.setItem('aethergate_hero_appearance', JSON.stringify(msg.appearance));
          }
          if (msg.monetization) {
            setMonetization(msg.monetization);
          }
          if (msg.philosophy) {
            setPhilosophy(msg.philosophy);
          }
        } else if (msg.type === 'snapshot') {
          snapshotRef.current = msg.data;
        } else if (msg.type === 'chat') {
          setChatMessages((prev) => [...prev.slice(-24), msg.message]);
        } else if (msg.type === 'inventory') {
          setInventory(msg.items);
        } else if (msg.type === 'quests') {
          setQuests(msg.quests);
          setTrackedQuestId(msg.trackedQuestId);
        } else if (msg.type === 'philosophy') {
          setPhilosophy(msg.philosophy);
          if (msg.notice) {
            setCampNotice(msg.notice);
          }
        } else if (msg.type === 'monetization') {
          setMonetization(msg.monetization);
          if (msg.appearance) {
            setAppearance(msg.appearance);
            window.sessionStorage.setItem('aethergate_hero_appearance', JSON.stringify(msg.appearance));
          }
          if (msg.notice) {
            setStoreNotice(msg.notice);
          }
        }
      };

      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        if (gameStateRef.current === 'playing') {
          setTimeout(() => {
            if (gameStateRef.current === 'playing') {
              const creds = heroCredsRef.current;
              connectFnRef.current(creds.id, creds.name, creds.heroClass, creds.appearance);
            }
          }, 1200);
        }
      };
    },
    [],
  );

  useEffect(() => {
    connectFnRef.current = connectAndJoin;
  }, [connectAndJoin]);

  const handleClassChange = useCallback((nextClass: HeroClass) => {
    setHeroClass(nextClass);
    if (!customAppearanceTouchedRef.current) {
      setAppearance(getDefaultAppearance(nextClass));
    }
  }, []);

  const handleAppearanceChange = useCallback((nextApp: HeroAppearance) => {
    customAppearanceTouchedRef.current = true;
    setAppearance(nextApp);
    window.sessionStorage.setItem('aethergate_hero_appearance', JSON.stringify(nextApp));
  }, []);

  const enterRealm = useCallback(
    (
      overrideId?: string,
      overrideName?: string,
      overrideClass?: HeroClass,
      overrideAppearance?: HeroAppearance,
    ) => {
      const id = overrideId ?? localPlayerId;
      const name = (overrideName ?? heroName).trim() || 'Wanderer';
      const cls = overrideClass ?? heroClass;
      const app = overrideAppearance ?? appearance;

      window.sessionStorage.setItem('aethergate_hero_name', name);
      window.sessionStorage.setItem('aethergate_hero_class', cls);
      window.sessionStorage.setItem('aethergate_hero_appearance', JSON.stringify(app));
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      document.body.dataset.state = 'playing';
      setGameState('playing');
      connectAndJoin(id, name, cls, app);
    },
    [appearance, connectAndJoin, heroClass, heroName, localPlayerId],
  );

  // Initialize Tab Hero ID, Saved Preferences, URL atmosphere params, & ?autostart=1
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const id = getOrCreateTabHeroId();
      setLocalPlayerId(id);

      const savedName = window.sessionStorage.getItem('aethergate_hero_name');
      const savedClass = window.sessionStorage.getItem('aethergate_hero_class') as HeroClass | null;
      const savedAppRaw = window.sessionStorage.getItem('aethergate_hero_appearance');
      const initName = savedName || 'Aeloria';
      const initClass =
        savedClass && (savedClass === 'vanguard' || savedClass === 'arcanist' || savedClass === 'ranger')
          ? savedClass
          : 'vanguard';
      let initAppearance = getDefaultAppearance(initClass);
      if (savedAppRaw) {
        try {
          initAppearance = sanitizeAppearance(JSON.parse(savedAppRaw) as Partial<HeroAppearance>, initClass);
          customAppearanceTouchedRef.current = true;
        } catch {
          initAppearance = getDefaultAppearance(initClass);
        }
      }
      setHeroName(initName);
      setHeroClass(initClass);
      setAppearance(initAppearance);

      const params = new URLSearchParams(window.location.search);
      const qTod = params.get('tod') as TimeOfDayMode | null;
      const qWeather = params.get('weather') as WeatherMode | null;
      const qGfx = params.get('gfx') as GraphicsQuality | null;
      if (qTod || qWeather || qGfx) {
        setGraphicsSettings((prev) => ({
          ...prev,
          timeOfDay:
            qTod && ['auto', 'dawn', 'day', 'dusk', 'night'].includes(qTod) ? qTod : prev.timeOfDay,
          weather:
            qWeather && ['auto', 'clear', 'rain', 'snow', 'corruption'].includes(qWeather)
              ? qWeather
              : prev.weather,
          quality:
            qGfx && ['auto', 'low', 'medium', 'high'].includes(qGfx) ? qGfx : prev.quality,
        }));
      }

      if (params.get('autostart') === '1') {
        document.body.dataset.state = 'playing';
        setGameState('playing');
        connectAndJoin(id, initName, initClass, initAppearance);
      }
    });

    return () => {
      active = false;
      wsRef.current?.close();
    };
  }, [connectAndJoin]);

  // Global Hotkeys (Title Enter/Space, Pause Esc/P, Mute M, Potion F, Inventory I, Quests J)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (e.code === 'Escape') {
          (document.activeElement as HTMLElement).blur();
        }
        return;
      }

      if (creatorOpen) {
        if (e.code === 'Escape') {
          e.preventDefault();
          setCreatorOpen(false);
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
        if (campOpen) {
          setCampOpen(false);
        } else if (storeOpen) {
          setStoreOpen(false);
        } else if (questJournalOpen) {
          setQuestJournalOpen(false);
        } else if (inventoryOpen) {
          setInventoryOpen(false);
        } else if (atmosphereOpen) {
          setAtmosphereOpen(false);
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
      } else if (e.code === 'KeyJ' && !e.repeat && gameStateRef.current === 'playing') {
        setQuestJournalOpen((v) => !v);
      } else if (e.code === 'KeyB' && !e.repeat && gameStateRef.current === 'playing') {
        setStoreNotice(null);
        setStoreOpen((v) => !v);
      } else if (e.code === 'KeyC' && !e.repeat && gameStateRef.current === 'playing') {
        setCampNotice(null);
        setCampOpen((v) => !v);
      } else if (e.code === 'KeyG' && !e.repeat && gameStateRef.current === 'playing') {
        sendWs({ type: 'toggle_mount' });
      } else if (e.code === 'KeyZ' && !e.repeat && gameStateRef.current === 'playing') {
        setPhilosophy((prev) => {
          const order: CombatStance[] = ['balanced', 'heavy', 'swift'];
          const next = order[(order.indexOf(prev.activeStance) + 1) % order.length];
          sendWs({ type: 'set_stance', stance: next });
          return { ...prev, activeStance: next };
        });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [atmosphereOpen, campOpen, creatorOpen, enterRealm, inventoryOpen, questJournalOpen, sendWs, storeOpen]);

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

  const handleConfirmCreator = useCallback(() => {
    window.sessionStorage.setItem('aethergate_hero_appearance', JSON.stringify(appearance));
    setCreatorOpen(false);
    if (gameStateRef.current === 'title') {
      enterRealm(localPlayerId, heroName, heroClass, appearance);
    } else {
      sendWs({ type: 'update_appearance', appearance });
      setGameState('playing');
    }
  }, [appearance, enterRealm, heroClass, heroName, localPlayerId, sendWs]);

  return (
    <GameLoop gameState={gameState}>
      <main className="relative w-screen h-screen overflow-hidden bg-[#0c1018]">
        <IsometricWorldCanvas
          gameState={gameState}
          localPlayerId={localPlayerId}
          snapshotRef={snapshotRef}
          graphicsSettings={graphicsSettings}
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
          onGraphicsStatus={setGraphicsStatus}
        />

        {gameState === 'title' && (
          <TitleScreen
            heroName={heroName}
            heroClass={heroClass}
            appearance={appearance}
            onChangeName={setHeroName}
            onChangeClass={handleClassChange}
            onOpenCreator={() => setCreatorOpen(true)}
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
              companions={hud.companions}
              tacticalAdvice={hud.tacticalAdvice}
              onlineCount={hud.onlineCount}
              dbMode={hud.dbMode}
              zoneName={hud.zoneName}
              muted={muted}
              chatMessages={chatMessages}
              quests={quests}
              trackedQuestId={trackedQuestId}
              dynamicEvent={hud.dynamicEvent}
              nextEventInSec={hud.nextEventInSec}
              serverTime={hud.serverTime}
              graphicsSettings={graphicsSettings}
              graphicsStatus={graphicsStatus}
              atmosphereOpen={atmosphereOpen}
              onToggleAtmosphere={() => setAtmosphereOpen((v) => !v)}
              onUpdateGraphics={setGraphicsSettings}
              onToggleMute={handleToggleMute}
              onPause={() => setGameState('paused')}
              onOpenInventory={() => setInventoryOpen((v) => !v)}
              onOpenQuests={() => setQuestJournalOpen((v) => !v)}
              onOpenStore={() => {
                setStoreNotice(null);
                setStoreOpen((v) => !v);
              }}
              onOpenCamp={() => {
                setCampNotice(null);
                setCampOpen((v) => !v);
              }}
              onSetStance={(stance) => sendWs({ type: 'set_stance', stance })}
              onToggleMount={() => sendWs({ type: 'toggle_mount' })}
              onMountedManeuver={(maneuver) => sendWs({ type: 'mounted_maneuver', maneuver })}
              onClaimQuest={(questId) => sendWs({ type: 'claim_quest', questId })}
              onNavigateTo={(x, z) => controlApiRef.current?.setWaypoint(x, z)}
              onTriggerWorldEvent={() => sendWs({ type: 'trigger_world_event' })}
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
          onOpenCreator={() => setCreatorOpen(true)}
          onRespawn={handleRespawn}
          onReturnTitle={() => {
            setInventoryOpen(false);
            setQuestJournalOpen(false);
            setStoreOpen(false);
            setCampOpen(false);
            setAtmosphereOpen(false);
            setGameState('title');
          }}
        />

        <QuestJournalModal
          open={questJournalOpen && gameState === 'playing'}
          quests={quests}
          trackedQuestId={trackedQuestId}
          onClose={() => setQuestJournalOpen(false)}
          onTrackQuest={(questId) => sendWs({ type: 'track_quest', questId })}
          onNavigateQuest={(x, z, questId) => {
            sendWs({ type: 'track_quest', questId });
            controlApiRef.current?.setWaypoint(x, z);
          }}
          onClaimQuest={(questId) => sendWs({ type: 'claim_quest', questId })}
        />

        <StorefrontModal
          open={storeOpen && gameState === 'playing'}
          player={hud.localPlayer}
          appearance={appearance}
          monetization={monetization}
          serverTime={hud.serverTime}
          notice={storeNotice}
          onClose={() => setStoreOpen(false)}
          onPurchaseCosmetic={(itemId, method) =>
            sendWs({ type: 'purchase_cosmetic', itemId, method, autoEquip: true })
          }
          onEquipAppearance={(nextApp) => {
            handleAppearanceChange(nextApp);
            sendWs({ type: 'update_appearance', appearance: nextApp });
            setStoreNotice('Appearance equipped');
          }}
          onActivateBattlePass={(method) => sendWs({ type: 'activate_battle_pass', method })}
          onClaimPassTier={(tier, track) => sendWs({ type: 'claim_pass_tier', tier, track })}
          onClaimAdReward={(kind) => sendWs({ type: 'claim_ad_reward', kind })}
        />

        <EasyMarchDrawer
          open={campOpen && gameState === 'playing'}
          player={hud.localPlayer}
          philosophy={philosophy}
          companions={hud.companions}
          tacticalAdvice={hud.tacticalAdvice}
          serverTime={hud.serverTime}
          notice={campNotice}
          onClose={() => setCampOpen(false)}
          onCampPrep={(action) => sendWs({ type: 'prepare_camp', action })}
          onResolveDilemma={(dilemmaId, optionId) =>
            sendWs({ type: 'philosophical_choice', dilemmaId, optionId })
          }
          onUsePathAbility={(abilityId) => sendWs({ type: 'use_path_ability', abilityId })}
          onSetStance={(stance) => sendWs({ type: 'set_stance', stance })}
          onOpenStore={() => {
            setStoreNotice(null);
            setStoreOpen(true);
          }}
        />

        <CharacterCreatorModal
          open={creatorOpen}
          heroName={heroName}
          heroClass={heroClass}
          appearance={appearance}
          unlockedCosmetics={monetization.unlockedCosmetics}
          onOpenStore={gameState === 'playing' ? () => setStoreOpen(true) : undefined}
          onChangeName={setHeroName}
          onChangeClass={handleClassChange}
          onChangeAppearance={handleAppearanceChange}
          onClose={() => setCreatorOpen(false)}
          onConfirmEnter={handleConfirmCreator}
        />
      </main>
    </GameLoop>
  );
}
