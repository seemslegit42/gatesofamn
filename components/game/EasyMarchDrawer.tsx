'use client';

import React, { useState } from 'react';
import {
  X,
  Hammer,
  Flame,
  HeartPulse,
  Shield,
  Users,
  Sparkles,
  CheckCircle2,
  Zap,
  Crosshair,
} from 'lucide-react';
import type {
  ArblastBoltKind,
  CombatStance,
  PlayerPhilosophyState,
  PrepCampAction,
  SnapshotCompanion,
  SnapshotPlayer,
  TacticalAdvice,
  WeaponOilKind,
} from '@/lib/game/types';
import {
  ARBLAST_BOLT_SPECS,
  ENCOUNTER_DILEMMAS,
  PHILOSOPHY_ABILITIES,
  WEAPON_OIL_SPECS,
  getDominantPhilosophy,
} from '@/lib/game/philosophy';

interface EasyMarchDrawerProps {
  open: boolean;
  player: SnapshotPlayer | null;
  philosophy: PlayerPhilosophyState;
  companions: SnapshotCompanion[];
  tacticalAdvice: TacticalAdvice | null;
  serverTime: number;
  notice: string | null;
  onClose: () => void;
  onCampPrep: (action: PrepCampAction) => void;
  onResolveDilemma: (dilemmaId: string, optionId: string) => void;
  onUsePathAbility: (abilityId: string) => void;
  onSetStance: (stance: CombatStance) => void;
  onOpenStore?: () => void;
}

type DrawerTab = 'camp' | 'ways' | 'warband';

