import type {
  ArblastBoltKind,
  CombatStance,
  PhilosophicalPath,
  PlayerPhilosophyState,
  WeaponOilKind,
} from './types.ts';

export interface StanceModifier {
  id: CombatStance;
  label: string;
  shortNote: string;
  damageMult: number;
  cooldownMult: number;
  moveSpeedMult: number;
  knockbackMult: number;
  staminaCost: number;
  accentColor: string;
}

export const STANCE_MODIFIERS: Record<CombatStance, StanceModifier> = {
  heavy: {
    id: 'heavy',
    label: 'Heavy',
    shortNote: '+35% Power & Knockback · Slower Cadence',
    damageMult: 1.35,
    cooldownMult: 1.24,
    moveSpeedMult: 0.88,
    knockbackMult: 1.85,
    staminaCost: 14,
    accentColor: '#f59e0b',
  },
  balanced: {
    id: 'balanced',
    label: 'Balanced',
    shortNote: 'Steady Poise & Footwork',
    damageMult: 1.0,
    cooldownMult: 1.0,
    moveSpeedMult: 1.0,
    knockbackMult: 1.0,
    staminaCost: 8,
    accentColor: '#38bdf8',
  },
  swift: {
    id: 'swift',
    label: 'Swift',
    shortNote: '+24% Cadence & Stride · Light Cuts',
    damageMult: 0.84,
    cooldownMult: 0.76,
    moveSpeedMult: 1.14,
    knockbackMult: 0.65,
    staminaCost: 6,
    accentColor: '#34d399',
  },
};

export interface PhilosophyAbilityDef {
  id: string;
  path: PhilosophicalPath;
  name: string;
  unlockAffinity: number;
  cooldownSec: number;
  staminaCost: number;
  description: string;
  accentColor: string;
}

export const PHILOSOPHY_ABILITIES: PhilosophyAbilityDef[] = [
  {
    id: 'unstoppable_charge',
    path: 'athelstane',
    name: 'Unstoppable Charge',
    unlockAffinity: 0,
    cooldownSec: 8,
    staminaCost: 24,
    description: 'Bull through foes in a shattering line, hurling them back with heavy momentum.',
    accentColor: '#f59e0b',
  },
  {
    id: 'battle_roar',
    path: 'athelstane',
    name: 'Battle Roar',
    unlockAffinity: 15,
    cooldownSec: 12,
    staminaCost: 26,
    description: 'Bellow a resonant challenge that staggers nearby enemies and bolsters your strike.',
    accentColor: '#ef4444',
  },
  {
    id: 'brutal_execution',
    path: 'athelstane',
    name: 'Brutal Execution',
    unlockAffinity: 30,
    cooldownSec: 14,
    staminaCost: 32,
    description: 'Crushing overhead blow dealing bonus execution damage to wounded foes.',
    accentColor: '#fb7185',
  },
  {
    id: 'plausible_lie',
    path: 'graymstrum',
    name: 'Plausible Lie',
    unlockAffinity: 0,
    cooldownSec: 12,
    staminaCost: 18,
    description: 'Broadcast a calculated feint that scrambles ambushers into hesitation & retreat.',
    accentColor: '#38bdf8',
  },
  {
    id: 'field_triage',
    path: 'graymstrum',
    name: 'Field Triage',
    unlockAffinity: 15,
    cooldownSec: 11,
    staminaCost: 20,
    description: 'Bind wounds with pitch-resin salve, restoring hero & nearby warband vitality.',
    accentColor: '#34d399',
  },
  {
    id: 'tactical_barrage',
    path: 'graymstrum',
    name: 'Arblast Suppression',
    unlockAffinity: 30,
    cooldownSec: 10,
    staminaCost: 22,
    description: 'Command Krydon & Hellas to loose concentrated iron-tipped bolts on your target.',
    accentColor: '#c084fc',
  },
];

export interface EncounterDilemmaOption {
  id: string;
  path: PhilosophicalPath;
  label: string;
  affinityDelta: number;
  effectText: string;
}

