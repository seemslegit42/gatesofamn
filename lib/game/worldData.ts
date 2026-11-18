import type { ClassSpec, EnemyArchetype, HeroClass, ShrineState, WorldObstacle } from './types.ts';

export const WORLD_PLAYABLE_RADIUS = 64;
export const WORLD_TERRAIN_SIZE = 160;
export const SANCTUARY_SAFE_RADIUS = 11.5;

export const CLASS_SPECS: Record<HeroClass, ClassSpec> = {
  vanguard: {
    id: 'vanguard',
    name: 'Vanguard',
    title: 'Bastion Knight',
    summary: 'Heavy sunlit plate, wide blade cleaves, and shockwave slam.',
    accentColor: '#e5a93c',
    baseHp: 260,
    baseMana: 100,
    moveSpeed: 8.4,
    skills: [
      {
        index: 0,
        keyLabel: '1',
        name: 'Solar Cleave',
        role: 'Wide Melee Arc',
        manaCost: 0,
        cooldown: 0.45,
        range: 3.6,
        radius: 3.6,
        baseDamage: 32,
        kind: 'cleave',
        color: '#f5b942',
      },
      {
        index: 1,
        keyLabel: '2',
        name: 'Aegis Shockwave',
        role: 'Stun & Heavy AoE',
        manaCost: 22,
        cooldown: 3.2,
        range: 5.2,
        radius: 5.2,
        baseDamage: 56,
        kind: 'shockwave',
        color: '#fb923c',
      },
      {
        index: 2,
        keyLabel: '3',
        name: 'Radiant Lance',
        role: 'Piercing Throw',
        manaCost: 24,
        cooldown: 4.5,
        range: 15,
        radius: 1.2,
        baseDamage: 64,
        kind: 'bolt',
        color: '#fde047',
      },
    ],
  },
  arcanist: {
    id: 'arcanist',
    name: 'Arcanist',
    title: 'Astral Weaver',
    summary: 'Long-range starfire bolts and shimmering celestial novas.',
    accentColor: '#38bdf8',
    baseHp: 185,
    baseMana: 160,
    moveSpeed: 8.7,
    skills: [
      {
        index: 0,
        keyLabel: '1',
        name: 'Astral Bolt',
        role: 'Fast Ranged Cast',
        manaCost: 0,
        cooldown: 0.42,
        range: 16,
        radius: 0.9,
        baseDamage: 28,
        kind: 'bolt',
        color: '#38bdf8',
      },
      {
        index: 1,
        keyLabel: '2',
        name: 'Starfall Nova',
        role: 'Targeted Area Blast',
        manaCost: 28,
        cooldown: 3.8,
        range: 13,
        radius: 4.6,
        baseDamage: 68,
        kind: 'nova',
        color: '#818cf8',
      },
      {
        index: 2,
        keyLabel: '3',
        name: 'Frost Rune',
        role: 'Chilling AoE Snare',
        manaCost: 22,
        cooldown: 5.0,
        range: 12,
        radius: 4.2,
        baseDamage: 46,
        kind: 'snare',
        color: '#67e8f9',
      },
    ],
  },
  ranger: {
    id: 'ranger',
    name: 'Ranger',
    title: 'Gale Warden',
    summary: 'Swift stride, multi-arrow volleys, and precision snares.',
    accentColor: '#34d399',
    baseHp: 215,
    baseMana: 130,
    moveSpeed: 9.4,
    skills: [
      {
        index: 0,
        keyLabel: '1',
        name: 'Windshot',
        role: 'Crisp Piercing Arrow',
        manaCost: 0,
        cooldown: 0.36,
        range: 16,
        radius: 0.85,
        baseDamage: 26,
        kind: 'bolt',
        color: '#34d399',
      },
      {
        index: 1,
        keyLabel: '2',
        name: 'Gale Volley',
        role: '5-Arrow Fan Spread',
        manaCost: 24,
        cooldown: 2.8,
        range: 14,
        radius: 0.9,
        baseDamage: 24,
        kind: 'volley',
        color: '#6ee7b7',
      },
      {
        index: 2,
        keyLabel: '3',
        name: 'Thorn Snare',
        role: 'Rooting Trap Burst',
        manaCost: 20,
        cooldown: 4.6,
        range: 12,
        radius: 4.0,
        baseDamage: 44,
        kind: 'snare',
        color: '#a3e635',
      },
    ],
  },
};

