import type {
  CompanionId,
  CompanionState,
  DynamicWorldEventState,
  EnemyState,
  PlayerState,
  TacticalAdvice,
} from './types.ts';
import { SANCTUARY_SAFE_RADIUS, groundHeightAt } from './worldData.ts';

/**
 * Reusable Behavior Tree Primitives (Sequence, Selector, Condition, Action)
 * Driving enemy squad intelligence (The Thieves & Batras in the Barrowlands).
 */
export type BtStatus = 'success' | 'failure' | 'running';

export interface BtNode<TContext> {
  tick(ctx: TContext): BtStatus;
}

export class SequenceNode<TContext> implements BtNode<TContext> {
  private readonly children: BtNode<TContext>[];
  constructor(children: BtNode<TContext>[]) {
    this.children = children;
  }
  tick(ctx: TContext): BtStatus {
    for (const child of this.children) {
      const res = child.tick(ctx);
      if (res !== 'success') return res;
    }
    return 'success';
  }
}

export class SelectorNode<TContext> implements BtNode<TContext> {
  private readonly children: BtNode<TContext>[];
  constructor(children: BtNode<TContext>[]) {
    this.children = children;
  }
  tick(ctx: TContext): BtStatus {
    for (const child of this.children) {
      const res = child.tick(ctx);
      if (res !== 'failure') return res;
    }
    return 'failure';
  }
}

export class ConditionNode<TContext> implements BtNode<TContext> {
  private readonly predicate: (ctx: TContext) => boolean;
  constructor(predicate: (ctx: TContext) => boolean) {
    this.predicate = predicate;
  }
  tick(ctx: TContext): BtStatus {
    return this.predicate(ctx) ? 'success' : 'failure';
  }
}

export class ActionNode<TContext> implements BtNode<TContext> {
  private readonly action: (ctx: TContext) => BtStatus;
  constructor(action: (ctx: TContext) => BtStatus) {
    this.action = action;
  }
  tick(ctx: TContext): BtStatus {
    return this.action(ctx);
  }
}

export interface ThiefBtContext {
  enemy: EnemyState;
  target: PlayerState | null;
  dist: number;
  alliesAlive: number;
  batrasAlive: boolean;
  whistleTriggered: boolean;
  dt: number;
  moveTo: (x: number, z: number, speed: number, radius?: number) => void;
  startMeleeWindup: (radius: number, windupSec: number) => void;
  startRangedBolt: (windupSec: number) => void;
}

/**
 * Behavior Tree for Barrowlands Thieves & Batras:
 * 1. If in Ambush Phase 1 (before whistle) and far from target, Skulk Hidden in Liar's Copse.
 * 2. If outnumbered (< 2 allies alive or Batras fallen) and HP < 55%, Tactical Retreat to Copse & fire Ranged Bolts.
 * 3. Otherwise, Coordinated Assault / Flank Attack.
 */