export interface EncounterDilemmaDef {
  id: string;
  title: string;
  prompt: string;
  options: [EncounterDilemmaOption, EncounterDilemmaOption];
}

export const ENCOUNTER_DILEMMAS: EncounterDilemmaDef[] = [
  {
    id: 'barrow_parley',
    title: 'Whispers in Liar’s Copse',
    prompt: 'Crows wheel above the black oaks. Steel glints in the brush ahead of the Barrow Mound.',
    options: [
      {
        id: 'bellow_challenge',
        path: 'athelstane',
        label: 'Bellow a Challenge (Athelstane)',
        affinityDelta: 15,
        effectText: '+15 Athelstane Affinity · Draws ambushers out into open steel & grants +25 Stamina.',
      },
      {
        id: 'feint_deception',
        path: 'graymstrum',
        label: 'Spin a Plausible Lie (Graymstrum)',
        affinityDelta: 15,
        effectText: '+15 Graymstrum Affinity · Confuses Thieves’ morale & grants +3 Fire Bolts.',
      },
    ],
  },
  {
    id: 'captive_outrider',
    title: 'Batras’s Cutpurse',
    prompt: 'A wounded scout offers Batras’s flank routes in exchange for mercy.',
    options: [
      {
        id: 'crush_mercy',
        path: 'athelstane',
        label: 'No Quarter for Brigands (Athelstane)',
        affinityDelta: 15,
        effectText: '+15 Athelstane Affinity · Hardens resolve (+15% Heavy Stance poise & +18 Gold).',
      },
      {
        id: 'extract_intel',
        path: 'graymstrum',
        label: 'Trade Passage for Maps (Graymstrum)',
        affinityDelta: 15,
        effectText: '+15 Graymstrum Affinity · Reveals flank blindspots (+15 Potential & Barrowbane Oil).',
      },
    ],
  },
  {
    id: 'obelisk_tribute',
    title: 'The Barrowlands Obelisk',
    prompt: 'Ancient runes pulse beneath the mound—offering raw might or measured foresight.',
    options: [
      {
        id: 'blood_oath',
        path: 'athelstane',
        label: 'Swear by Whetstone & Iron (Athelstane)',
        affinityDelta: 15,
        effectText: '+15 Athelstane Affinity · Instantly sharpens blade & heals 40% HP.',
      },
      {
        id: 'klepsydra_pact',
        path: 'graymstrum',
        label: 'Attune the Klepsydra (Graymstrum)',
        affinityDelta: 15,
        effectText: '+15 Graymstrum Affinity · Grants +30 Potential & +4 Poison Bolts.',
      },
    ],
  },
];

export interface WeaponOilSpec {
  id: Exclude<WeaponOilKind, 'none'>;
  name: string;
  goldCost: number;
  charges: number;
  bonusDamage: number;
  description: string;
  color: string;
}

export const WEAPON_OIL_SPECS: Record<Exclude<WeaponOilKind, 'none'>, WeaponOilSpec> = {
  barrowbane: {
    id: 'barrowbane',
    name: 'Barrowbane Oil',
    goldCost: 15,
    charges: 8,
    bonusDamage: 12,
    description: '+12 damage per strike vs Marauders, Thieves & Undead Stalkers.',
    color: '#34d399',
  },
  flame_resin: {
    id: 'flame_resin',
    name: 'Pitch-Flame Resin',
    goldCost: 22,
    charges: 6,
    bonusDamage: 16,
    description: '+16 searing fire damage per strike with heavy stagger.',
    color: '#fb923c',
  },
  serpent_venom: {
    id: 'serpent_venom',
    name: 'Viper Venom Coat',
    goldCost: 20,
    charges: 7,
    bonusDamage: 13,
    description: '+13 caustic damage & briefly slows nimble flankers.',
    color: '#a3e635',
  },
};

export interface ArblastBoltSpec {
  id: Exclude<ArblastBoltKind, 'standard'>;
  name: string;
  goldCost: number;
  potentialCost: number;
  ammoGrant: number;
  bonusDamage: number;
  color: string;
  description: string;
}