export const INITIAL_SHRINES: ShrineState[] = [
  {
    id: 'shrine-dawn',
    name: 'Dawn Spire',
    x: -24,
    z: -14,
    radius: 5.2,
    controllingFaction: 'solis',
    captureProgress: 80,
    buffLabel: '+15% Vitality Regen',
  },
  {
    id: 'shrine-verdant',
    name: 'Verdant Altar',
    x: 26,
    z: 10,
    radius: 5.2,
    controllingFaction: 'neutral',
    captureProgress: 0,
    buffLabel: '+12% Move Swiftness',
  },
  {
    id: 'shrine-obsidian',
    name: 'Obsidian Relay',
    x: 4,
    z: -36,
    radius: 5.4,
    controllingFaction: 'rift',
    captureProgress: -65,
    buffLabel: '+18% Arcane Power',
  },
];

export const WORLD_OBSTACLES: WorldObstacle[] = [
  // Sanctuary circle pillars (open spacing >= 5m between them so paths stay unobstructed)
  { id: 'sanctuary-nw', x: -7.5, z: 7.5, radius: 1.05, height: 4.4, kind: 'pillar' },
  { id: 'sanctuary-ne', x: 7.5, z: 7.5, radius: 1.05, height: 4.4, kind: 'pillar' },
  { id: 'sanctuary-sw', x: -7.5, z: 19.5, radius: 1.05, height: 4.4, kind: 'pillar' },
  { id: 'sanctuary-se', x: 7.5, z: 19.5, radius: 1.05, height: 4.4, kind: 'pillar' },
  // Shrine obelisk bases
  { id: 'obelisk-dawn', x: -24, z: -14, radius: 1.35, height: 7.2, kind: 'obelisk' },
  { id: 'obelisk-verdant', x: 26, z: 10, radius: 1.35, height: 7.2, kind: 'obelisk' },
  { id: 'obelisk-obsidian', x: 4, z: -36, radius: 1.45, height: 8.4, kind: 'obelisk' },
  // Ruin boulders & groves
  { id: 'boulder-1', x: -16, z: 24, radius: 1.7, height: 2.3, kind: 'boulder' },
  { id: 'boulder-2', x: 18, z: 26, radius: 1.9, height: 2.5, kind: 'boulder' },
  { id: 'boulder-3', x: -34, z: -2, radius: 2.1, height: 2.8, kind: 'boulder' },
  { id: 'boulder-4', x: 35, z: -18, radius: 2.0, height: 2.7, kind: 'boulder' },
  { id: 'boulder-5', x: -15, z: -32, radius: 1.8, height: 2.4, kind: 'boulder' },
  { id: 'boulder-6', x: 20, z: -38, radius: 2.2, height: 3.1, kind: 'boulder' },
  { id: 'pillar-bridge-w', x: -5.5, z: -4.5, radius: 0.95, height: 3.8, kind: 'pillar' },
  { id: 'pillar-bridge-e', x: 5.5, z: -4.5, radius: 0.95, height: 3.8, kind: 'pillar' },
  // Barrowlands Ridge: The Ancient Barrow Mound & Liar's Copse
  { id: 'barrow-mound', x: -28, z: 22, radius: 3.4, height: 3.6, kind: 'barrow' },
  { id: 'copse-west', x: -19, z: 18.5, radius: 1.4, height: 3.2, kind: 'copse' },
  { id: 'copse-east', x: -21.5, z: 26, radius: 1.4, height: 3.2, kind: 'copse' },
];

export interface EnemySpawnTemplate {
  id: string;
  archetype: EnemyArchetype;
  name: string;
  level: number;
  x: number;
  z: number;
  isBoss: boolean;
}