const thiefBehaviorTree = new SelectorNode<ThiefBtContext>([
  // Branch 1: Ambush Skulk before Whistle
  new SequenceNode([
    new ConditionNode((c) => !c.whistleTriggered && c.enemy.aiRole === 'skulk' && c.dist > 5.5),
    new ActionNode((c) => {
      c.enemy.hiddenInCover = true;
      c.enemy.phase = 'patrol';
      if (c.target) {
        c.enemy.facing = Math.atan2(c.target.x - c.enemy.x, c.target.z - c.enemy.z);
      }
      return 'running';
    }),
  ]),

  // Branch 2: Retreat & Ranged Cover when Disadvantaged
  new SequenceNode([
    new ConditionNode(
      (c) =>
        Boolean(c.target) &&
        !c.enemy.isBoss &&
        ((!c.batrasAlive && c.alliesAlive <= 2) || c.enemy.hp < c.enemy.maxHp * 0.35),
    ),
    new ActionNode((c) => {
      c.enemy.hiddenInCover = false;
      c.enemy.aiRole = 'retreat';
      if (!c.target) return 'failure';
      if (c.dist < 8.5) {
        // Kite away toward Liar's Copse (-18, 20)
        const awayX = c.enemy.x - (c.target.x - c.enemy.x);
        const awayZ = c.enemy.z - (c.target.z - c.enemy.z);
        c.moveTo(awayX, awayZ, 4.9, 0.7);
        c.enemy.phase = 'kite';
        return 'running';
      }
      if (c.enemy.attackCooldown <= 0) {
        c.startRangedBolt(0.5);
        return 'success';
      }
      return 'running';
    }),
  ]),

  // Branch 3: Batras Commander Tactical Rally & Heavy Cleave
  new SequenceNode([
    new ConditionNode((c) => c.enemy.archetype === 'batras' && Boolean(c.target)),
    new ActionNode((c) => {
      c.enemy.hiddenInCover = false;
      c.enemy.aiRole = 'commander';
      if (!c.target) return 'failure';
      if (c.dist > 3.1) {
        c.moveTo(c.target.x, c.target.z, 4.3, 1.0);
        c.enemy.phase = 'approach';
        return 'running';
      }
      if (c.enemy.attackCooldown <= 0) {
        c.startMeleeWindup(3.2, 0.58);
        return 'success';
      }
      return 'running';
    }),
  ]),

  // Branch 4: Coordinated Thief Assault / Flank
  new SequenceNode([
    new ConditionNode((c) => Boolean(c.target)),
    new ActionNode((c) => {
      c.enemy.hiddenInCover = false;
      c.enemy.aiRole = 'assault';
      if (!c.target) return 'failure';
      const dx = c.target.x - c.enemy.x;
      const dz = c.target.z - c.enemy.z;
      const baseAngle = Math.atan2(dx, dz) + c.enemy.orbitSign * 0.32;
      if (c.dist > 2.2) {
        c.moveTo(
          c.enemy.x + Math.sin(baseAngle) * 4,
          c.enemy.z + Math.cos(baseAngle) * 4,
          5.6,
          0.7,
        );
        c.enemy.phase = 'approach';
        return 'running';
      }
      if (c.enemy.attackCooldown <= 0) {
        c.startMeleeWindup(2.1, 0.42);
        return 'success';
      }
      return 'running';
    }),
  ]),
]);

export function evaluateThiefBehaviorTree(ctx: ThiefBtContext): BtStatus {
  return thiefBehaviorTree.tick(ctx);
}

export function createInitialCompanions(): CompanionState[] {
  return [
    {
      id: 'graymstrum',
      name: 'Graymstrum',
      title: 'Tactician',
      role: 'Tactician',
      x: -2.2,
      z: 15.8,
      facing: Math.PI,
      hp: 210,
      maxHp: 210,
      mounted: false,
      action: 'synthesizing',
      cooldown: 0,
      swarmDecisionTimer: 0,
      swarmMode: 'evade',
      accentColor: '#38bdf8',
    },
    {
      id: 'haft',
      name: 'Haft',
      title: 'Iron Veteran',
      role: 'Veteran Tank',
      x: 2.1,
      z: 15.4,
      facing: Math.PI,
      hp: 340,
      maxHp: 340,
      mounted: false,
      action: 'escort',
      cooldown: 0,
      swarmDecisionTimer: 0,
      swarmMode: 'taunt',
      accentColor: '#f59e0b',
    },
    {
      id: 'worgen',
      name: 'Worgen',
      title: 'Wild Blade',
      role: 'Wild Card',
      x: -1.4,
      z: 12.2,
      facing: Math.PI,
      hp: 240,
      maxHp: 240,
      mounted: false,
      action: 'escort',
      cooldown: 0,
      swarmDecisionTimer: 0.4,
      swarmMode: 'flank',
      accentColor: '#fb7185',
    },
    {
      id: 'krydon',
      name: 'Krydon',
      title: 'Outrider',
      role: 'Outrider',
      x: 3.1,
      z: 13.0,
      facing: Math.PI,
      hp: 190,
      maxHp: 190,
      mounted: false,
      action: 'escort',
      cooldown: 0,
      swarmDecisionTimer: 0,
      swarmMode: 'attack',
      accentColor: '#34d399',
    },
    {
      id: 'hellas',
      name: 'Hellas',
      title: 'Outrider',
      role: 'Outrider',
      x: -3.2,
      z: 13.2,
      facing: Math.PI,
      hp: 190,
      maxHp: 190,
      mounted: false,
      action: 'escort',
      cooldown: 0,
      swarmDecisionTimer: 0,
      swarmMode: 'attack',
      accentColor: '#6ee7b7',
    },
    {
      id: 'rykker',
      name: 'Rykker',
      title: 'Lancer',
      role: 'Cavalry Flanker',
      x: 4.0,
      z: 16.5,
      facing: Math.PI,
      hp: 260,
      maxHp: 260,
      mounted: true,
      action: 'escort',
      cooldown: 0,
      swarmDecisionTimer: 0,
      swarmMode: 'flank',
      accentColor: '#eab308',
    },
    {
      id: 'proudis',
      name: 'Proudis',
      title: 'Lancer',
      role: 'Cavalry Flanker',
      x: -4.0,
      z: 16.5,
      facing: Math.PI,
      hp: 260,
      maxHp: 260,
      mounted: true,
      action: 'escort',
      cooldown: 0,
      swarmDecisionTimer: 0,
      swarmMode: 'flank',
      accentColor: '#e5a93c',
    },
  ];
}

