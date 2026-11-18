'use client';

import React, { useState } from 'react';
import {
  Volume2,
  VolumeX,
  Pause,
  Backpack,
  MessageSquare,
  RotateCcw,
  RotateCw,
  Send,
  Coins,
  Swords,
  Users,
  Database,
  FlaskConical,
  Wind,
  SlidersHorizontal,
  Sun,
  CloudRain,
  Snowflake,
  Sparkles,
  Clock,
  X,
  ScrollText,
  Compass,
  Zap,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Crown,
  Shield,
  Hammer,
  AlertTriangle,
} from 'lucide-react';
import type {
  ChatMessage,
  CombatStance,
  DynamicWorldEventState,
  MountedManeuverKind,
  QuestProgress,
  ShrineState,
  SnapshotCompanion,
  SnapshotEnemy,
  SnapshotPlayer,
  TacticalAdvice,
} from '@/lib/game/types';
import { CLASS_SPECS } from '@/lib/game/worldData';
import { QUEST_BY_ID } from '@/lib/game/quests';
import { STANCE_MODIFIERS } from '@/lib/game/philosophy';
import type {
  GraphicsQuality,
  GraphicsSettings,
  TimeOfDayMode,
  WeatherMode,
} from '@/lib/three/atmosphere';
import type { GraphicsStatusInfo } from './IsometricWorldCanvas';

interface GameHudProps {
  player: SnapshotPlayer | null;
  targetEnemy: SnapshotEnemy | null;
  shrines: ShrineState[];
  allPlayers: SnapshotPlayer[];
  allEnemies: SnapshotEnemy[];
  companions: SnapshotCompanion[];
  tacticalAdvice: TacticalAdvice | null;
  onlineCount: number;
  dbMode: string;
  zoneName: string;
  muted: boolean;
  chatMessages: ChatMessage[];
  quests: QuestProgress[];
  trackedQuestId: string | null;
  dynamicEvent: DynamicWorldEventState | null;
  nextEventInSec: number;
  serverTime: number;
  graphicsSettings: GraphicsSettings;
  graphicsStatus: GraphicsStatusInfo | null;
  atmosphereOpen: boolean;
  onToggleAtmosphere: () => void;
  onUpdateGraphics: (updater: (prev: GraphicsSettings) => GraphicsSettings) => void;
  onToggleMute: () => void;
  onPause: () => void;
  onOpenInventory: () => void;
  onOpenQuests: () => void;
  onOpenStore: () => void;
  onOpenCamp: () => void;
  onSetStance: (stance: CombatStance) => void;
  onToggleMount: () => void;
  onMountedManeuver: (maneuver: MountedManeuverKind) => void;
  onClaimQuest: (questId: string) => void;
  onNavigateTo: (x: number, z: number) => void;
  onTriggerWorldEvent: () => void;
  onUsePotion: () => void;
  onCastSkill: (index: 0 | 1 | 2) => void;
  onDash: () => void;
  onRotateCam: (deltaYaw: number) => void;
  onSendChat: (text: string) => void;
}