export const ENEMY_SPAWNS: EnemySpawnTemplate[] = [
  // West Dawn Glade
  { id: 'mob-stalker-1', archetype: 'stalker', name: 'Rift Stalker', level: 1, x: -18, z: 2, isBoss: false },
  { id: 'mob-stalker-2', archetype: 'stalker', name: 'Rift Stalker', level: 1, x: -23, z: -4, isBoss: false },
  { id: 'mob-acolyte-1', archetype: 'acolyte', name: 'Void Acolyte', level: 2, x: -30, z: -18, isBoss: false },
  { id: 'mob-colossus-1', archetype: 'colossus', name: 'Iron Colossus', level: 3, x: -34, z: -26, isBoss: false },

  // Barrowlands Ridge & Liar's Copse Patrols
  { id: 'mob-thief-1', archetype: 'thief', name: 'Copse Cutthroat', level: 2, x: -16.5, z: 21, isBoss: false },
  { id: 'mob-thief-2', archetype: 'thief', name: 'Barrow Marauder', level: 2, x: -24, z: 27, isBoss: false },

  // East Verdant Crossing
  { id: 'mob-stalker-3', archetype: 'stalker', name: 'Rift Stalker', level: 1, x: 18, z: 3, isBoss: false },
  { id: 'mob-acolyte-2', archetype: 'acolyte', name: 'Void Acolyte', level: 2, x: 28, z: 18, isBoss: false },
  { id: 'mob-stalker-4', archetype: 'stalker', name: 'Ash Fang', level: 2, x: 34, z: 4, isBoss: false },
  { id: 'mob-colossus-2', archetype: 'colossus', name: 'Iron Colossus', level: 3, x: 32, z: -10, isBoss: false },

  // North Obsidian Reach & Boss Citadel
  { id: 'mob-stalker-5', archetype: 'stalker', name: 'Dusk Prowler', level: 3, x: -8, z: -26, isBoss: false },
  { id: 'mob-acolyte-3', archetype: 'acolyte', name: 'Astral Cultist', level: 3, x: 14, z: -28, isBoss: false },
  { id: 'mob-acolyte-4', archetype: 'acolyte', name: 'Astral Cultist', level: 4, x: -10, z: -44, isBoss: false },
  { id: 'boss-warden', archetype: 'warden', name: 'Solar Warden Valdris', level: 5, x: 4, z: -49, isBoss: true },
];

/**
 * Deterministic terrain elevation at world (x, z).
 * Keeps the Sanctuary plateau (around x=0, z=14) and bridge crossing smooth and walkable,
 * slopes slightly down into the shimmering river valley around z=-4.5, and rises toward outer cliffs.
 */
export function groundHeightAt(x: number, z: number): number {
  const distFromCenter = Math.hypot(x, z);
  // River channel runs curved roughly along z = -4.5 + sin(x * 0.08) * 3.2
  const riverCenterZ = -4.5 + Math.sin(x * 0.08) * 3.2;
  const distToRiver = Math.abs(z - riverCenterZ);

  // Rolling hills
  const hills =
    Math.sin(x * 0.075) * Math.cos(z * 0.075) * 0.55 +
    Math.sin(x * 0.16 + 1.1) * Math.sin(z * 0.14) * 0.22;

  // Flatten Sanctuary Plaza around (0, 14)
  const distSanctuary = Math.hypot(x, z - 14);
  const sanctuaryFlat = Math.max(0, 1 - Math.max(0, distSanctuary - 6) / 8);

  // River depression (except across the central stone bridge |x| < 4.5)
  const bridgeMask = Math.max(0, Math.min(1, (Math.abs(x) - 3.6) / 2.6));
  const riverDip = Math.max(0, 1 - distToRiver / 3.8) * 1.15 * bridgeMask;

  // Outer perimeter ridge beyond playable radius
  const rimLift =
    distFromCenter > WORLD_PLAYABLE_RADIUS - 3
      ? Math.pow((distFromCenter - (WORLD_PLAYABLE_RADIUS - 3)) * 0.26, 1.35)
      : 0;

  return Math.max(-0.9, hills * (1 - sanctuaryFlat * 0.88) - riverDip + rimLift);
}

export function getZoneName(x: number, z: number): string {
  if (Math.hypot(x, z - 14) < 13) return 'Solis Sanctuary';
  if (x < -14 && z > 10) return 'Barrowlands Ridge';
  if (z < -30) return 'Obsidian Citadel';
  if (x < -14) return 'Dawn Spire Glade';
  if (x > 14) return 'Verdant Crossing';
  return 'Sunstone Valley';
}

export function getSpawnPoint(index = 0): { x: number; z: number } {
  const angle = (index % 8) * (Math.PI / 4);
  const r = index === 0 ? 0 : 2.6;
  return {
    x: Math.cos(angle) * r,
    z: 14 + Math.sin(angle) * r,
  };
}