const FORMATION_OFFSETS: Record<CompanionId, [number, number]> = {
  graymstrum: [-2.4, 2.2],
  haft: [2.2, 1.6],
  worgen: [-1.8, -1.9],
  krydon: [3.2, 2.8],
  hellas: [-3.4, 2.8],
  rykker: [4.5, 4.2],
  proudis: [-4.5, 4.2],
};

/**
 * Probabilistic Swarm Micro-Agent scorer for Worgen (Wild Card).
 */
export function selectWorgenSwarmMode(
  distToEnemy: number,
  playerHpRatio: number,
  seed: number,
): CompanionState['swarmMode'] {
  const weights: Record<CompanionState['swarmMode'], number> = {
    attack: distToEnemy < 5 ? 38 : 24,
    flank: 36,
    evade: playerHpRatio < 0.45 ? 12 : 20,
    taunt: playerHpRatio < 0.5 ? 28 : 14,
  };
  const total = weights.attack + weights.flank + weights.evade + weights.taunt;
  const pick = ((Math.abs(Math.sin(seed * 12.9898)) * 43758.5453) % 1) * total;
  let acc = 0;
  for (const mode of ['attack', 'flank', 'evade', 'taunt'] as const) {
    acc += weights[mode];
    if (pick <= acc) return mode;
  }
  return 'flank';
}

export interface CompanionStepCallbacks {
  resolvePos: (x: number, z: number, radius: number) => { x: number; z: number };
  damageEnemy: (enemy: EnemyState, owner: PlayerState, dmg: number, kx: number, kz: number) => void;
  spawnBolt: (
    fromX: number,
    fromZ: number,
    toX: number,
    toZ: number,
    owner: PlayerState,
    damage: number,
    color: string,
  ) => void;
  healPlayer: (player: PlayerState, amount: number) => void;
}

