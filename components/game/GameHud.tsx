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
} from 'lucide-react';
import type { ChatMessage, ShrineState, SnapshotEnemy, SnapshotPlayer } from '@/lib/game/types';
import { CLASS_SPECS } from '@/lib/game/worldData';

interface GameHudProps {
  player: SnapshotPlayer | null;
  targetEnemy: SnapshotEnemy | null;
  shrines: ShrineState[];
  allPlayers: SnapshotPlayer[];
  allEnemies: SnapshotEnemy[];
  onlineCount: number;
  dbMode: string;
  zoneName: string;
  muted: boolean;
  chatMessages: ChatMessage[];
  onToggleMute: () => void;
  onPause: () => void;
  onOpenInventory: () => void;
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
  onlineCount,
  dbMode,
  zoneName,
  muted,
  chatMessages,
  onToggleMute,
  onPause,
  onOpenInventory,
  onUsePotion,
  onCastSkill,
  onDash,
  onRotateCam,
  onSendChat,
}: GameHudProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState('');

  if (!player) return null;

  const spec = CLASS_SPECS[player.heroClass];
  const hpPct = Math.max(0, Math.min(100, (player.hp / Math.max(1, player.maxHp)) * 100));
  const manaPct = Math.max(0, Math.min(100, (player.mana / Math.max(1, player.maxMana)) * 100));
  const xpPct = Math.max(0, Math.min(100, (player.xp / Math.max(1, player.xpToNext)) * 100));
  const solisShrines = shrines.filter((s) => s.controllingFaction === 'solis').length;

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
        {/* Top-Left: Hero Vitality & Turso Realm Status */}
        <div className="pointer-events-auto rounded-xl bg-[#0d121c]/88 border border-[#e5a93c]/25 px-3 py-2 sm:px-4 sm:py-2.5 shadow-lg max-w-[230px] sm:max-w-[285px]">
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

          {/* Mana + XP Strip */}
          <div className="grid grid-cols-2 gap-1.5">
            <div className="h-1.5 rounded-full bg-[#1a2230] overflow-hidden">
              <div
                className="h-full bg-[#0ea5e9] transition-[width] duration-150"
                style={{ width: `${manaPct}%` }}
              />
            </div>
            <div className="h-1.5 rounded-full bg-[#1a2230] overflow-hidden">
              <div
                className="h-full bg-[#eab308] transition-[width] duration-150"
                style={{ width: `${xpPct}%` }}
              />
            </div>
          </div>

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
        </div>

        {/* Top-Center: Selected Enemy Target Plate */}
        {targetEnemy && (
          <div className="hidden md:flex flex-col items-center pointer-events-none rounded-xl bg-[#0d121c]/90 border border-[#f43f5e]/40 px-4 py-2 shadow-lg min-w-[220px]">
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
              {allEnemies
                .filter((e) => e.phase !== 'ko')
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
          </div>
        </div>
      </div>

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

        {/* Desktop Center Skill & Action Dock */}
        <div className="hidden md:flex items-center gap-2 pointer-events-auto mx-auto rounded-2xl bg-[#0d121c]/90 border border-[#e5a93c]/25 px-3 py-2 shadow-2xl">
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

        <div className="hidden md:block w-24" />
      </div>
    </div>
  );
}