export default function EasyMarchDrawer({
  open,
  player,
  philosophy,
  companions,
  tacticalAdvice,
  serverTime,
  notice,
  onClose,
  onCampPrep,
  onResolveDilemma,
  onUsePathAbility,
  onSetStance,
  onOpenStore,
}: EasyMarchDrawerProps) {
  const [tab, setTab] = useState<DrawerTab>('camp');

  if (!open || !player) return null;

  const dominant = getDominantPhilosophy(philosophy);
  const whetstoneSec =
    philosophy.whetstoneExpiresAt > serverTime
      ? Math.ceil((philosophy.whetstoneExpiresAt - serverTime) / 1000)
      : 0;
  const totalAffinity = Math.max(1, philosophy.athelstaneAffinity + philosophy.graymstrumAffinity);
  const athelstanePct = Math.round((philosophy.athelstaneAffinity / totalAffinity) * 100);

  return (
    <div
      data-testid="easymarch-drawer"
      className="fixed inset-0 z-40 bg-[#070a10]/85 flex items-center justify-center p-3 sm:p-6"
    >
      <div className="w-full max-w-3xl max-h-[88vh] rounded-2xl bg-[#0d121c] border border-[#e5a93c]/35 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-white/10 bg-[#0a0f18]">
          <div>
            <h2 className="font-display text-base sm:text-lg font-bold text-[#f8f5ee]">
              Barrowlands Command &amp; Camp
            </h2>
            <p className="text-xs text-[#9fb0c7] font-mono-num">
              {player.gold} Gold · {philosophy.potentialScore} Potential · Stamina{' '}
              {Math.round(player.stamina ?? philosophy.stamina)}/{player.maxStamina ?? 100}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Camp Drawer"
            className="w-11 h-11 rounded-xl bg-[#151d2e] border border-white/15 hover:border-[#e5a93c]/60 flex items-center justify-center text-[#f8f5ee] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 gap-2 px-4 sm:px-6 py-2.5 bg-[#0b1019] border-b border-white/10">
          {(
            [
              { id: 'camp', label: 'Preparation Camp', icon: Hammer },
              { id: 'ways', label: 'The Two Ways', icon: Shield },
              { id: 'warband', label: `Warband (${companions.length})`, icon: Users },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              data-testid={`easymarch-tab-${id}`}
              onClick={() => setTab(id)}
              className={`min-h-[44px] px-3 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                tab === id
                  ? 'bg-[#e5a93c] text-[#0c1018] border-[#e5a93c]'
                  : 'bg-[#131b2b] text-[#d7dfec] border-white/10 hover:border-white/30'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>

        {notice && (
          <div
            data-testid="easymarch-notice"
            className="mx-4 sm:mx-6 mt-3 rounded-xl bg-[#132033] border border-[#38bdf8]/40 px-3.5 py-2 text-xs text-[#e0f2fe]"
          >
            {notice}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {tab === 'camp' && (
            <>
              {/* Graymstrum Tactical Synthesizer Assessment */}
              {tacticalAdvice && (
                <div className="rounded-xl bg-[#111928] border border-[#38bdf8]/35 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-xs font-display font-bold text-[#38bdf8]">
                      {tacticalAdvice.speaker} · Battlefield Assessment
                    </div>
                    <div className="text-sm font-semibold text-[#f8f5ee]">
                      {tacticalAdvice.headline}
                    </div>
                    <div className="text-xs text-[#9fb0c7]">{tacticalAdvice.cue}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSetStance(tacticalAdvice.recommendedStance)}
                    className="min-h-[44px] px-4 rounded-xl bg-[#18263d] border border-[#38bdf8]/50 hover:border-[#38bdf8] text-xs font-semibold text-[#e0f2fe] shrink-0 cursor-pointer"
                  >
                    Adopt {tacticalAdvice.recommendedStance} Stance
                  </button>
                </div>
              )}

              {/* Whetstone & Field Triage */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl bg-[#121926] border border-white/10 p-4 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-sm font-bold text-[#fde047] flex items-center gap-1.5">
                        <Hammer className="w-4 h-4" />
                        Whetstone Honing
                      </span>
                      {whetstoneSec > 0 && (
                        <span className="font-mono-num text-xs font-bold text-[#34d399]">
                          {whetstoneSec}s left
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#9fb0c7] mt-1">
                      Sharpen steel before contact for +15% weapon damage over 2 minutes.
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid="camp-whetstone-btn"
                    onClick={() => onCampPrep({ kind: 'whetstone' })}
                    className="min-h-[44px] w-full rounded-xl bg-[#e5a93c] hover:bg-[#f0b94d] text-[#0c1018] text-xs font-bold cursor-pointer"
                  >
                    Sharpen Blade (Free)
                  </button>
                </div>

                <div className="rounded-xl bg-[#121926] border border-white/10 p-4 flex flex-col justify-between gap-3">
                  <div>
                    <span className="font-display text-sm font-bold text-[#34d399] flex items-center gap-1.5">
                      <HeartPulse className="w-4 h-4" />
                      Graymstrum’s Field Triage
                    </span>
                    <p className="text-xs text-[#9fb0c7] mt-1">
                      Pitch-resin dressings restore 40% HP and full Stamina immediately.
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid="camp-triage-btn"
                    onClick={() => onCampPrep({ kind: 'field_triage' })}
                    className="min-h-[44px] w-full rounded-xl bg-[#163029] border border-[#34d399]/50 hover:border-[#34d399] text-[#d1fae5] text-xs font-bold cursor-pointer"
                  >
                    Bind Wounds (10 Potential or 15 Gold)
                  </button>
                </div>
              </div>

              {/* Weapon Oils */}
              <div>
                <h3 className="font-display text-sm font-bold text-[#f8f5ee] mb-2 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-[#fb923c]" />
                  Weapon Oils &amp; Resins
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(Object.keys(WEAPON_OIL_SPECS) as Exclude<WeaponOilKind, 'none'>[]).map((key) => {
                    const spec = WEAPON_OIL_SPECS[key];
                    const active = philosophy.weaponOil === key && philosophy.oilCharges > 0;
                    return (
                      <div
                        key={key}
                        className={`rounded-xl border p-3 flex flex-col justify-between gap-2.5 ${
                          active
                            ? 'bg-[#192334] border-[#fb923c]/60'
                            : 'bg-[#121926] border-white/10'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold" style={{ color: spec.color }}>
                              {spec.name}
                            </span>
                            {active && (
                              <span className="font-mono-num text-[11px] text-[#fde047]">
                                x{philosophy.oilCharges}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#9fb0c7] mt-1">{spec.description}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onCampPrep({ kind: 'apply_oil', oil: key })}
                          className="min-h-[44px] rounded-xl bg-[#1a2436] border border-white/15 hover:border-[#fb923c] text-xs font-semibold text-[#f8f5ee] cursor-pointer font-mono-num"
                        >
                          Coat Blade · {spec.goldCost}g
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Arblast Bolt Quiver */}
              <div>
                <h3 className="font-display text-sm font-bold text-[#f8f5ee] mb-2 flex items-center gap-1.5">
                  <Crosshair className="w-4 h-4 text-[#38bdf8]" />
                  Arblast Bolts (Shared with Krydon &amp; Hellas)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(Object.keys(ARBLAST_BOLT_SPECS) as Exclude<ArblastBoltKind, 'standard'>[]).map(
                    (key) => {
                      const spec = ARBLAST_BOLT_SPECS[key];
                      const active = philosophy.arblastBolt === key && philosophy.boltAmmo > 0;
                      return (
                        <div
                          key={key}
                          className={`rounded-xl border p-3.5 flex flex-col justify-between gap-2.5 ${
                            active
                              ? 'bg-[#192334] border-[#38bdf8]/60'
                              : 'bg-[#121926] border-white/10'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold" style={{ color: spec.color }}>
                                {spec.name}
                              </span>
                              {active && (
                                <span className="font-mono-num text-xs text-[#fde047]">
                                  {philosophy.boltAmmo} bolts loaded
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-[#9fb0c7] mt-1">{spec.description}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => onCampPrep({ kind: 'craft_bolts', bolt: key })}
                            className="min-h-[44px] rounded-xl bg-[#1a2436] border border-white/15 hover:border-[#38bdf8] text-xs font-semibold text-[#f8f5ee] cursor-pointer font-mono-num"
                          >
                            Fletch +{spec.ammoGrant} ({spec.potentialCost} Potential / {spec.goldCost}g)
                          </button>
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
            </>
          )}

          {tab === 'ways' && (
            <>
              {/* Philosophy Alignment Bar */}
              <div className="rounded-xl bg-[#121926] border border-[#e5a93c]/25 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-[#f59e0b] font-mono-num">
                    Athelstane’s Way · {philosophy.athelstaneAffinity}
                  </span>
                  <span className="text-[#f8f5ee]">
                    {dominant === 'athelstane'
                      ? 'Iron Vanguard'
                      : dominant === 'graymstrum'
                        ? 'Measured Tactician'
                        : 'Balanced March'}
                  </span>
                  <span className="text-[#38bdf8] font-mono-num">
                    Graymstrum’s Way · {philosophy.graymstrumAffinity}
                  </span>
                </div>
                <div className="h-3 rounded-full bg-[#1b2435] overflow-hidden border border-white/10 flex">
                  <div
                    className="h-full bg-[#f59e0b] transition-[width] duration-200"
                    style={{ width: `${athelstanePct}%` }}
                  />
                  <div
                    className="h-full bg-[#38bdf8] transition-[width] duration-200"
                    style={{ width: `${100 - athelstanePct}%` }}
                  />
                </div>
                <p className="text-xs text-[#9fb0c7]">
                  Shape your march through Barrowlands dilemmas to unlock signature warband maneuvers.
                </p>
              </div>

              {/* Active Path Abilities */}
              <div>
                <h3 className="font-display text-sm font-bold text-[#f8f5ee] mb-2 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-[#e5a93c]" />
                  Path Techniques
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {PHILOSOPHY_ABILITIES.map((ab) => {
                    const aff =
                      ab.path === 'athelstane'
                        ? philosophy.athelstaneAffinity
                        : philosophy.graymstrumAffinity;
                    const unlocked = aff >= ab.unlockAffinity;
                    const readyAt = philosophy.pathAbilityCooldowns[ab.id] ?? 0;
                    const cdRem = readyAt > serverTime ? Math.ceil((readyAt - serverTime) / 1000) : 0;
                    return (
                      <div
                        key={ab.id}
                        className="rounded-xl bg-[#121926] border border-white/10 p-3.5 flex flex-col justify-between gap-2.5"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold" style={{ color: ab.accentColor }}>
                              {ab.name}
                            </span>
                            <span className="font-mono-num text-[11px] text-[#9fb0c7]">
                              {ab.staminaCost} Stam
                            </span>
                          </div>
                          <p className="text-[11px] text-[#9fb0c7] mt-1">{ab.description}</p>
                        </div>
                        <button
                          type="button"
                          disabled={!unlocked || cdRem > 0}
                          onClick={() => onUsePathAbility(ab.id)}
                          className="min-h-[44px] rounded-xl bg-[#182235] border border-white/15 hover:border-[#e5a93c] disabled:opacity-45 text-xs font-semibold text-[#f8f5ee] cursor-pointer font-mono-num"
                        >
                          {!unlocked
                            ? `Requires ${ab.unlockAffinity} ${ab.path === 'athelstane' ? 'Athelstane' : 'Graymstrum'}`
                            : cdRem > 0
                              ? `Recovering (${cdRem}s)`
                              : 'Execute Technique'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Barrowlands Dilemmas */}
              <div>
                <h3 className="font-display text-sm font-bold text-[#f8f5ee] mb-2">
                  Barrowlands Decisions
                </h3>
                <div className="space-y-3">
                  {ENCOUNTER_DILEMMAS.map((d) => {
                    const resolved = philosophy.resolvedDilemmas.includes(d.id);
                    return (
                      <div
                        key={d.id}
                        className="rounded-xl bg-[#121926] border border-white/12 p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display text-sm font-bold text-[#f8f5ee]">
                            {d.title}
                          </span>
                          {resolved && (
                            <span className="flex items-center gap-1 text-xs font-semibold text-[#34d399]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Etched
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#9fb0c7]">{d.prompt}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {d.options.map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              disabled={resolved}
                              data-testid={`dilemma-${d.id}-${opt.id}`}
                              onClick={() => onResolveDilemma(d.id, opt.id)}
                              className={`min-h-[44px] rounded-xl border p-2.5 text-left transition-colors cursor-pointer disabled:opacity-50 ${
                                opt.path === 'athelstane'
                                  ? 'bg-[#1d1712] border-[#f59e0b]/40 hover:border-[#f59e0b]'
                                  : 'bg-[#101c2a] border-[#38bdf8]/40 hover:border-[#38bdf8]'
                              }`}
                            >
                              <div className="text-xs font-bold text-[#f8f5ee]">{opt.label}</div>
                              <div className="text-[11px] text-[#9fb0c7] mt-0.5">{opt.effectText}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {tab === 'warband' && (
            <>
              <div className="rounded-xl bg-[#121926] border border-[#e5a93c]/25 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-display font-bold text-[#e5a93c]">
                    Warband Potential · {philosophy.potentialScore}
                  </div>
                  <p className="text-xs text-[#9fb0c7] mt-0.5">
                    Spend Potential at camp for incendiary bolts &amp; triage. Earn more via quests or Ad Dispatches.
                  </p>
                </div>
                {onOpenStore && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenStore();
                    }}
                    className="min-h-[44px] px-4 rounded-xl bg-[#1b273d] border border-[#e5a93c]/50 hover:border-[#e5a93c] text-xs font-semibold text-[#fde047] flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Ad Dispatches</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {companions.map((c) => {
                  const pct = Math.max(0, Math.min(100, (c.hp / Math.max(1, c.maxHp)) * 100));
                  return (
                    <div
                      key={c.id}
                      className="rounded-xl bg-[#121926] border border-white/10 p-3.5 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-display text-sm font-bold text-[#f8f5ee]">
                            {c.name}
                          </div>
                          <div className="text-[11px] text-[#9fb0c7]">
                            {c.role} · {c.mounted ? 'Mounted Warhorse' : 'On Foot'}
                          </div>
                        </div>
                        <span
                          className="text-[11px] font-semibold capitalize"
                          style={{ color: c.accentColor }}
                        >
                          {c.action.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[#1a2230] overflow-hidden border border-white/10">
                        <div
                          className="h-full transition-[width] duration-150"
                          style={{ width: `${pct}%`, backgroundColor: c.accentColor }}
                        />
                      </div>
                      <div className="text-[11px] font-mono-num text-[#9fb0c7] flex justify-between">
                        <span>Vitality</span>
                        <span>
                          {Math.round(c.hp)}/{c.maxHp}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