export function stepCompanions(
  companions: CompanionState[],
  players: Iterable<PlayerState>,
  enemies: EnemyState[],
  dt: number,
  worldTime: number,
  cb: CompanionStepCallbacks,
) {
  const playerList = Array.from(players).filter((p) => p.alive);
  if (playerList.length === 0) return;

  const leader = playerList[0];
  const inSanctuary = Math.hypot(leader.x, leader.z - 14) <= SANCTUARY_SAFE_RADIUS;

  // Pick priority threat near leader
  let nearestThreat: EnemyState | null = null;
  let nearestThreatDist = 16;
  for (const e of enemies) {
    if (e.phase === 'ko' || e.hp <= 0 || e.hiddenInCover) continue;
    const d = Math.hypot(e.x - leader.x, e.z - leader.z);
    if (d < nearestThreatDist) {
      nearestThreatDist = d;
      nearestThreat = e;
    }
  }

  for (let i = 0; i < companions.length; i++) {
    const c = companions[i];
    c.cooldown = Math.max(0, c.cooldown - dt);

    const [ox, oz] = FORMATION_OFFSETS[c.id];
    const cosF = Math.cos(leader.facing);
    const sinF = Math.sin(leader.facing);
    const formX = leader.x + ox * cosF + oz * sinF;
    const formZ = leader.z - ox * sinF + oz * cosF;

    if (c.id === 'graymstrum') {
      // Tactician stays near leader's shoulder and performs Field Triage if wounded
      c.action = nearestThreat ? 'synthesizing' : 'escort';
      if (!inSanctuary && leader.hp < leader.maxHp * 0.72 && c.cooldown <= 0) {
        c.action = 'triage';
        c.cooldown = 7.5;
        cb.healPlayer(leader, Math.round(leader.maxHp * 0.14));
      }
      const dx = formX - c.x;
      const dz = formZ - c.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.6) {
        const step = Math.min(d, 8.6 * dt);
        const pos = cb.resolvePos(c.x + (dx / d) * step, c.z + (dz / d) * step, 0.5);
        c.x = pos.x;
        c.z = pos.z;
        c.facing = Math.atan2(dx, dz);
      }
      continue;
    }

    if (nearestThreat && !inSanctuary) {
      const tx = nearestThreat.x - c.x;
      const tz = nearestThreat.z - c.z;
      const tdist = Math.hypot(tx, tz) || 0.001;
      const nx = tx / tdist;
      const nz = tz / tdist;

      if (c.id === 'haft') {
        c.action = 'cleave';
        if (tdist > 2.3) {
          const pos = cb.resolvePos(c.x + nx * 6.8 * dt, c.z + nz * 6.8 * dt, 0.6);
          c.x = pos.x;
          c.z = pos.z;
        } else if (c.cooldown <= 0) {
          c.cooldown = 2.0;
          cb.damageEnemy(nearestThreat, leader, 14 + leader.level * 2, nx * 0.85, nz * 0.85);
        }
        c.facing = Math.atan2(nx, nz);
      } else if (c.id === 'worgen') {
        c.swarmDecisionTimer -= dt;
        if (c.swarmDecisionTimer <= 0) {
          c.swarmDecisionTimer = 1.2;
          c.swarmMode = selectWorgenSwarmMode(
            tdist,
            leader.hp / Math.max(1, leader.maxHp),
            worldTime + i * 3.1,
          );
        }
        c.action = 'swarm_flank';
        const tangentAngle =
          Math.atan2(nx, nz) + (c.swarmMode === 'flank' ? 0.85 : c.swarmMode === 'evade' ? -1.4 : 0);
        const desiredSpeed = c.swarmMode === 'evade' ? 9.4 : 8.4;
        if (tdist > 2.1 || c.swarmMode === 'evade') {
          const pos = cb.resolvePos(
            c.x + Math.sin(tangentAngle) * desiredSpeed * dt,
            c.z + Math.cos(tangentAngle) * desiredSpeed * dt,
            0.5,
          );
          c.x = pos.x;
          c.z = pos.z;
        }
        if (tdist <= 2.6 && c.cooldown <= 0 && c.swarmMode !== 'evade') {
          c.cooldown = 1.35;
          cb.damageEnemy(nearestThreat, leader, 13 + leader.level * 2, nx * 0.35, nz * 0.35);
        }
        c.facing = Math.atan2(nx, nz);
      } else if (c.id === 'krydon' || c.id === 'hellas') {
        c.action = 'volley';
        if (tdist < 7.5) {
          const pos = cb.resolvePos(c.x - nx * 5.8 * dt, c.z - nz * 5.8 * dt, 0.5);
          c.x = pos.x;
          c.z = pos.z;
        } else if (tdist > 13) {
          const pos = cb.resolvePos(c.x + nx * 6.5 * dt, c.z + nz * 6.5 * dt, 0.5);
          c.x = pos.x;
          c.z = pos.z;
        }
        if (tdist <= 14.5 && c.cooldown <= 0) {
          c.cooldown = c.id === 'krydon' ? 2.1 : 2.35;
          const boltColor =
            leader.philosophy.arblastBolt === 'fire' && leader.philosophy.boltAmmo > 0
              ? '#fb923c'
              : leader.philosophy.arblastBolt === 'poison' && leader.philosophy.boltAmmo > 0
                ? '#a3e635'
                : '#34d399';
          cb.spawnBolt(c.x, c.z, nearestThreat.x, nearestThreat.z, leader, 11 + leader.level * 2, boltColor);
        }
        c.facing = Math.atan2(nx, nz);
      } else {
        // Rykker & Proudis: Mounted Cavalry Flanking Arcs
        c.action = 'cavalry_charge';
        const orbitSide = c.id === 'rykker' ? 1 : -1;
        const flankAngle = Math.atan2(nx, nz) + orbitSide * 0.65;
        const pos = cb.resolvePos(
          c.x + Math.sin(flankAngle) * 10.2 * dt,
          c.z + Math.cos(flankAngle) * 10.2 * dt,
          0.7,
        );
        c.x = pos.x;
        c.z = pos.z;
        c.facing = flankAngle;
        if (tdist <= 2.9 && c.cooldown <= 0) {
          c.cooldown = 2.4;
          cb.damageEnemy(nearestThreat, leader, 16 + leader.level * 2, nx * 1.35, nz * 1.35);
        }
      }
      continue;
    }

    // Peaceful escort formation follow
    c.action = 'escort';
    const dx = formX - c.x;
    const dz = formZ - c.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.75) {
      const followSpeed = c.mounted ? 11.2 : 8.6;
      const step = Math.min(d, followSpeed * dt);
      const pos = cb.resolvePos(c.x + (dx / d) * step, c.z + (dz / d) * step, 0.5);
      c.x = pos.x;
      c.z = pos.z;
      c.facing = Math.atan2(dx, dz);
    } else {
      c.facing = leader.facing;
    }
  }
}

