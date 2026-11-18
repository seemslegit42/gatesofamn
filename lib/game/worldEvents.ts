import type {
  DynamicWorldEventKind,
  DynamicWorldEventState,
  EnemyArchetype,
} from './types.ts';

export interface WorldEventBlueprint {
  kind: DynamicWorldEventKind;
  title: string;
  subtitle: string;
  zoneName: string;
  x: number;
  z: number;
  radius: number;
  goal: number;
  durationMs: number;
  weatherHint: 'rain' | 'corruption' | 'clear';
  rewardLabel: string;
  enemySpawns: { archetype: EnemyArchetype; name: string; level: number; isBoss: boolean; ox: number; oz: number }[];
}

export const WORLD_EVENT_ROTATION: WorldEventBlueprint[] = [
  {
    kind: 'barrow_ambush',
    title: 'Ambush at the Barrow Mound',
    subtitle: 'Skulking brigands stir inside Liar’s Copse under circling crows.',
    zoneName: 'Barrowlands Ridge',
    x: -24,
    z: 21,
    radius: 11.5,
    goal: 5,
    durationMs: 115_000,
    weatherHint: 'rain',
    rewardLabel: '+220 XP · +130 Gold · Batras’s Signet',
    enemySpawns: [
      { archetype: 'thief', name: 'Liar’s Copse Cutthroat', level: 2, isBoss: false, ox: 4.5, oz: -2.2 },
      { archetype: 'thief', name: 'Liar’s Copse Skirmisher', level: 2, isBoss: false, ox: 3.8, oz: 3.8 },
      { archetype: 'thief', name: 'Barrow Thorn-Scout', level: 3, isBoss: false, ox: -3.2, oz: -4.2 },
      { archetype: 'thief', name: 'Barrow Shieldbreaker', level: 3, isBoss: false, ox: -3.8, oz: 4.1 },
      { archetype: 'batras', name: 'Batras the Marauder', level: 4, isBoss: true, ox: -4.2, oz: 0.5 },
    ],
  },
  {
    kind: 'invasion',
    title: 'Rift Incursion at Dawn Spire',
    subtitle: 'Banish the Void vanguard before the spire falls.',
    zoneName: 'Dawn Spire Glade',
    x: -24,
    z: -14,
    radius: 10.5,
    goal: 5,
    durationMs: 95_000,
    weatherHint: 'corruption',
    rewardLabel: '+150 XP · +85 Gold · Incursion Relic',
    enemySpawns: [
      { archetype: 'stalker', name: 'Rift Raider', level: 2, isBoss: false, ox: -4.2, oz: 3.1 },
      { archetype: 'stalker', name: 'Rift Raider', level: 2, isBoss: false, ox: 4.0, oz: 2.8 },
      { archetype: 'acolyte', name: 'Void Conduit', level: 3, isBoss: false, ox: -3.5, oz: -3.8 },
      { archetype: 'acolyte', name: 'Void Conduit', level: 3, isBoss: false, ox: 3.8, oz: -3.5 },
      { archetype: 'colossus', name: 'Incursion Harbinger', level: 4, isBoss: false, ox: 0, oz: -5.0 },
    ],
  },
  {
    kind: 'tempest',
    title: 'Aether Tempest Surge',
    subtitle: 'Dodge storm strikes and shatter the Tempest Constructs.',
    zoneName: 'Sunstone Valley',
    x: 0,
    z: -16,
    radius: 12.0,
    goal: 4,
    durationMs: 95_000,
    weatherHint: 'rain',
    rewardLabel: '+165 XP · +95 Gold · Storm Shards',
    enemySpawns: [
      { archetype: 'acolyte', name: 'Tempest Weaver', level: 3, isBoss: false, ox: -4.5, oz: -2.5 },
      { archetype: 'acolyte', name: 'Tempest Weaver', level: 3, isBoss: false, ox: 4.5, oz: -2.5 },
      { archetype: 'colossus', name: 'Stormbound Colossus', level: 4, isBoss: false, ox: -2.5, oz: 3.5 },
      { archetype: 'colossus', name: 'Stormbound Colossus', level: 4, isBoss: false, ox: 2.5, oz: 3.5 },
    ],
  },
  {
    kind: 'dungeon_rift',
    title: 'Sunken Vault Unsealed',
    subtitle: 'Hold the ancient Vault Seal and defeat its Sentinel.',
    zoneName: 'Verdant Crossing',
    x: 20,
    z: -16,
    radius: 7.2,
    goal: 100,
    durationMs: 105_000,
    weatherHint: 'corruption',
    rewardLabel: '+210 XP · +120 Gold · Vault Relic',
    enemySpawns: [
      { archetype: 'stalker', name: 'Vault Hound', level: 3, isBoss: false, ox: -3.2, oz: 2.8 },
      { archetype: 'acolyte', name: 'Seal Keeper', level: 3, isBoss: false, ox: 3.4, oz: 2.4 },
      { archetype: 'colossus', name: 'Vault Sentinel', level: 4, isBoss: false, ox: 0, oz: -3.8 },
    ],
  },
];

export function createDynamicWorldEvent(
  blueprintIndex: number,
  nowMs = Date.now(),
  overrideKind?: DynamicWorldEventKind,
): { event: DynamicWorldEventState; blueprint: WorldEventBlueprint } {
  let bp = WORLD_EVENT_ROTATION[Math.abs(blueprintIndex) % WORLD_EVENT_ROTATION.length];
  if (overrideKind) {
    const matched = WORLD_EVENT_ROTATION.find((b) => b.kind === overrideKind);
    if (matched) bp = matched;
  }

  return {
    blueprint: bp,
    event: {
      id: `wevt-${bp.kind}-${nowMs}`,
      kind: bp.kind,
      title: bp.title,
      subtitle: bp.subtitle,
      zoneName: bp.zoneName,
      x: bp.x,
      z: bp.z,
      radius: bp.radius,
      progress: 0,
      goal: bp.goal,
      startedAt: nowMs,
      expiresAt: nowMs + bp.durationMs,
      status: 'active',
      participantScores: {},
      weatherHint: bp.weatherHint,
      rewardLabel: bp.rewardLabel,
      ambushPhase: bp.kind === 'barrow_ambush' ? 1 : undefined,
      whistleTriggered: bp.kind === 'barrow_ambush' ? false : undefined,
    },
  };
}