export default function GameHud({
  player,
  targetEnemy,
  shrines,
  allPlayers,
  allEnemies,
  companions,
  tacticalAdvice,
  onlineCount,
  dbMode,
  zoneName,
  muted,
  chatMessages,
  quests,
  trackedQuestId,
  dynamicEvent,
  nextEventInSec,
  serverTime,
  graphicsSettings,
  graphicsStatus,
  atmosphereOpen,
  onToggleAtmosphere,
  onUpdateGraphics,
  onToggleMute,
  onPause,
  onOpenInventory,
  onOpenQuests,
  onOpenStore,
  onOpenCamp,
  onSetStance,
  onToggleMount,
  onMountedManeuver,
  onClaimQuest,
  onNavigateTo,
  onTriggerWorldEvent,
  onUsePotion,
  onCastSkill,
  onDash,
  onRotateCam,
  onSendChat,
}: GameHudProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState('');
  const [trackerExpanded, setTrackerExpanded] = useState(true);

  if (!player) return null;

  const activeStance: CombatStance = player.activeStance ?? 'balanced';
  const staminaPct = Math.max(
    0,
    Math.min(100, ((player.stamina ?? 100) / Math.max(1, player.maxStamina ?? 100)) * 100),
  );

  const spec = CLASS_SPECS[player.heroClass];
  const hpPct = Math.max(0, Math.min(100, (player.hp / Math.max(1, player.maxHp)) * 100));
  const manaPct = Math.max(0, Math.min(100, (player.mana / Math.max(1, player.maxMana)) * 100));
  const xpPct = Math.max(0, Math.min(100, (player.xp / Math.max(1, player.xpToNext)) * 100));
  const solisShrines = shrines.filter((s) => s.controllingFaction === 'solis').length;

  const readyQuestCount = quests.filter((q) => q.status === 'completed').length;
  const visibleTrackerQuests = quests
    .filter((q) => q.status !== 'claimed')
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'completed' ? -1 : 1;
      if (a.questId === trackedQuestId) return -1;
      if (b.questId === trackedQuestId) return 1;
      return a.category === 'main' ? -1 : 1;
    })
    .slice(0, 2);

  const trackedDef = trackedQuestId ? QUEST_BY_ID[trackedQuestId] : undefined;
  const eventActive = dynamicEvent?.status === 'active';
  const eventRemainSec = eventActive
    ? Math.max(0, Math.ceil((dynamicEvent.expiresAt - serverTime) / 1000))
    : 0;
  const eventMins = Math.floor(eventRemainSec / 60);
  const eventSecs = String(eventRemainSec % 60).padStart(2, '0');
  const eventPct = eventActive
    ? Math.max(0, Math.min(100, (dynamicEvent.progress / Math.max(1, dynamicEvent.goal)) * 100))
    : 0;
  const eventParticipants = eventActive ? Object.keys(dynamicEvent.participantScores).length : 0;

  const submitChat = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatDraft.trim();
    if (!trimmed) return;
    onSendChat(trimmed);
    setChatDraft('');
  };

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-2.5 sm:p-4">
      {/* TOP PERIMETER ROW */}
      <div className="flex items-start justify-between gap-2">
        {/* Top-Left Column: Hero Vitality + Compact Diegetic Quest Tracker */}
        <div className="flex flex-col gap-2 items-start">
          <div className="pointer-events-auto rounded-xl bg-[#0d121c]/88 border border-[#e5a93c]/25 px-3 py-2 sm:px-4 sm:py-2.5 shadow-lg max-w-[230px] sm:max-w-[285px] w-full">
          <div className="flex items-center justify-between gap-3 mb-1.5">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-display text-xs sm:text-sm font-bold text-[#f8f5ee] truncate">
                  {player.name}
                </span>
                <span className="font-mono-num text-[11px] font-bold text-[#e5a93c] whitespace-nowrap shrink-0">
                  Lv {player.level}
                </span>
              </div>
              <div className="text-[10px] text-[#9fb0c7] truncate">
                {spec.name} · {zoneName}
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono-num text-[#d7dfec] shrink-0">
              <span className="flex items-center gap-1 whitespace-nowrap">
                <Coins className="w-3.5 h-3.5 text-[#fbbf24]" />
                {player.gold}
              </span>
              <span className="flex items-center gap-1 whitespace-nowrap">
                <Swords className="w-3.5 h-3.5 text-[#f43f5e]" />
                {player.kills}
              </span>
            </div>
          </div>

          {/* HP Bar */}
          <div className="mb-1">
            <div className="flex justify-between text-[10px] font-mono-num text-[#f8f5ee]/90 mb-0.5">
              <span>HP</span>
              <span>
                {Math.round(player.hp)}/{Math.round(player.maxHp)}
              </span>
            </div>
            <div className="h-2 sm:h-2.5 rounded-full bg-[#1a2230] overflow-hidden border border-white/10">
              <div
                className="h-full bg-[#e11d48] transition-[width] duration-150"
                style={{ width: `${hpPct}%` }}
              />
            </div>
          </div>

          {/* Mana + Stamina + XP Strip */}
          <div className="grid grid-cols-3 gap-1.5">
            <div className="h-1.5 rounded-full bg-[#1a2230] overflow-hidden" title="Mana">
              <div
                className="h-full bg-[#0ea5e9] transition-[width] duration-150"
                style={{ width: `${manaPct}%` }}
              />
            </div>
            <div className="h-1.5 rounded-full bg-[#1a2230] overflow-hidden" title="Stamina">
              <div
                className="h-full bg-[#34d399] transition-[width] duration-150"
                style={{ width: `${staminaPct}%` }}
              />
            </div>
            <div className="h-1.5 rounded-full bg-[#1a2230] overflow-hidden" title="XP">
              <div
                className="h-full bg-[#eab308] transition-[width] duration-150"
                style={{ width: `${xpPct}%` }}
              />
            </div>
          </div>

          {(player.whetstoneActive || (player.oilCharges ?? 0) > 0 || (player.boltAmmo ?? 0) > 0) && (
            <div className="mt-1.5 pt-1 border-t border-white/10 text-[10px] font-mono-num text-[#fde047] flex flex-wrap gap-x-2">
              {player.whetstoneActive && <span>Honed +15%</span>}
              {(player.oilCharges ?? 0) > 0 && <span>Oil x{player.oilCharges}</span>}
              {(player.boltAmmo ?? 0) > 0 && <span>Bolts x{player.boltAmmo}</span>}
            </div>
          )}

          {/* Static Realm Sync Readout (No Pulsing Dots) */}
          <div className="mt-1.5 hidden sm:flex items-center justify-between gap-2 text-[10px] text-[#9fb0c7]">
            <span className="flex items-center gap-1 whitespace-nowrap">
              <Users className="w-3 h-3 text-[#34d399]" />
              {onlineCount} Online
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <Database className="w-3 h-3 text-[#38bdf8]" />
              {dbMode === 'turso-cloud'
                ? 'Turso Cloud'
                : dbMode === 'turso-replica'
                  ? 'Turso Sync'
                  : 'libSQL Sync'}
            </span>
            <span className="font-mono-num whitespace-nowrap text-[#34d399]">
              Shrines {solisShrines}/3
            </span>
          </div>

          {player.activeBuffs && player.activeBuffs.some((b) => b.expiresAt > serverTime) && (
            <div
              data-testid="hud-active-buffs"
              className="mt-1.5 pt-1.5 border-t border-white/10 text-[10px] font-mono-num text-[#38bdf8] flex flex-wrap gap-x-2.5 gap-y-0.5"
            >
              {player.activeBuffs
                .filter((b) => b.expiresAt > serverTime)
                .map((b) => {
                  const sec = Math.max(0, Math.ceil((b.expiresAt - serverTime) / 1000));
                  const mins = Math.floor(sec / 60);
                  const rem = String(sec % 60).padStart(2, '0');
                  return (
                    <span key={b.kind} className="whitespace-nowrap">
                      {b.kind === 'swiftness' ? 'Windwalker' : 'Fury'} {mins}:{rem}
                    </span>
                  );
                })}
            </div>
          )}
        </div>

          {/* Collapsible Diegetic Quest Tracker (Desktop/Tablet + Compact Tap Strip on Mobile) */}
          {visibleTrackerQuests.length > 0 && (
            <div
              data-testid="quest-tracker"
              className="pointer-events-auto hidden sm:block rounded-xl bg-[#0d121c]/86 border border-[#e5a93c]/22 px-3 py-2 shadow-lg w-[260px]"
            >
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={onOpenQuests}
                  className="flex items-center gap-1.5 text-xs font-display font-bold text-[#e5a93c] hover:text-[#fde047] cursor-pointer min-h-[28px]"
                >
                  <ScrollText className="w-3.5 h-3.5" />
                  <span>Quests</span>
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setTrackerExpanded((v) => !v)}
                  aria-label="Toggle Quest Tracker"
                  className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-[#9fb0c7] cursor-pointer"
                >
                  {trackerExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {trackerExpanded && (
                <div className="mt-1.5 space-y-2">
                  {visibleTrackerQuests.map((qp) => {
                    const def = QUEST_BY_ID[qp.questId];
                    if (!def) return null;
                    const ready = qp.status === 'completed';
                    return (
                      <div
                        key={qp.questId}
                        className="rounded-lg bg-[#121927]/90 border border-white/10 px-2.5 py-1.5"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-[11px] font-semibold text-[#f8f5ee] truncate">
                            {def.title}
                          </span>
                          <span className="font-mono-num text-[10px] font-bold text-[#e5a93c] shrink-0">
                            {qp.progress}/{qp.targetCount}
                          </span>
                        </div>
                        <div className="text-[10px] text-[#9fb0c7] truncate mt-0.5">
                          {def.objectiveLabel}
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          {ready ? (
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={() => onClaimQuest(qp.questId)}
                              className="flex-1 h-7 rounded-md bg-[#34d399] hover:bg-[#4ade80] text-[#0c1018] text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Claim</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={() => onNavigateTo(def.targetX, def.targetZ)}
                              className="flex-1 h-7 rounded-md bg-[#182235] border border-white/10 hover:border-[#38bdf8] text-[#38bdf8] text-[10px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Compass className="w-3 h-3" />
                              <span>Guide</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Top-Center (Desktop/Tablet): Dynamic World Event Banner & Selected Enemy Target Plate */}
        <div className="hidden md:flex flex-col items-center gap-2 max-w-[320px]">
          {eventActive && dynamicEvent ? (
            <div
              data-testid="world-event-banner"
              className="pointer-events-auto rounded-xl bg-[#0d121c]/90 border border-[#c084fc]/50 px-3.5 py-2 shadow-lg w-full min-w-[270px]"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Zap className="w-3.5 h-3.5 text-[#c084fc] shrink-0" />
                  <span className="font-display text-xs font-bold text-[#f8f5ee] truncate">
                    {dynamicEvent.title}
                  </span>
                </div>
                <span className="font-mono-num text-[11px] font-bold text-[#fde047] shrink-0">
                  {eventMins}:{eventSecs}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[#1a2230] overflow-hidden border border-white/10 mb-1.5">
                <div
                  className="h-full bg-[#c084fc] transition-[width] duration-150"
                  style={{ width: `${eventPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between gap-2 text-[10px] text-[#b8c2d4]">
                <span className="truncate font-mono-num">
                  {dynamicEvent.zoneName} · {Math.round(dynamicEvent.progress)}/{dynamicEvent.goal} · {eventParticipants} Heroes
                </span>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => onNavigateTo(dynamicEvent.x, dynamicEvent.z)}
                  className="px-2.5 h-7 rounded-md bg-[#1d283d] border border-[#c084fc]/40 hover:border-[#c084fc] text-[#e9d5ff] font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Compass className="w-3 h-3" />
                  <span>Join</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="pointer-events-auto flex items-center gap-2 rounded-xl bg-[#0d121c]/82 border border-white/15 px-3 py-1.5 shadow-md">
              <Zap className="w-3.5 h-3.5 text-[#e5a93c]" />
              <span className="text-[11px] text-[#b8c2d4] font-mono-num whitespace-nowrap">
                Next Event {nextEventInSec}s
              </span>
              <button
                type="button"
                tabIndex={-1}
                data-testid="summon-world-event"
                onClick={onTriggerWorldEvent}
                className="px-2.5 h-7 rounded-lg bg-[#1a2436] border border-[#e5a93c]/40 hover:border-[#e5a93c] text-[11px] font-semibold text-[#e5a93c] cursor-pointer whitespace-nowrap"
              >
                Rally Event
              </button>
            </div>
          )}

          {tacticalAdvice && (tacticalAdvice.crowAlert || tacticalAdvice.threatLevel !== 'calm') && (
            <div
              data-testid="tactical-whisper"
              className="pointer-events-auto rounded-xl bg-[#0d121c]/90 border border-[#38bdf8]/40 px-3.5 py-2 shadow-lg w-full text-left"
            >
              <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-[#38bdf8]">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#f59e0b]" />
                  {tacticalAdvice.speaker}
                </span>
                <span className="capitalize text-[#fde047]">{tacticalAdvice.recommendedStance}</span>
              </div>
              <div className="text-xs font-semibold text-[#f8f5ee] mt-0.5 leading-snug">
                {tacticalAdvice.headline}
              </div>
              <div className="text-[11px] text-[#9fb0c7] mt-0.5 leading-snug">
                {tacticalAdvice.cue}
              </div>
            </div>
          )}

          {targetEnemy && (
            <div className="flex flex-col items-center pointer-events-none rounded-xl bg-[#0d121c]/90 border border-[#f43f5e]/40 px-4 py-2 shadow-lg min-w-[220px] w-full">
              <div className="flex items-center justify-between w-full gap-3 text-xs mb-1">
                <span className="font-semibold text-[#f8f5ee]">
                  {targetEnemy.isBoss ? `★ ${targetEnemy.name}` : targetEnemy.name}
                </span>
                <span className="font-mono-num text-[11px] text-[#fda4af]">
                  Lv {targetEnemy.level}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#1f1722] overflow-hidden border border-white/10">
                <div
                  className="h-full bg-[#f43f5e] transition-[width] duration-100"
                  style={{
                    width: `${Math.max(0, Math.min(100, (targetEnemy.hp / targetEnemy.maxHp) * 100))}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Top-Right: Compact Minimap & Utility Controls */}
        <div className="flex items-start gap-2 pointer-events-auto">
          {/* Live Minimap Radar (Desktop/Tablet) */}
          <div
            className="hidden sm:block w-24 h-24 rounded-xl bg-[#0d121c]/88 border border-[#e5a93c]/25 p-1 shadow-lg relative overflow-hidden"
            aria-label="Realm Minimap"
          >
            <svg viewBox="-70 -70 140 140" className="w-full h-full">
              <circle cx="0" cy="0" r="64" fill="#131c28" stroke="#e5a93c" strokeOpacity="0.25" strokeWidth="1.5" />
              <line x1="-64" y1="-4.5" x2="64" y2="-4.5" stroke="#2c83a6" strokeWidth="5" strokeOpacity="0.55" />
              <circle cx="0" cy="14" r="11" fill="#e5a93c" fillOpacity="0.16" stroke="#e5a93c" strokeOpacity="0.4" strokeWidth="1" />
              <circle cx="-24" cy="21" r="6" fill="#65a30d" fillOpacity="0.22" stroke="#84cc16" strokeOpacity="0.55" strokeWidth="1" />
              {eventActive && dynamicEvent && (
                <circle
                  cx={dynamicEvent.x}
                  cy={dynamicEvent.z}
                  r={dynamicEvent.radius}
                  fill="#c084fc"
                  fillOpacity="0.24"
                  stroke="#c084fc"
                  strokeWidth="1.6"
                />
              )}
              {trackedDef && (
                <circle
                  cx={trackedDef.targetX}
                  cy={trackedDef.targetZ}
                  r="4.5"
                  fill="none"
                  stroke="#fde047"
                  strokeWidth="1.8"
                />
              )}
              {shrines.map((s) => (
                <circle
                  key={s.id}
                  cx={s.x}
                  cy={s.z}
                  r="4.2"
                  fill={
                    s.controllingFaction === 'solis'
                      ? '#34d399'
                      : s.controllingFaction === 'rift'
                        ? '#f43f5e'
                        : '#fbbf24'
                  }
                />
              ))}
              {companions.map((c) => (
                <circle key={c.id} cx={c.x} cy={c.z} r="1.8" fill={c.accentColor} />
              ))}
              {allEnemies
                .filter((e) => e.phase !== 'ko' && !e.hiddenInCover)
                .map((e) => (
                  <circle
                    key={e.id}
                    cx={e.x}
                    cy={e.z}
                    r={e.isBoss ? 4.2 : 2.2}
                    fill={e.isBoss ? '#f59e0b' : '#fb7185'}
                  />
                ))}
              {allPlayers.map((p) => (
                <circle
                  key={p.id}
                  cx={p.x}
                  cy={p.z}
                  r={p.id === player.id ? 4.2 : 3.2}
                  fill={p.id === player.id ? '#ffffff' : '#38bdf8'}
                  stroke="#0c1018"
                  strokeWidth="1.2"
                />
              ))}
            </svg>
          </div>

          {/* Utility Square Icon Buttons */}
          <div className="flex flex-wrap sm:flex-col gap-1.5">
            <div className="flex gap-1.5">
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleMute();
                }}
                title="Mute [M]"
                className="w-11 h-11 rounded-xl bg-[#0d121c]/88 border border-white/15 hover:border-[#e5a93c]/60 flex items-center justify-center text-[#f8f5ee] cursor-pointer"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onPause();
                }}
                title="Pause [Esc]"
                className="w-11 h-11 rounded-xl bg-[#0d121c]/88 border border-white/15 hover:border-[#e5a93c]/60 flex items-center justify-center text-[#f8f5ee] cursor-pointer"
              >
                <Pause className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onOpenInventory();
                }}
                title="Pack & Leaderboard [I]"
                className="w-11 h-11 rounded-xl bg-[#0d121c]/88 border border-white/15 hover:border-[#e5a93c]/60 flex items-center justify-center text-[#e5a93c] cursor-pointer"
              >
                <Backpack className="w-4 h-4" />
              </button>
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  setChatOpen((v) => !v);
                }}
                title="Realm Chat"
                className="w-11 h-11 rounded-xl bg-[#0d121c]/88 border border-white/15 hover:border-[#e5a93c]/60 flex items-center justify-center text-[#38bdf8] cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            </div>
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                tabIndex={-1}
                data-testid="open-camp-drawer"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onOpenCamp();
                }}
                title="Camp, Warband & Two Ways [C]"
                className="w-11 h-11 rounded-xl bg-[#0d121c]/88 border border-[#38bdf8]/40 hover:border-[#38bdf8] flex items-center justify-center text-[#38bdf8] cursor-pointer"
              >
                <Shield className="w-4 h-4" />
              </button>
              <button
                type="button"
                tabIndex={-1}
                data-testid="open-storefront"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onOpenStore();
                }}
                title="Armory, Pass & Ad Blessings [B]"
                className="w-11 h-11 rounded-xl bg-[#0d121c]/88 border border-[#e5a93c]/40 hover:border-[#e5a93c] flex items-center justify-center text-[#e5a93c] cursor-pointer"
              >
                <Crown className="w-4 h-4" />
              </button>
              <button
                type="button"
                tabIndex={-1}
                data-testid="open-quest-journal"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onOpenQuests();
                }}
                title="Quest Chronicle [J]"
                className={`w-11 h-11 rounded-xl bg-[#0d121c]/88 border flex items-center justify-center cursor-pointer ${
                  readyQuestCount > 0
                    ? 'border-[#34d399] text-[#34d399]'
                    : 'border-white/15 hover:border-[#e5a93c]/60 text-[#fde047]'
                }`}
              >
                <ScrollText className="w-4 h-4" />
              </button>
              <button
                type="button"
                tabIndex={-1}
                data-atmo-toggle="true"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleAtmosphere();
                }}
                title="Atmosphere & Shaders"
                className={`w-11 h-11 rounded-xl bg-[#0d121c]/88 border flex items-center justify-center cursor-pointer ${
                  atmosphereOpen
                    ? 'border-[#e5a93c] text-[#e5a93c]'
                    : 'border-white/15 hover:border-[#e5a93c]/60 text-[#f8f5ee]'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Compact Mobile World Event Strip */}
      {eventActive && dynamicEvent && !atmosphereOpen && (
        <div className="md:hidden pointer-events-auto self-center w-full max-w-[340px] rounded-xl bg-[#0d121c]/88 border border-[#c084fc]/45 px-3 py-1.5 flex items-center justify-between gap-2 shadow-lg">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#c084fc] shrink-0" />
              <span className="text-[11px] font-bold text-[#f8f5ee] truncate">{dynamicEvent.title}</span>
              <span className="font-mono-num text-[10px] text-[#fde047] shrink-0">
                {eventMins}:{eventSecs}
              </span>
            </div>
            <div className="text-[10px] font-mono-num text-[#b8c2d4] truncate">
              {Math.round(dynamicEvent.progress)}/{dynamicEvent.goal} · {dynamicEvent.zoneName}
            </div>
          </div>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => onNavigateTo(dynamicEvent.x, dynamicEvent.z)}
            className="h-11 px-3 rounded-lg bg-[#1d283d] border border-[#c084fc]/45 text-[#e9d5ff] text-xs font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Join</span>
          </button>
        </div>
      )}

      {/* Collapsible Atmosphere, Weather & Shader Pipeline Panel */}
      {atmosphereOpen && (
        <div
          data-atmo-panel="true"
          className="pointer-events-auto self-end mr-0 sm:mr-1 rounded-2xl bg-[#0d121c]/95 border border-[#e5a93c]/35 p-3.5 shadow-2xl w-[285px] sm:w-[310px] space-y-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-display font-bold text-[#f8f5ee]">
                Atmosphere &amp; Shaders
              </div>
              <div className="text-[10px] text-[#9fb0c7] font-mono-num">
                {graphicsStatus
                  ? `${graphicsStatus.todLabel} · ${graphicsStatus.resolvedWeather} · Tier ${graphicsStatus.profile.tier.toUpperCase()}`
                  : 'Pipeline Active'}
              </div>
            </div>
            <button
              type="button"
              tabIndex={-1}
              onClick={onToggleAtmosphere}
              className="w-7 h-7 rounded-lg bg-[#161f30] border border-white/15 flex items-center justify-center text-[#9fb0c7] hover:text-[#f8f5ee] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Time of Day */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9fb0c7] mb-1.5 flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#e5a93c]" />
              Time of Day
            </div>
            <div className="grid grid-cols-5 gap-1">
              {(['auto', 'dawn', 'day', 'dusk', 'night'] as TimeOfDayMode[]).map((tod) => (
                <button
                  key={tod}
                  type="button"
                  tabIndex={-1}
                  onClick={() => onUpdateGraphics((prev) => ({ ...prev, timeOfDay: tod }))}
                  className={`h-7 rounded-lg text-[11px] font-semibold capitalize border cursor-pointer ${
                    graphicsSettings.timeOfDay === tod
                      ? 'bg-[#e5a93c] text-[#0c1018] border-[#e5a93c]'
                      : 'bg-[#141c2c] text-[#d7dfec] border-white/10 hover:border-white/30'
                  }`}
                >
                  {tod}
                </button>
              ))}
            </div>
          </div>

          {/* Weather & Surface States */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9fb0c7] mb-1.5 flex items-center gap-1">
              <Sun className="w-3 h-3 text-[#38bdf8]" />
              Weather &amp; Surface State
            </div>
            <div className="grid grid-cols-5 gap-1">
              {(
                [
                  { id: 'auto', label: 'Auto', icon: Clock },
                  { id: 'clear', label: 'Clear', icon: Sun },
                  { id: 'rain', label: 'Rain', icon: CloudRain },
                  { id: 'snow', label: 'Snow', icon: Snowflake },
                  { id: 'corruption', label: 'Rift', icon: Sparkles },
                ] as const
              ).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  tabIndex={-1}
                  onClick={() => onUpdateGraphics((prev) => ({ ...prev, weather: id as WeatherMode }))}
                  className={`h-9 rounded-lg text-[10px] font-semibold border flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                    graphicsSettings.weather === id
                      ? 'bg-[#38bdf8] text-[#0c1018] border-[#38bdf8]'
                      : 'bg-[#141c2c] text-[#d7dfec] border-white/10 hover:border-white/30'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Hardware Quality Scaling */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9fb0c7] mb-1.5 flex items-center justify-between">
              <span>Hardware Scaling</span>
              <span className="font-mono-num text-[#34d399]">
                {graphicsStatus?.isSoftwareGl ? 'Software GL' : 'GPU Accelerated'}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {(['auto', 'low', 'medium', 'high'] as GraphicsQuality[]).map((q) => (
                <button
                  key={q}
                  type="button"
                  tabIndex={-1}
                  onClick={() => onUpdateGraphics((prev) => ({ ...prev, quality: q }))}
                  className={`h-7 rounded-lg text-[11px] font-semibold capitalize border cursor-pointer ${
                    graphicsSettings.quality === q
                      ? 'bg-[#34d399] text-[#0c1018] border-[#34d399]'
                      : 'bg-[#141c2c] text-[#d7dfec] border-white/10 hover:border-white/30'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Configurable Post-Processing Stack */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#9fb0c7] mb-1.5">
              Post-Processing Stack
            </div>
            <div className="grid grid-cols-3 gap-1">
              {(
                [
                  { key: 'bloom', label: 'Bloom' },
                  { key: 'outlines', label: 'Outlines' },
                  { key: 'colorGrading', label: 'Grading' },
                ] as const
              ).map(({ key, label }) => {
                const active = graphicsSettings.postProcess[key];
                return (
                  <button
                    key={key}
                    type="button"
                    tabIndex={-1}
                    onClick={() =>
                      onUpdateGraphics((prev) => ({
                        ...prev,
                        postProcess: { ...prev.postProcess, [key]: !prev.postProcess[key] },
                      }))
                    }
                    className={`h-7 rounded-lg text-[11px] font-semibold border cursor-pointer ${
                      active
                        ? 'bg-[#1d2c44] text-[#f8f5ee] border-[#e5a93c]/60'
                        : 'bg-[#090d14] text-[#6b7b94] border-white/10'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM ROW: Chat Drawer (Left) + Desktop Skill Dock (Center) */}
      <div className="flex items-end justify-between gap-4">
        {/* Collapsible Realm Chat */}
        <div className="hidden md:block w-72 pointer-events-auto">
          {chatOpen && (
            <div className="rounded-xl bg-[#0d121c]/90 border border-white/15 p-2.5 shadow-xl">
              <div className="h-32 overflow-y-auto custom-scrollbar space-y-1 text-xs mb-2 pr-1">
                {chatMessages.map((m) => (
                  <div key={m.id} className="leading-snug">
                    <span
                      className={
                        m.heroClass === 'system'
                          ? 'text-[#e5a93c] font-semibold'
                          : 'text-[#38bdf8] font-semibold'
                      }
                    >
                      {m.sender}:{' '}
                    </span>
                    <span className="text-[#e2e8f0]">{m.text}</span>
                  </div>
                ))}
              </div>
              <form onSubmit={submitChat} className="flex gap-1.5">
                <input
                  type="text"
                  maxLength={140}
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value)}
                  placeholder="Say to realm..."
                  className="flex-1 h-8 px-2.5 rounded-lg bg-[#080b12] border border-white/15 text-xs text-[#f8f5ee] focus:outline-none focus:border-[#e5a93c]"
                />
                <button
                  type="submit"
                  className="w-8 h-8 rounded-lg bg-[#e5a93c] text-[#0c1018] flex items-center justify-center cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Desktop Center Skill, Stance & Mount Dock */}
        <div className="hidden md:flex flex-col items-center gap-1.5 pointer-events-auto mx-auto">
          <div className="flex items-center gap-1.5 rounded-xl bg-[#0d121c]/88 border border-white/15 px-2.5 py-1 shadow-lg">
            {(['heavy', 'balanced', 'swift'] as CombatStance[]).map((st) => {
              const mod = STANCE_MODIFIERS[st];
              const isSelected = activeStance === st;
              return (
                <button
                  key={st}
                  type="button"
                  tabIndex={-1}
                  data-testid={`stance-${st}`}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onSetStance(st);
                  }}
                  title={mod.shortNote}
                  className={`min-h-[34px] px-2.5 rounded-lg text-[11px] font-semibold border cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#e5a93c] text-[#0c1018] border-[#e5a93c]'
                      : 'bg-[#121926] text-[#cbd5e1] border-white/10 hover:border-white/30'
                  }`}
                >
                  {mod.label}
                </button>
              );
            })}

            <div className="w-px h-5 bg-white/15 mx-0.5" />

            <button
              type="button"
              tabIndex={-1}
              data-testid="toggle-mount-btn"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMount();
              }}
              className={`min-h-[34px] px-2.5 rounded-lg text-[11px] font-semibold border cursor-pointer ${
                player.mounted
                  ? 'bg-[#1e2d44] text-[#fde047] border-[#e5a93c]/60'
                  : 'bg-[#121926] text-[#cbd5e1] border-white/10 hover:border-white/30'
              }`}
            >
              {player.mounted ? 'Dismount [G]' : 'Mount [G]'}
            </button>

            {player.mounted && (
              <>
                {(['dash', 'turn', 'spin'] as MountedManeuverKind[]).map((mv) => (
                  <button
                    key={mv}
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onMountedManeuver(mv);
                    }}
                    className="min-h-[34px] px-2 rounded-lg bg-[#192438] border border-[#38bdf8]/40 hover:border-[#38bdf8] text-[11px] font-semibold text-[#e0f2fe] capitalize cursor-pointer"
                  >
                    {mv}
                  </button>
                ))}
              </>
            )}

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenCamp();
              }}
              className="min-h-[34px] px-2.5 rounded-lg bg-[#121926] border border-[#38bdf8]/35 hover:border-[#38bdf8] text-[11px] font-semibold text-[#38bdf8] flex items-center gap-1 cursor-pointer"
            >
              <Hammer className="w-3 h-3" />
              <span>Camp [C]</span>
            </button>
          </div>

          <div className="flex items-center gap-2 rounded-2xl bg-[#0d121c]/90 border border-[#e5a93c]/25 px-3 py-2 shadow-2xl">
          {spec.skills.map((skill) => {
            const cd = player.cooldowns[skill.index];
            const onCd = cd > 0.05;
            const lowMana = player.mana < skill.manaCost;
            return (
              <button
                key={skill.index}
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onCastSkill(skill.index);
                }}
                disabled={onCd || lowMana}
                className={`relative min-w-[116px] h-14 px-3 rounded-xl border text-left transition-colors cursor-pointer ${
                  onCd || lowMana
                    ? 'bg-[#090d14] border-white/10 opacity-60'
                    : 'bg-[#141c2c] border-[#e5a93c]/35 hover:border-[#e5a93c]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono-num text-[11px] font-bold text-[#e5a93c]">
                    [{skill.keyLabel}]
                  </span>
                  {onCd ? (
                    <span className="font-mono-num text-xs font-bold text-[#f8f5ee]">
                      {cd.toFixed(1)}s
                    </span>
                  ) : skill.manaCost > 0 ? (
                    <span className="font-mono-num text-[10px] text-[#38bdf8]">
                      {skill.manaCost} MP
                    </span>
                  ) : null}
                </div>
                <div className="text-xs font-semibold text-[#f8f5ee] truncate mt-0.5">
                  {skill.name}
                </div>
                <div className="text-[10px] text-[#9fb0c7] truncate">{skill.role}</div>
              </button>
            );
          })}

          <div className="w-px h-10 bg-white/10 mx-0.5" />

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onDash();
            }}
            disabled={player.dashCooldown > 0.05}
            className="h-14 px-3 rounded-xl bg-[#141c2c] border border-white/15 hover:border-[#38bdf8] disabled:opacity-55 flex flex-col justify-center items-center min-w-[72px] cursor-pointer"
          >
            <div className="flex items-center gap-1 text-xs font-semibold text-[#f8f5ee]">
              <Wind className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span>Dash</span>
            </div>
            <span className="font-mono-num text-[10px] text-[#9fb0c7]">
              {player.dashCooldown > 0.05 ? `${player.dashCooldown.toFixed(1)}s` : 'Space'}
            </span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onUsePotion();
            }}
            disabled={player.potions <= 0}
            className="h-14 px-3 rounded-xl bg-[#141c2c] border border-white/15 hover:border-[#34d399] disabled:opacity-50 flex flex-col justify-center items-center min-w-[72px] cursor-pointer"
          >
            <div className="flex items-center gap-1 text-xs font-semibold text-[#f8f5ee]">
              <FlaskConical className="w-3.5 h-3.5 text-[#34d399]" />
              <span className="font-mono-num">x{player.potions}</span>
            </div>
            <span className="font-mono-num text-[10px] text-[#9fb0c7]">Flask [F]</span>
          </button>

          <div className="hidden lg:flex gap-1 ml-1">
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onRotateCam(-Math.PI / 6);
              }}
              title="Rotate Camera Left [Q]"
              className="w-9 h-14 rounded-lg bg-[#101624] border border-white/10 hover:border-white/30 flex items-center justify-center text-[#9fb0c7] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onRotateCam(Math.PI / 6);
              }}
              title="Rotate Camera Right [E]"
              className="w-9 h-14 rounded-lg bg-[#101624] border border-white/10 hover:border-white/30 flex items-center justify-center text-[#9fb0c7] cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        </div>

        <div className="hidden md:block w-24" />
      </div>
    </div>
  );
}