/**
 * Graymstrum's Tactical Synthesizer: analyzes battlefield proximity,
 * skulking ambushers, horse ear-twitch / crow sentinel cues, and stance alignment.
 */
export function evaluateSynthesizerAdvice(
  players: Iterable<PlayerState>,
  enemies: EnemyState[],
  dynamicEvent: DynamicWorldEventState | null,
): TacticalAdvice {
  const playerList = Array.from(players);
  const focus = playerList[0];
  if (!focus) {
    return {
      speaker: 'Graymstrum',
      headline: 'The road waits beyond the Sanctuary gate.',
      cue: 'Check whetstones and oils before crossing.',
      recommendedStance: 'balanced',
      threatLevel: 'calm',
      crowAlert: false,
      nearbyEnemies: 0,
      hiddenAmbushers: 0,
    };
  }

  let nearbyEnemies = 0;
  let hiddenAmbushers = 0;
  let heavyNearby = false;
  let bossNearby = false;

  for (const e of enemies) {
    if (e.phase === 'ko' || e.hp <= 0) continue;
    const d = Math.hypot(e.x - focus.x, e.z - focus.z);
    if (d <= 20) {
      if (e.hiddenInCover) {
        hiddenAmbushers += 1;
      } else {
        nearbyEnemies += 1;
      }
      if (e.archetype === 'colossus' || e.archetype === 'batras') heavyNearby = true;
      if (e.isBoss) bossNearby = true;
    }
  }

  const nearBarrow = Math.hypot(focus.x - -24, focus.z - 21) <= 18;
  const crowAlert =
    hiddenAmbushers > 0 ||
    nearBarrow ||
    (dynamicEvent?.kind === 'barrow_ambush' && dynamicEvent.status === 'active');

  if (focus.hp < focus.maxHp * 0.35 && nearbyEnemies > 0) {
    return {
      speaker: 'Graymstrum',
      headline: 'Guard is faltering—break contact!',
      cue: 'Shift to Swift stance, trigger Field Triage, or mount up to widen the arc.',
      recommendedStance: 'swift',
      threatLevel: 'critical',
      crowAlert,
      nearbyEnemies,
      hiddenAmbushers,
    };
  }

  if (hiddenAmbushers > 0) {
    return {
      speaker: 'Graymstrum',
      headline: 'Crows circle Liar’s Copse. Horses’ ears are pinned.',
      cue: `${hiddenAmbushers} ambushers skulk in the brush. Bellow a Challenge or spin a Plausible Lie!`,
      recommendedStance: 'heavy',
      threatLevel: 'ambush',
      crowAlert: true,
      nearbyEnemies,
      hiddenAmbushers,
    };
  }

  if (bossNearby || heavyNearby) {
    return {
      speaker: 'Graymstrum',
      headline: 'Armored vanguard ahead—steel needs weight.',
      cue: 'Heavy Stance + Barrowbane Oil will crack Batras’s guard and stagger colossi.',
      recommendedStance: 'heavy',
      threatLevel: 'caution',
      crowAlert,
      nearbyEnemies,
      hiddenAmbushers,
    };
  }

  if (nearbyEnemies >= 3) {
    return {
      speaker: 'Graymstrum',
      headline: 'Pack surrounding our flank—keep moving.',
      cue: 'Rykker & Proudis are circling. Use Swift cadence or Mounted Spin to clear space.',
      recommendedStance: 'swift',
      threatLevel: 'caution',
      crowAlert,
      nearbyEnemies,
      hiddenAmbushers,
    };
  }

  if (nearBarrow) {
    return {
      speaker: 'Graymstrum',
      headline: 'The Barrow Mound looms silent beneath black oaks.',
      cue: 'A crow just launched from the thorn brush. Prepare bolts and sharpen blades.',
      recommendedStance: 'balanced',
      threatLevel: 'ambush',
      crowAlert: true,
      nearbyEnemies,
      hiddenAmbushers,
    };
  }

  return {
    speaker: 'Graymstrum',
    headline: 'Road holds steady. Outriders report clear ridge lines.',
    cue: `Warband in formation (${groundHeightAt(focus.x, focus.z).toFixed(1)}m elevation).`,
    recommendedStance: 'balanced',
    threatLevel: 'calm',
    crowAlert: false,
    nearbyEnemies,
    hiddenAmbushers,
  };
}