export const ARBLAST_BOLT_SPECS: Record<Exclude<ArblastBoltKind, 'standard'>, ArblastBoltSpec> = {
  fire: {
    id: 'fire',
    name: 'Fire Arblast Bolts',
    goldCost: 18,
    potentialCost: 10,
    ammoGrant: 5,
    bonusDamage: 18,
    color: '#fb923c',
    description: 'Incendiary pitch-wrapped bolts fired alongside ranged attacks & outriders.',
  },
  poison: {
    id: 'poison',
    name: 'Venom Arblast Bolts',
    goldCost: 16,
    potentialCost: 10,
    ammoGrant: 5,
    bonusDamage: 14,
    color: '#a3e635',
    description: 'Barbed toxin bolts that slow fleeing brigands.',
  },
};

export function createDefaultPhilosophyState(): PlayerPhilosophyState {
  return {
    athelstaneAffinity: 10,
    graymstrumAffinity: 10,
    activeStance: 'balanced',
    mounted: false,
    stamina: 100,
    maxStamina: 100,
    weaponOil: 'none',
    oilCharges: 0,
    arblastBolt: 'standard',
    boltAmmo: 0,
    whetstoneExpiresAt: 0,
    potentialScore: 25,
    resolvedDilemmas: [],
    pathAbilityCooldowns: {},
    maneuverCooldown: 0,
  };
}

export function sanitizePhilosophyState(
  raw: Partial<PlayerPhilosophyState> | undefined,
  nowMs = Date.now(),
): PlayerPhilosophyState {
  const def = createDefaultPhilosophyState();
  if (!raw || typeof raw !== 'object') return def;

  const stance: CombatStance =
    raw.activeStance === 'heavy' || raw.activeStance === 'swift' || raw.activeStance === 'balanced'
      ? raw.activeStance
      : 'balanced';

  const oil: WeaponOilKind =
    raw.weaponOil === 'barrowbane' ||
    raw.weaponOil === 'flame_resin' ||
    raw.weaponOil === 'serpent_venom'
      ? raw.weaponOil
      : 'none';

  const bolt: ArblastBoltKind =
    raw.arblastBolt === 'fire' || raw.arblastBolt === 'poison' ? raw.arblastBolt : 'standard';

  return {
    athelstaneAffinity: Math.max(0, Math.min(100, Number(raw.athelstaneAffinity) || def.athelstaneAffinity)),
    graymstrumAffinity: Math.max(0, Math.min(100, Number(raw.graymstrumAffinity) || def.graymstrumAffinity)),
    activeStance: stance,
    mounted: Boolean(raw.mounted),
    stamina: Math.max(0, Math.min(100, Number(raw.stamina ?? 100))),
    maxStamina: Math.max(100, Number(raw.maxStamina ?? 100)),
    weaponOil: oil,
    oilCharges: Math.max(0, Number(raw.oilCharges) || 0),
    arblastBolt: bolt,
    boltAmmo: Math.max(0, Number(raw.boltAmmo) || 0),
    whetstoneExpiresAt: Number(raw.whetstoneExpiresAt) > nowMs ? Number(raw.whetstoneExpiresAt) : 0,
    potentialScore: Math.max(0, Number(raw.potentialScore ?? def.potentialScore)),
    resolvedDilemmas: Array.isArray(raw.resolvedDilemmas)
      ? raw.resolvedDilemmas.filter((d): d is string => typeof d === 'string')
      : [],
    pathAbilityCooldowns: {},
    maneuverCooldown: 0,
  };
}

export function getDominantPhilosophy(state: PlayerPhilosophyState): PhilosophicalPath | 'balanced' {
  if (state.athelstaneAffinity - state.graymstrumAffinity >= 10) return 'athelstane';
  if (state.graymstrumAffinity - state.athelstaneAffinity >= 10) return 'graymstrum';
  return 'balanced';
}
