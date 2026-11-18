import type {
  CombatStance,
  CompanionState,
  DynamicWorldEventKind,
  DynamicWorldEventState,
  EnemyArchetype,
  EnemyState,
  HeroAppearance,
  HeroClass,
  InventoryItem,
  LootDrop,
  MountedManeuverKind,
  PlayerState,
  PrepCampAction,
  ProjectileState,
  QuestProgress,
  Rarity,
  ShrineState,
  TacticalAdvice,
  WorldEffectEvent,
} from './types.ts';
import {
  CLASS_SPECS,
  ENEMY_SPAWNS,
  INITIAL_SHRINES,
  SANCTUARY_SAFE_RADIUS,
  WORLD_OBSTACLES,
  WORLD_PLAYABLE_RADIUS,
  getSpawnPoint,
  getZoneName,
  groundHeightAt,
} from './worldData.ts';
import { sanitizeAppearance } from './appearance.ts';
import {
  QUEST_BY_ID,
  advancePlayerQuests,
  ensurePlayerQuests,
} from './quests.ts';
import { createDynamicWorldEvent } from './worldEvents.ts';
import {
  createDefaultMonetizationState,
  getActiveAdBuffMultipliers,
  getBattlePassTier,
  grantBattlePassXp,
  pruneExpiredAdBuffs,
} from './monetization.ts';
import {
  ARBLAST_BOLT_SPECS,
  ENCOUNTER_DILEMMAS,
  PHILOSOPHY_ABILITIES,
  STANCE_MODIFIERS,
  WEAPON_OIL_SPECS,
  createDefaultPhilosophyState,
} from './philosophy.ts';
import {
  createInitialCompanions,
  evaluateSynthesizerAdvice,
  evaluateThiefBehaviorTree,
  stepCompanions,
} from './ai.ts';

export interface SimWorld {
  time: number;
  nowMs: number;
  players: Map<string, PlayerState>;
  enemies: EnemyState[];
  companions: CompanionState[];
  tacticalAdvice: TacticalAdvice;
  shrines: ShrineState[];
  loot: LootDrop[];
  projectiles: ProjectileState[];
  events: WorldEffectEvent[];
  dynamicEvent: DynamicWorldEventState | null;
  nextEventCountdownSec: number;
  eventRotationIndex: number;
  tempestHazardTimer: number;
  nextSeq: number;
  onPersistPlayer?: (player: PlayerState) => void;
  onPersistQuests?: (player: PlayerState) => void;
  onPersistShrine?: (shrine: ShrineState) => void;
  onPersistWorldEvent?: (evt: DynamicWorldEventState) => void;
  onWorldAnnouncement?: (text: string) => void;
}

const MAX_CONCURRENT_ATTACK_TOKENS = 4;

export function createEnemyFromTemplate(
  t: (typeof ENEMY_SPAWNS)[number],
  eventId?: string,
): EnemyState {
  const statsByArchetype: Record<EnemyArchetype, { hp: number }> = {
    stalker: { hp: 95 + t.level * 22 },
    acolyte: { hp: 85 + t.level * 18 },
    colossus: { hp: 210 + t.level * 40 },
    warden: { hp: 620 + t.level * 70 },
    thief: { hp: 105 + t.level * 20 },
    batras: { hp: 460 + t.level * 55 },
  };
  const maxHp = statsByArchetype[t.archetype].hp;
  const isAmbushMob = Boolean(eventId) && t.archetype === 'thief';
  return {
    id: t.id,
    archetype: t.archetype,
    name: t.name,
    level: t.level,
    isBoss: t.isBoss,
    eventId,
    x: t.x,
    y: groundHeightAt(t.x, t.z),
    z: t.z,
    vx: 0,
    vz: 0,
    impulseX: 0,
    impulseZ: 0,
    stunTimer: 0,
    homeX: t.x,
    homeZ: t.z,
    facing: 0,
    hp: maxHp,
    maxHp,
    phase: 'patrol',
    phaseTimer: 0,
    koTimer: 0,
    respawnTimer: 0,
    attackCooldown: 0.8,
    telegraphX: t.x,
    telegraphZ: t.z,
    telegraphRadius: t.archetype === 'batras' ? 3.2 : 2.4,
    telegraphKind:
      t.archetype === 'colossus'
        ? 'line'
        : t.archetype === 'warden' || t.archetype === 'batras'
          ? 'ring'
          : 'cone',
    targetPlayerId: null,
    hurtFlash: 0,
    orbitSign: t.id.endsWith('2') || t.id.endsWith('4') ? -1 : 1,
    hiddenInCover: isAmbushMob,
    aiRole: t.archetype === 'batras' ? 'commander' : isAmbushMob ? 'skulk' : t.archetype === 'thief' ? 'assault' : undefined,
  };
}

export function createSimWorld(initialShrines?: ShrineState[]): SimWorld {
  const companions = createInitialCompanions();
  const enemies = ENEMY_SPAWNS.map((s) => createEnemyFromTemplate(s));
  return {
    time: 0,
    nowMs: Date.now(),
    players: new Map(),
    enemies,
    companions,
    tacticalAdvice: evaluateSynthesizerAdvice([], enemies, null),
    shrines: (initialShrines && initialShrines.length > 0 ? initialShrines : INITIAL_SHRINES).map((s) => ({
      ...s,
    })),
    loot: [],
    projectiles: [],
    events: [],
    dynamicEvent: null,
    nextEventCountdownSec: 12,
    eventRotationIndex: 0,
    tempestHazardTimer: 3.5,
    nextSeq: 1,
  };
}

export function createDefaultPlayer(
  id: string,
  name: string,
  heroClass: HeroClass,
  spawnIndex = 0,
  appearance?: Partial<HeroAppearance>,
): PlayerState {
  const spec = CLASS_SPECS[heroClass];
  const spawn = getSpawnPoint(spawnIndex);
  const starterWeapon: InventoryItem = {
    id: `${id}-starter-wpn`,
    itemKey: `starter_${heroClass}`,
    name:
      heroClass === 'vanguard'
        ? 'Sunforged Broadsword'
        : heroClass === 'arcanist'
          ? 'Starlight Conduit'
          : 'Windweave Recurve',
    rarity: 'common',
    slotType: 'weapon',
    quantity: 1,
    power: 6,
  };
  const player: PlayerState = {
    id,
    name: name.trim().slice(0, 20) || 'Wanderer',
    heroClass,
    appearance: sanitizeAppearance(appearance, heroClass),
    level: 1,
    xp: 0,
    xpToNext: 100,
    hp: spec.baseHp,
    maxHp: spec.baseHp,
    mana: spec.baseMana,
    maxMana: spec.baseMana,
    gold: 25,
    kills: 0,
    potions: 3,
    x: spawn.x,
    y: groundHeightAt(spawn.x, spawn.z),
    z: spawn.z,
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
    weaponPower: starterWeapon.power,
    charmPower: 0,
    input: {
      moveX: 0,
      moveZ: 0,
      waypointX: null,
      waypointZ: null,
    },
    inventory: [starterWeapon],
    quests: [],
    trackedQuestId: null,
    visitedZones: ['Solis Sanctuary'],
    monetization: createDefaultMonetizationState(),
    philosophy: createDefaultPhilosophyState(),
    lastHitTime: -10,
  };
  ensurePlayerQuests(player);
  return player;
}

export function resolveWorldPosition(x: number, z: number, entityRadius = 0.7): { x: number; z: number } {
  let rx = x;
  let rz = z;

  for (const obs of WORLD_OBSTACLES) {
    const dx = rx - obs.x;
    const dz = rz - obs.z;
    const dist = Math.hypot(dx, dz);
    const minDist = obs.radius + entityRadius;
    if (dist < minDist) {
      if (dist < 0.0001) {
        rx = obs.x + minDist;
      } else {
        const push = (minDist - dist) / dist;
        rx += dx * push;
        rz += dz * push;
      }
    }
  }

  const distCenter = Math.hypot(rx, rz);
  const maxR = WORLD_PLAYABLE_RADIUS - entityRadius;
  if (distCenter > maxR && distCenter > 0.0001) {
    const scale = maxR / distCenter;
    rx *= scale;
    rz *= scale;
  }

  return { x: rx, z: rz };
}

function pushEvent(world: SimWorld, evt: Omit<WorldEffectEvent, 'id'>) {
  if (world.events.length > 64) world.events.shift();
  world.events.push({
    ...evt,
    id: `ev-${world.nextSeq++}`,
  });
}

export function emitPlayerBoonEffect(
  world: SimWorld,
  player: PlayerState,
  label: string,
  color = '#e5a93c',
) {
  pushEvent(world, {
    kind: 'quest_complete',
    x: player.x,
    y: groundHeightAt(player.x, player.z) + 2.3,
    z: player.z,
    color,
    label,
    targetId: player.id,
  });
}

function awardPassXpWithNotify(world: SimWorld, player: PlayerState, passXp: number) {
  const leveledTier = grantBattlePassXp(player, passXp);
  if (leveledTier) {
    const tier = getBattlePassTier(player.monetization.battlePassXp);
    emitPlayerBoonEffect(world, player, `Covenant Pass Tier ${tier}!`, '#e5a93c');
  }
}

export function getSolisShrineBuffCount(world: SimWorld): number {
  return world.shrines.filter((s) => s.controllingFaction === 'solis').length;
}

export function grantPlayerXp(world: SimWorld, player: PlayerState, xpGain: number) {
  player.xp += xpGain;
  while (player.xp >= player.xpToNext) {
    player.xp -= player.xpToNext;
    player.level += 1;
    player.xpToNext = Math.round(player.xpToNext * 1.38);
    player.maxHp += 28;
    player.maxMana += 15;
    player.hp = player.maxHp;
    player.mana = player.maxMana;
    pushEvent(world, {
      kind: 'level_up',
      x: player.x,
      y: groundHeightAt(player.x, player.z) + 1.8,
      z: player.z,
      color: '#fde047',
      value: player.level,
      label: `Level ${player.level}!`,
      targetId: player.id,
    });
    world.onWorldAnnouncement?.(`${player.name} ascended to Level ${player.level}!`);
  }
}

function notifyQuestCompletions(
  world: SimWorld,
  player: PlayerState,
  completedDefs: { title: string }[],
) {
  for (const def of completedDefs) {
    pushEvent(world, {
      kind: 'quest_complete',
      x: player.x,
      y: groundHeightAt(player.x, player.z) + 2.3,
      z: player.z,
      color: '#e5a93c',
      label: `Quest Ready: ${def.title}`,
      targetId: player.id,
    });
  }
}

export function applyQuestEventToPlayer(
  world: SimWorld,
  player: PlayerState,
  event: Parameters<typeof advancePlayerQuests>[1],
) {
  const { updated, newlyCompleted } = advancePlayerQuests(player, event);
  if (updated) {
    notifyQuestCompletions(world, player, newlyCompleted);
    world.onPersistQuests?.(player);
  }
}

export function claimPlayerQuest(
  world: SimWorld,
  player: PlayerState,
  questId: string,
): boolean {
  const qp: QuestProgress | undefined = player.quests.find((q) => q.questId === questId);
  const def = QUEST_BY_ID[questId];
  if (!qp || !def || qp.status !== 'completed') return false;

  qp.status = 'claimed';
  qp.updatedAt = Date.now();

  player.gold += def.reward.gold;
  if (def.reward.potions) {
    player.potions += def.reward.potions;
  }
  if (def.reward.relic) {
    const r = def.reward.relic;
    const existing = player.inventory.find((i) => i.itemKey === r.itemKey);
    if (existing) {
      existing.quantity += 1;
      existing.power = Math.max(existing.power, r.power);
    } else {
      player.inventory.push({
        id: `qitem-${world.nextSeq++}`,
        itemKey: r.itemKey,
        name: r.name,
        rarity: r.rarity,
        slotType: r.slotType,
        quantity: 1,
        power: r.power,
      });
    }
    if (r.slotType === 'weapon') {
      player.weaponPower = Math.max(player.weaponPower, r.power);
    } else {
      player.charmPower = Math.max(player.charmPower, r.power);
    }
  }

  grantPlayerXp(world, player, def.reward.xp);
  awardPassXpWithNotify(world, player, 40);
  ensurePlayerQuests(player);

  pushEvent(world, {
    kind: 'quest_complete',
    x: player.x,
    y: groundHeightAt(player.x, player.z) + 2.2,
    z: player.z,
    color: '#34d399',
    label: `Claimed: ${def.title} (+${def.reward.xp} XP)`,
    targetId: player.id,
  });

  world.onPersistPlayer?.(player);
  world.onPersistQuests?.(player);
  return true;
}

export function awardXpAndLoot(
  world: SimWorld,
  player: PlayerState,
  enemy: EnemyState,
) {
  const xpGain = enemy.isBoss ? 140 : 32 + enemy.level * 12;
  const goldGain = enemy.isBoss ? 85 : 10 + enemy.level * 6;
  player.gold += goldGain;
  player.kills += 1;

  grantPlayerXp(world, player, xpGain);
  awardPassXpWithNotify(world, player, enemy.isBoss ? 35 : 12);

  // Advance combat quests
  const killAny = advancePlayerQuests(player, { kind: 'kill_any' });
  const killArch = advancePlayerQuests(player, {
    kind: 'kill_archetype',
    archetype: enemy.archetype,
  });
  const killBoss = enemy.isBoss
    ? advancePlayerQuests(player, { kind: 'kill_boss' })
    : { updated: false, newlyCompleted: [] };
  if (killAny.updated || killArch.updated || killBoss.updated) {
    notifyQuestCompletions(world, player, [
      ...killAny.newlyCompleted,
      ...killArch.newlyCompleted,
      ...killBoss.newlyCompleted,
    ]);
    world.onPersistQuests?.(player);
  }

  // Dynamic World Event participation & progression
  if (enemy.eventId && world.dynamicEvent && world.dynamicEvent.id === enemy.eventId && world.dynamicEvent.status === 'active') {
    const evt = world.dynamicEvent;
    const pts = enemy.archetype === 'colossus' ? 45 : 25;
    const prevScore = evt.participantScores[player.id]?.score ?? 0;
    evt.participantScores[player.id] = {
      name: player.name,
      score: prevScore + pts,
    };
    const deltaProg = evt.kind === 'dungeon_rift' ? 18 : 1;
    evt.progress = Math.min(evt.goal, evt.progress + deltaProg);
    world.onPersistWorldEvent?.(evt);
  }

  // Spawn collectible world loot drop
  const roll = ((world.nextSeq * 37 + Math.round(enemy.x * 13)) % 100 + 100) % 100;
  if (enemy.isBoss || enemy.eventId || roll < 68) {
    const isRelic = enemy.isBoss || roll < 24;
    const isPotion = !isRelic && roll < 48;
    const rarity: Rarity = enemy.isBoss ? 'relic' : roll < 10 ? 'epic' : 'rare';
    const relicPool = [
      { key: 'sun_crest', name: 'Crest of Solis', power: 12 },
      { key: 'astral_prism', name: 'Astral Shard Prism', power: 15 },
      { key: 'wardens_sigil', name: "Warden's War Sigil", power: 22 },
    ];
    const picked = relicPool[(enemy.isBoss ? 2 : roll) % relicPool.length];
    world.loot.push({
      id: `loot-${world.nextSeq++}`,
      x: enemy.x + ((roll % 5) - 2) * 0.35,
      z: enemy.z + (((roll >> 1) % 5) - 2) * 0.35,
      kind: isRelic ? 'relic' : isPotion ? 'potion' : 'gold',
      itemKey: isRelic ? picked.key : isPotion ? 'aether_flask' : 'sun_gold',
      name: isRelic ? picked.name : isPotion ? 'Aether Flask' : 'Sun Gold Pouch',
      rarity: isRelic ? rarity : 'common',
      power: isRelic ? picked.power + enemy.level * 2 : 0,
      amount: isRelic || isPotion ? 1 : 18 + enemy.level * 5,
      ttl: 45,
    });
  }

  world.onPersistPlayer?.(player);
}

export function damageEnemy(
  world: SimWorld,
  enemy: EnemyState,
  attacker: PlayerState,
  rawDamage: number,
  knockbackX = 0,
  knockbackZ = 0,
) {
  if (enemy.phase === 'ko' || enemy.hp <= 0) return;
  enemy.hiddenInCover = false;
  const buffMult = 1 + getSolisShrineBuffCount(world) * 0.08;
  const whetMult = attacker.philosophy.whetstoneExpiresAt > world.nowMs ? 1.15 : 1;
  let oilBonus = 0;
  if (attacker.philosophy.weaponOil !== 'none' && attacker.philosophy.oilCharges > 0) {
    const oilSpec = WEAPON_OIL_SPECS[attacker.philosophy.weaponOil];
    oilBonus = oilSpec.bonusDamage;
    attacker.philosophy.oilCharges = Math.max(0, attacker.philosophy.oilCharges - 1);
    if (attacker.philosophy.oilCharges === 0) {
      attacker.philosophy.weaponOil = 'none';
    }
    if (oilSpec.id === 'serpent_venom') {
      enemy.stunTimer = Math.max(enemy.stunTimer, 0.35);
    }
  }

  const dmg = Math.max(1, Math.round((rawDamage * buffMult * whetMult) + oilBonus));
  enemy.hp = Math.max(0, enemy.hp - dmg);
  enemy.hurtFlash = 0.14;
  enemy.targetPlayerId = attacker.id;

  // Physics-feel momentum impulse (scaled down for heavy bosses)
  const massScale = enemy.isBoss ? 0.38 : enemy.archetype === 'colossus' ? 0.55 : 1.0;
  enemy.impulseX += knockbackX * 6.5 * massScale;
  enemy.impulseZ += knockbackZ * 6.5 * massScale;

  const pushed = resolveWorldPosition(
    enemy.x + knockbackX * 0.45 * massScale,
    enemy.z + knockbackZ * 0.45 * massScale,
    enemy.isBoss ? 1.3 : 0.8,
  );
  enemy.x = pushed.x;
  enemy.z = pushed.z;
  enemy.y = groundHeightAt(enemy.x, enemy.z);

  pushEvent(world, {
    kind: 'damage',
    x: enemy.x,
    y: enemy.y + (enemy.isBoss ? 2.6 : 1.7),
    z: enemy.z,
    color: oilBonus > 0 ? '#fb923c' : '#fbbf24',
    value: dmg,
    targetId: enemy.id,
  });

  if (enemy.hp <= 0) {
    enemy.phase = 'ko';
    enemy.koTimer = 0.42;
    enemy.respawnTimer = enemy.eventId ? 9999 : enemy.isBoss ? 22 : 12;
    awardXpAndLoot(world, attacker, enemy);
  }
}

export function executePlayerSkill(
  world: SimWorld,
  player: PlayerState,
  skillIndex: 0 | 1 | 2,
  aimX: number,
  aimZ: number,
): boolean {
  if (!player.alive) return false;
  const spec = CLASS_SPECS[player.heroClass];
  const skill = spec.skills[skillIndex];
  if (!skill) return false;
  if (player.cooldowns[skillIndex] > 0.01) return false;
  if (player.mana < skill.manaCost) return false;

  const stanceMod = STANCE_MODIFIERS[player.philosophy.activeStance];
  player.mana -= skill.manaCost;
  player.philosophy.stamina = Math.max(0, player.philosophy.stamina - stanceMod.staminaCost * 0.65);
  player.cooldowns[skillIndex] = Number((skill.cooldown * stanceMod.cooldownMult).toFixed(2));
  player.castFlashTimer = 0.24;
  player.castSkillIndex = skillIndex;

  let dx = aimX - player.x;
  let dz = aimZ - player.z;
  const dist = Math.hypot(dx, dz);
  if (dist > 0.05) {
    dx /= dist;
    dz /= dist;
    player.facing = Math.atan2(dx, dz);
  } else {
    dx = Math.sin(player.facing);
    dz = Math.cos(player.facing);
  }

  const adMults = getActiveAdBuffMultipliers(player, world.nowMs);
  const powerBonus = 1 + (player.level - 1) * 0.14 + (player.weaponPower + player.charmPower) * 0.025;
  const damage = Math.round(skill.baseDamage * powerBonus * adMults.damageMult * stanceMod.damageMult);

  if (skill.kind === 'cleave' || skill.kind === 'shockwave') {
    const isFullCircle = skill.kind === 'shockwave';
    pushEvent(world, {
      kind: isFullCircle ? 'nova' : 'slash',
      x: player.x,
      y: groundHeightAt(player.x, player.z) + 0.35,
      z: player.z,
      angle: player.facing,
      radius: skill.radius,
      color: stanceMod.id === 'heavy' ? '#f59e0b' : skill.color,
      targetId: player.id,
    });

    for (const enemy of world.enemies) {
      if (enemy.phase === 'ko') continue;
      const ex = enemy.x - player.x;
      const ez = enemy.z - player.z;
      const edist = Math.hypot(ex, ez);
      const hitRadius = skill.radius + (enemy.isBoss ? 1.2 : 0.65);
      if (edist <= hitRadius) {
        if (!isFullCircle && edist > 0.1) {
          const dot = (ex / edist) * dx + (ez / edist) * dz;
          if (dot < -0.15) continue;
        }
        const kb = (edist > 0.01 ? 0.72 : 0) * stanceMod.knockbackMult;
        damageEnemy(world, enemy, player, damage, (ex / (edist || 1)) * kb, (ez / (edist || 1)) * kb);
        if ((isFullCircle || stanceMod.id === 'heavy') && enemy.hp > 0) {
          enemy.phase = 'recover';
          enemy.phaseTimer = isFullCircle ? 0.75 : 0.45;
        }
      }
    }
  } else if (skill.kind === 'nova' || skill.kind === 'snare') {
    const clampedDist = Math.min(dist || 0, skill.range);
    const targetX = player.x + dx * clampedDist;
    const targetZ = player.z + dz * clampedDist;
    pushEvent(world, {
      kind: 'nova',
      x: targetX,
      y: groundHeightAt(targetX, targetZ) + 0.25,
      z: targetZ,
      radius: skill.radius,
      color: skill.color,
      targetId: player.id,
    });
    for (const enemy of world.enemies) {
      if (enemy.phase === 'ko') continue;
      if (Math.hypot(enemy.x - targetX, enemy.z - targetZ) <= skill.radius + 0.8) {
        damageEnemy(world, enemy, player, damage);
        if (skill.kind === 'snare' && enemy.hp > 0) {
          enemy.phase = 'recover';
          enemy.phaseTimer = 1.1;
        }
      }
    }
  } else if (skill.kind === 'bolt' || skill.kind === 'volley') {
    const count = skill.kind === 'volley' ? 5 : 1;
    const spread = skill.kind === 'volley' ? 0.14 : 0;
    const speed = player.heroClass === 'ranger' ? 24 : 21;
    const baseAngle = Math.atan2(dx, dz);

    let boltBonus = 0;
    let boltColor = skill.color;
    let boltSlow = 0;
    if (player.philosophy.arblastBolt !== 'standard' && player.philosophy.boltAmmo > 0) {
      const boltSpec = ARBLAST_BOLT_SPECS[player.philosophy.arblastBolt];
      boltBonus = boltSpec.bonusDamage;
      boltColor = boltSpec.color;
      if (boltSpec.id === 'poison') boltSlow = 1.8;
      player.philosophy.boltAmmo = Math.max(0, player.philosophy.boltAmmo - 1);
      if (player.philosophy.boltAmmo === 0) {
        player.philosophy.arblastBolt = 'standard';
      }
    }

    pushEvent(world, {
      kind: 'volley',
      x: player.x + dx * 0.9,
      y: groundHeightAt(player.x, player.z) + 1.1,
      z: player.z + dz * 0.9,
      angle: baseAngle,
      color: boltColor,
    });

    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * spread;
      const a = baseAngle + offset;
      world.projectiles.push({
        id: `proj-${world.nextSeq++}`,
        ownerId: player.id,
        fromEnemy: false,
        x: player.x + Math.sin(a) * 0.9,
        z: player.z + Math.cos(a) * 0.9,
        vx: Math.sin(a) * speed,
        vz: Math.cos(a) * speed,
        radius: skill.radius,
        damage: damage + boltBonus,
        ttl: skill.range / speed,
        color: boltColor,
        slowSeconds: boltSlow,
      });
    }
  }

  return true;
}

export function setPlayerCombatStance(
  world: SimWorld,
  player: PlayerState,
  stance: CombatStance,
): boolean {
  if (!STANCE_MODIFIERS[stance]) return false;
  player.philosophy.activeStance = stance;
  emitPlayerBoonEffect(world, player, `${STANCE_MODIFIERS[stance].label} Stance`, STANCE_MODIFIERS[stance].accentColor);
  world.onPersistPlayer?.(player);
  return true;
}

export function togglePlayerMount(world: SimWorld, player: PlayerState): boolean {
  if (!player.alive) return false;
  player.philosophy.mounted = !player.philosophy.mounted;
  emitPlayerBoonEffect(
    world,
    player,
    player.philosophy.mounted ? 'Mounted Warhorse' : 'Dismounted',
    '#e5a93c',
  );
  world.onPersistPlayer?.(player);
  return true;
}

export function executeMountedManeuver(
  world: SimWorld,
  player: PlayerState,
  maneuver: MountedManeuverKind,
  dirX?: number,
  dirZ?: number,
): { ok: boolean; reason?: string } {
  if (!player.alive) return { ok: false, reason: 'Defeated' };
  if (player.philosophy.maneuverCooldown > 0.05) {
    return { ok: false, reason: 'Maneuver recovering' };
  }
  if (player.philosophy.stamina < 20) {
    return { ok: false, reason: 'Insufficient Stamina' };
  }
  if (!player.philosophy.mounted) {
    player.philosophy.mounted = true;
  }

  player.philosophy.stamina = Math.max(0, player.philosophy.stamina - 20);
  player.philosophy.maneuverCooldown = 3.2;

  const baseAngle =
    dirX !== undefined && dirZ !== undefined && Math.hypot(dirX, dirZ) > 0.05
      ? Math.atan2(dirX, dirZ)
      : player.facing;

  if (maneuver === 'dash') {
    player.dashDirX = Math.sin(baseAngle);
    player.dashDirZ = Math.cos(baseAngle);
    player.dashTimer = 0.28;
    player.invulnTimer = Math.max(player.invulnTimer, 0.35);
    player.facing = baseAngle;
    pushEvent(world, {
      kind: 'dash',
      x: player.x,
      y: groundHeightAt(player.x, player.z) + 0.6,
      z: player.z,
      angle: baseAngle,
      color: '#e5a93c',
    });
    for (const enemy of world.enemies) {
      if (enemy.phase === 'ko') continue;
      const ex = enemy.x - player.x;
      const ez = enemy.z - player.z;
      const dist = Math.hypot(ex, ez);
      if (dist <= 4.4) {
        damageEnemy(
          world,
          enemy,
          player,
          26 + player.level * 5,
          (ex / (dist || 1)) * 1.4,
          (ez / (dist || 1)) * 1.4,
        );
      }
    }
  } else if (maneuver === 'turn') {
    // Hard J-turn drift around threats with quick counter-strike
    player.facing = baseAngle + Math.PI * 0.75;
    player.invulnTimer = Math.max(player.invulnTimer, 0.4);
    pushEvent(world, {
      kind: 'slash',
      x: player.x,
      y: groundHeightAt(player.x, player.z) + 0.5,
      z: player.z,
      angle: player.facing,
      radius: 3.4,
      color: '#38bdf8',
    });
    for (const enemy of world.enemies) {
      if (enemy.phase === 'ko') continue;
      if (Math.hypot(enemy.x - player.x, enemy.z - player.z) <= 3.6) {
        damageEnemy(world, enemy, player, 22 + player.level * 4);
      }
    }
  } else {
    // Mounted Spin: 360-degree warhorse wheel knocking back encirclement
    pushEvent(world, {
      kind: 'nova',
      x: player.x,
      y: groundHeightAt(player.x, player.z) + 0.45,
      z: player.z,
      radius: 4.5,
      color: '#f59e0b',
    });
    for (const enemy of world.enemies) {
      if (enemy.phase === 'ko') continue;
      const ex = enemy.x - player.x;
      const ez = enemy.z - player.z;
      const d = Math.hypot(ex, ez);
      if (d <= 4.8) {
        damageEnemy(
          world,
          enemy,
          player,
          30 + player.level * 5,
          (ex / (d || 1)) * 1.9,
          (ez / (d || 1)) * 1.9,
        );
        if (enemy.hp > 0) {
          enemy.stunTimer = Math.max(enemy.stunTimer, 0.8);
        }
      }
    }
  }

  return { ok: true };
}

export function executeCampPrep(
  world: SimWorld,
  player: PlayerState,
  action: PrepCampAction,
): { ok: boolean; notice: string } {
  if (!player.alive) return { ok: false, notice: 'Cannot prepare while fallen' };

  if (action.kind === 'whetstone') {
    player.philosophy.whetstoneExpiresAt = world.nowMs + 120_000;
    pushEvent(world, {
      kind: 'whetstone',
      x: player.x,
      y: groundHeightAt(player.x, player.z) + 1.6,
      z: player.z,
      color: '#fde047',
      label: 'Whetstone Ring (+15% Steel)',
      targetId: player.id,
    });
    world.onPersistPlayer?.(player);
    return { ok: true, notice: 'Blade sharpened on whetstone (+15% Damage for 2m)' };
  }

  if (action.kind === 'apply_oil') {
    const spec = WEAPON_OIL_SPECS[action.oil];
    if (!spec) return { ok: false, notice: 'Unknown oil' };
    if (player.gold < spec.goldCost) {
      return { ok: false, notice: `Need ${spec.goldCost} Gold for ${spec.name}` };
    }
    player.gold -= spec.goldCost;
    player.philosophy.weaponOil = spec.id;
    player.philosophy.oilCharges = spec.charges;
    emitPlayerBoonEffect(world, player, `${spec.name} (${spec.charges})`, spec.color);
    world.onPersistPlayer?.(player);
    return { ok: true, notice: `Coated weapon with ${spec.name} (${spec.charges} strikes)` };
  }

  if (action.kind === 'craft_bolts') {
    const spec = ARBLAST_BOLT_SPECS[action.bolt];
    if (!spec) return { ok: false, notice: 'Unknown bolt type' };
    if (player.philosophy.potentialScore >= spec.potentialCost) {
      player.philosophy.potentialScore -= spec.potentialCost;
    } else if (player.gold >= spec.goldCost) {
      player.gold -= spec.goldCost;
    } else {
      return { ok: false, notice: `Need ${spec.potentialCost} Potential or ${spec.goldCost} Gold` };
    }
    player.philosophy.arblastBolt = spec.id;
    player.philosophy.boltAmmo += spec.ammoGrant;
    emitPlayerBoonEffect(world, player, `+${spec.ammoGrant} ${spec.name}`, spec.color);
    world.onPersistPlayer?.(player);
    return { ok: true, notice: `Fletched +${spec.ammoGrant} ${spec.name} for hero & Outriders` };
  }

  // Field Triage
  if (player.philosophy.potentialScore < 10 && player.gold < 15) {
    return { ok: false, notice: 'Need 10 Potential or 15 Gold for Field Triage' };
  }
  if (player.philosophy.potentialScore >= 10) {
    player.philosophy.potentialScore -= 10;
  } else {
    player.gold -= 15;
  }
  const healAmt = Math.round(player.maxHp * 0.4);
  player.hp = Math.min(player.maxHp, player.hp + healAmt);
  player.philosophy.stamina = player.philosophy.maxStamina;
  pushEvent(world, {
    kind: 'heal',
    x: player.x,
    y: groundHeightAt(player.x, player.z) + 1.8,
    z: player.z,
    color: '#34d399',
    value: healAmt,
    targetId: player.id,
  });
  world.onPersistPlayer?.(player);
  return { ok: true, notice: `Graymstrum bound wounds (+${healAmt} HP & Full Stamina)` };
}

export function resolvePhilosophicalChoice(
  world: SimWorld,
  player: PlayerState,
  dilemmaId: string,
  optionId: string,
): { ok: boolean; notice: string; path?: 'athelstane' | 'graymstrum'; label?: string } {
  const dilemma = ENCOUNTER_DILEMMAS.find((d) => d.id === dilemmaId);
  if (!dilemma) return { ok: false, notice: 'Unknown dilemma' };
  const option = dilemma.options.find((o) => o.id === optionId);
  if (!option) return { ok: false, notice: 'Unknown option' };
  if (player.philosophy.resolvedDilemmas.includes(dilemmaId)) {
    return { ok: false, notice: 'Decision already etched into your legacy' };
  }

  player.philosophy.resolvedDilemmas.push(dilemmaId);
  if (option.path === 'athelstane') {
    player.philosophy.athelstaneAffinity = Math.min(100, player.philosophy.athelstaneAffinity + option.affinityDelta);
  } else {
    player.philosophy.graymstrumAffinity = Math.min(100, player.philosophy.graymstrumAffinity + option.affinityDelta);
  }

  // Mechanical encounter outcomes
  if (option.id === 'bellow_challenge') {
    player.philosophy.stamina = Math.min(player.philosophy.maxStamina, player.philosophy.stamina + 25);
    for (const e of world.enemies) {
      if (e.hiddenInCover) e.hiddenInCover = false;
    }
    if (world.dynamicEvent?.kind === 'barrow_ambush') {
      world.dynamicEvent.whistleTriggered = true;
      world.dynamicEvent.ambushPhase = 2;
    }
    pushEvent(world, {
      kind: 'roar',
      x: player.x,
      y: groundHeightAt(player.x, player.z) + 1.4,
      z: player.z,
      radius: 8,
      color: '#f59e0b',
      label: 'Athelstane’s Challenge!',
    });
  } else if (option.id === 'feint_deception') {
    player.philosophy.arblastBolt = 'fire';
    player.philosophy.boltAmmo += 3;
    for (const e of world.enemies) {
      if (e.archetype === 'thief' && e.phase !== 'ko') {
        e.stunTimer = Math.max(e.stunTimer, 2.2);
      }
    }
  } else if (option.id === 'crush_mercy') {
    player.gold += 18;
    player.philosophy.activeStance = 'heavy';
  } else if (option.id === 'extract_intel') {
    player.philosophy.potentialScore += 15;
    player.philosophy.weaponOil = 'barrowbane';
    player.philosophy.oilCharges += 6;
  } else if (option.id === 'blood_oath') {
    player.philosophy.whetstoneExpiresAt = world.nowMs + 150_000;
    player.hp = Math.min(player.maxHp, player.hp + Math.round(player.maxHp * 0.4));
  } else if (option.id === 'klepsydra_pact') {
    player.philosophy.potentialScore += 30;
    player.philosophy.arblastBolt = 'poison';
    player.philosophy.boltAmmo += 4;
  }

  emitPlayerBoonEffect(
    world,
    player,
    `${option.path === 'athelstane' ? "Athelstane's Way" : "Graymstrum's Way"} +${option.affinityDelta}`,
    option.path === 'athelstane' ? '#f59e0b' : '#38bdf8',
  );
  world.onPersistPlayer?.(player);
  return {
    ok: true,
    notice: option.effectText,
    path: option.path,
    label: option.label,
  };
}

export function executePathAbility(
  world: SimWorld,
  player: PlayerState,
  abilityId: string,
): { ok: boolean; notice: string } {
  if (!player.alive) return { ok: false, notice: 'Cannot use while defeated' };
  const def = PHILOSOPHY_ABILITIES.find((a) => a.id === abilityId);
  if (!def) return { ok: false, notice: 'Unknown ability' };

  const affinity =
    def.path === 'athelstane'
      ? player.philosophy.athelstaneAffinity
      : player.philosophy.graymstrumAffinity;
  if (affinity < def.unlockAffinity) {
    return { ok: false, notice: `Requires ${def.unlockAffinity} ${def.path} affinity` };
  }

  const readyAt = player.philosophy.pathAbilityCooldowns[abilityId] ?? 0;
  if (readyAt > world.nowMs) {
    const rem = Math.ceil((readyAt - world.nowMs) / 1000);
    return { ok: false, notice: `${def.name} ready in ${rem}s` };
  }

  if (player.philosophy.stamina < def.staminaCost) {
    return { ok: false, notice: `Requires ${def.staminaCost} Stamina` };
  }

  player.philosophy.stamina -= def.staminaCost;
  player.philosophy.pathAbilityCooldowns[abilityId] = world.nowMs + def.cooldownSec * 1000;

  if (abilityId === 'unstoppable_charge') {
    triggerPlayerDash(world, player, Math.sin(player.facing), Math.cos(player.facing));
    for (const enemy of world.enemies) {
      if (enemy.phase === 'ko') continue;
      const ex = enemy.x - player.x;
      const ez = enemy.z - player.z;
      const d = Math.hypot(ex, ez);
      if (d <= 5.2) {
        damageEnemy(world, enemy, player, 48 + player.level * 8, (ex / (d || 1)) * 2.1, (ez / (d || 1)) * 2.1);
        enemy.stunTimer = Math.max(enemy.stunTimer, 1.0);
      }
    }
  } else if (abilityId === 'battle_roar') {
    pushEvent(world, {
      kind: 'roar',
      x: player.x,
      y: groundHeightAt(player.x, player.z) + 1.2,
      z: player.z,
      radius: 7.5,
      color: '#ef4444',
      label: 'Battle Roar!',
    });
    for (const enemy of world.enemies) {
      if (enemy.phase === 'ko') continue;
      if (Math.hypot(enemy.x - player.x, enemy.z - player.z) <= 7.8) {
        enemy.hiddenInCover = false;
        enemy.stunTimer = Math.max(enemy.stunTimer, 1.8);
        damageEnemy(world, enemy, player, 22 + player.level * 4);
      }
    }
  } else if (abilityId === 'brutal_execution') {
    pushEvent(world, {
      kind: 'slash',
      x: player.x,
      y: groundHeightAt(player.x, player.z) + 0.5,
      z: player.z,
      angle: player.facing,
      radius: 4.2,
      color: '#fb7185',
    });
    for (const enemy of world.enemies) {
      if (enemy.phase === 'ko') continue;
      if (Math.hypot(enemy.x - player.x, enemy.z - player.z) <= 4.5) {
        const executeMult = enemy.hp < enemy.maxHp * 0.45 ? 1.8 : 1.1;
        damageEnemy(world, enemy, player, Math.round((56 + player.level * 9) * executeMult));
      }
    }
  } else if (abilityId === 'plausible_lie') {
    pushEvent(world, {
      kind: 'whistle',
      x: player.x,
      y: groundHeightAt(player.x, player.z) + 1.8,
      z: player.z,
      radius: 9,
      color: '#38bdf8',
      label: 'Plausible Lie!',
    });
    for (const enemy of world.enemies) {
      if (enemy.phase === 'ko') continue;
      if (Math.hypot(enemy.x - player.x, enemy.z - player.z) <= 10) {
        enemy.hiddenInCover = false;
        enemy.stunTimer = Math.max(enemy.stunTimer, 2.4);
        enemy.aiRole = 'retreat';
      }
    }
  } else if (abilityId === 'field_triage') {
    const healAmt = Math.round(player.maxHp * 0.35);
    player.hp = Math.min(player.maxHp, player.hp + healAmt);
    pushEvent(world, {
      kind: 'heal',
      x: player.x,
      y: groundHeightAt(player.x, player.z) + 1.8,
      z: player.z,
      color: '#34d399',
      value: healAmt,
      targetId: player.id,
    });
  } else if (abilityId === 'tactical_barrage') {
    const target =
      world.enemies.find((e) => e.id === player.targetEnemyId && e.phase !== 'ko') ||
      world.enemies.find((e) => e.phase !== 'ko' && Math.hypot(e.x - player.x, e.z - player.z) <= 16);
    if (target) {
      for (let i = -1; i <= 1; i++) {
        const dx = target.x - player.x;
        const dz = target.z - player.z;
        const a = Math.atan2(dx, dz) + i * 0.14;
        world.projectiles.push({
          id: `proj-${world.nextSeq++}`,
          ownerId: player.id,
          fromEnemy: false,
          x: player.x + Math.sin(a) * 1.1,
          z: player.z + Math.cos(a) * 1.1,
          vx: Math.sin(a) * 24,
          vz: Math.cos(a) * 24,
          radius: 0.9,
          damage: 34 + player.level * 6,
          ttl: 0.85,
          color: '#c084fc',
          slowSeconds: 1.5,
        });
      }
    }
  }

  return { ok: true, notice: `${def.name} executed!` };
}

export function triggerPlayerDash(world: SimWorld, player: PlayerState, dirX: number, dirZ: number): boolean {
  if (!player.alive || player.dashCooldown > 0.05) return false;
  const len = Math.hypot(dirX, dirZ);
  const nx = len > 0.05 ? dirX / len : Math.sin(player.facing);
  const nz = len > 0.05 ? dirZ / len : Math.cos(player.facing);
  player.dashDirX = nx;
  player.dashDirZ = nz;
  player.dashTimer = 0.19;
  player.dashCooldown = 1.65;
  player.invulnTimer = Math.max(player.invulnTimer, 0.28);
  player.facing = Math.atan2(nx, nz);
  player.input.waypointX = null;
  player.input.waypointZ = null;
  pushEvent(world, {
    kind: 'dash',
    x: player.x,
    y: groundHeightAt(player.x, player.z) + 0.5,
    z: player.z,
    angle: player.facing,
    color: CLASS_SPECS[player.heroClass].accentColor,
  });
  return true;
}

export function usePlayerPotion(world: SimWorld, player: PlayerState): boolean {
  if (!player.alive || player.potions <= 0 || player.hp >= player.maxHp) return false;
  player.potions -= 1;
  const healAmt = Math.round(player.maxHp * 0.45);
  player.hp = Math.min(player.maxHp, player.hp + healAmt);
  player.mana = Math.min(player.maxMana, player.mana + 30);
  pushEvent(world, {
    kind: 'heal',
    x: player.x,
    y: groundHeightAt(player.x, player.z) + 1.8,
    z: player.z,
    color: '#34d399',
    value: healAmt,
    targetId: player.id,
  });
  world.onPersistPlayer?.(player);
  return true;
}

export function equipInventoryItem(player: PlayerState, itemId: string): boolean {
  const item = player.inventory.find((i) => i.id === itemId);
  if (!item) return false;
  if (item.slotType === 'weapon') {
    player.weaponPower = item.power;
    return true;
  }
  if (item.slotType === 'charm') {
    player.charmPower = item.power;
    return true;
  }
  return false;
}

export function stepPlayer(world: SimWorld, player: PlayerState, dt: number) {
  pruneExpiredAdBuffs(player, world.nowMs);
  const adMults = getActiveAdBuffMultipliers(player, world.nowMs);

  player.cooldowns[0] = Math.max(0, player.cooldowns[0] - dt);
  player.cooldowns[1] = Math.max(0, player.cooldowns[1] - dt);
  player.cooldowns[2] = Math.max(0, player.cooldowns[2] - dt);
  player.dashCooldown = Math.max(0, player.dashCooldown - dt * adMults.dashRecoveryMult);
  player.castFlashTimer = Math.max(0, player.castFlashTimer - dt);
  player.hurtTimer = Math.max(0, player.hurtTimer - dt);
  player.invulnTimer = Math.max(0, player.invulnTimer - dt);
  player.philosophy.maneuverCooldown = Math.max(0, player.philosophy.maneuverCooldown - dt);

  if (!player.alive) {
    player.vx = 0;
    player.vz = 0;
    return;
  }

  const shrineBuffs = getSolisShrineBuffCount(world);
  const inSanctuary = Math.hypot(player.x, player.z - 14) <= SANCTUARY_SAFE_RADIUS;
  const hpRegen = (inSanctuary ? 18 : 2.5) + shrineBuffs * 2.2;
  const manaRegen = (inSanctuary ? 22 : 9.5) + shrineBuffs * 2.5;
  if (world.time - player.lastHitTime > 2.2 || inSanctuary) {
    player.hp = Math.min(player.maxHp, player.hp + hpRegen * dt);
  }
  player.mana = Math.min(player.maxMana, player.mana + manaRegen * dt);
  player.philosophy.stamina = Math.min(
    player.philosophy.maxStamina,
    player.philosophy.stamina + (inSanctuary ? 24 : 13) * dt,
  );

  const spec = CLASS_SPECS[player.heroClass];
  const stanceMod = STANCE_MODIFIERS[player.philosophy.activeStance];
  const mountMult = player.philosophy.mounted ? 1.32 : 1.0;
  const speed =
    spec.moveSpeed *
    (1 + shrineBuffs * 0.05) *
    adMults.moveSpeedMult *
    stanceMod.moveSpeedMult *
    mountMult;

  if (player.dashTimer > 0) {
    player.dashTimer = Math.max(0, player.dashTimer - dt);
    const dashSpeed = speed * 2.75;
    player.vx = player.dashDirX * dashSpeed;
    player.vz = player.dashDirZ * dashSpeed;
  } else {
    let dirX = player.input.moveX;
    let dirZ = player.input.moveZ;
    const inputLen = Math.hypot(dirX, dirZ);

    if (inputLen > 0.05) {
      player.input.waypointX = null;
      player.input.waypointZ = null;
      dirX /= Math.max(1, inputLen);
      dirZ /= Math.max(1, inputLen);
      player.vx = dirX * speed;
      player.vz = dirZ * speed;
      player.facing = Math.atan2(dirX, dirZ);
    } else if (player.input.waypointX !== null && player.input.waypointZ !== null) {
      const wx = player.input.waypointX - player.x;
      const wz = player.input.waypointZ - player.z;
      const wdist = Math.hypot(wx, wz);
      if (wdist < 0.35) {
        player.input.waypointX = null;
        player.input.waypointZ = null;
        player.vx = 0;
        player.vz = 0;
      } else {
        const nx = wx / wdist;
        const nz = wz / wdist;
        player.vx = nx * speed;
        player.vz = nz * speed;
        player.facing = Math.atan2(nx, nz);
      }
    } else {
      player.vx = 0;
      player.vz = 0;
    }
  }

  const next = resolveWorldPosition(player.x + player.vx * dt, player.z + player.vz * dt, 0.7);
  player.x = next.x;
  player.z = next.z;
  player.y = groundHeightAt(player.x, player.z);

  const currentZone = getZoneName(player.x, player.z);
  if (!player.visitedZones.includes(currentZone)) {
    player.visitedZones.push(currentZone);
    applyQuestEventToPlayer(world, player, { kind: 'visit_zone', zoneName: currentZone });
  }
}

function hurtPlayer(world: SimWorld, player: PlayerState, damage: number) {
  if (!player.alive || player.invulnTimer > 0) return;
  if (Math.hypot(player.x, player.z - 14) <= SANCTUARY_SAFE_RADIUS) return;

  player.hp = Math.max(0, player.hp - damage);
  player.hurtTimer = 0.25;
  player.lastHitTime = world.time;
  pushEvent(world, {
    kind: 'damage',
    x: player.x,
    y: groundHeightAt(player.x, player.z) + 1.9,
    z: player.z,
    color: '#fb7185',
    value: damage,
    targetId: player.id,
  });

  if (player.hp <= 0) {
    player.alive = false;
    player.vx = 0;
    player.vz = 0;
    player.input.waypointX = null;
    player.input.waypointZ = null;
    world.onPersistPlayer?.(player);
  }
}

function countActiveAttackers(world: SimWorld): number {
  let count = 0;
  for (const e of world.enemies) {
    if (e.phase === 'windup' || e.phase === 'active') count += 1;
  }
  return count;
}

export function stepEnemies(world: SimWorld, dt: number) {
  let activeAttackTokens = countActiveAttackers(world);

  const thievesAlive = world.enemies.filter(
    (e) => e.phase !== 'ko' && (e.archetype === 'thief' || e.archetype === 'batras'),
  ).length;
  const batrasAlive = world.enemies.some(
    (e) => e.phase !== 'ko' && e.archetype === 'batras',
  );
  const whistleTriggered =
    world.dynamicEvent?.kind === 'barrow_ambush'
      ? Boolean(world.dynamicEvent.whistleTriggered)
      : true;

  for (const enemy of world.enemies) {
    enemy.hurtFlash = Math.max(0, enemy.hurtFlash - dt);
    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
    enemy.stunTimer = Math.max(0, enemy.stunTimer - dt);

    // Apply & damp momentum knockback impulse
    if (Math.abs(enemy.impulseX) > 0.05 || Math.abs(enemy.impulseZ) > 0.05) {
      const impPos = resolveWorldPosition(
        enemy.x + enemy.impulseX * dt,
        enemy.z + enemy.impulseZ * dt,
        enemy.isBoss ? 1.2 : 0.75,
      );
      enemy.x = impPos.x;
      enemy.z = impPos.z;
      enemy.y = groundHeightAt(enemy.x, enemy.z);
      const decay = Math.exp(-8.5 * dt);
      enemy.impulseX *= decay;
      enemy.impulseZ *= decay;
    }

    if (enemy.phase === 'ko') {
      enemy.koTimer -= dt;
      if (enemy.koTimer <= 0) {
        if (enemy.eventId) continue; // Event enemies do not respawn indefinitely
        enemy.respawnTimer -= dt;
        if (enemy.respawnTimer <= 0) {
          enemy.hp = enemy.maxHp;
          enemy.x = enemy.homeX;
          enemy.z = enemy.homeZ;
          enemy.y = groundHeightAt(enemy.x, enemy.z);
          enemy.phase = 'patrol';
          enemy.targetPlayerId = null;
          enemy.hiddenInCover = false;
        }
      }
      continue;
    }

    if (enemy.stunTimer > 0) {
      enemy.phase = 'recover';
      continue;
    }

    let target: PlayerState | null = null;
    let bestDist = 17.5;
    for (const p of world.players.values()) {
      if (!p.alive) continue;
      if (Math.hypot(p.x, p.z - 14) <= SANCTUARY_SAFE_RADIUS) continue;
      const d = Math.hypot(p.x - enemy.x, p.z - enemy.z);
      if (d < bestDist) {
        bestDist = d;
        target = p;
      }
    }

    if (!target) {
      enemy.targetPlayerId = null;
      const dxHome = enemy.homeX - enemy.x;
      const dzHome = enemy.homeZ - enemy.z;
      const dHome = Math.hypot(dxHome, dzHome);
      if (dHome > 0.6) {
        const nx = dxHome / dHome;
        const nz = dzHome / dHome;
        const pos = resolveWorldPosition(enemy.x + nx * 3.1 * dt, enemy.z + nz * 3.1 * dt, 0.8);
        enemy.x = pos.x;
        enemy.z = pos.z;
        enemy.facing = Math.atan2(nx, nz);
      } else {
        enemy.phase = 'patrol';
      }
      enemy.y = groundHeightAt(enemy.x, enemy.z);
      continue;
    }

    enemy.targetPlayerId = target.id;
    const dx = target.x - enemy.x;
    const dz = target.z - enemy.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const nx = dx / dist;
    const nz = dz / dist;

    if (enemy.phase === 'recover') {
      enemy.phaseTimer -= dt;
      if (enemy.phaseTimer <= 0) enemy.phase = 'approach';
      continue;
    }

    if (enemy.phase === 'windup') {
      enemy.phaseTimer -= dt;
      if (enemy.phaseTimer <= 0) {
        enemy.phase = 'active';
        if (enemy.archetype === 'colossus') {
          enemy.phaseTimer = 0.28;
        } else {
          enemy.phaseTimer = 0.12;
          if (enemy.archetype === 'acolyte' || (enemy.archetype === 'thief' && enemy.aiRole === 'retreat')) {
            const bdx = enemy.telegraphX - enemy.x;
            const bdz = enemy.telegraphZ - enemy.z;
            const blen = Math.hypot(bdx, bdz) || 1;
            world.projectiles.push({
              id: `eproj-${world.nextSeq++}`,
              ownerId: enemy.id,
              fromEnemy: true,
              x: enemy.x + (bdx / blen) * 0.8,
              z: enemy.z + (bdz / blen) * 0.8,
              vx: (bdx / blen) * 14,
              vz: (bdz / blen) * 14,
              radius: 0.75,
              damage: 16 + enemy.level * 4,
              ttl: 1.5,
              color: enemy.archetype === 'thief' ? '#fb7185' : '#c084fc',
              slowSeconds: 0,
            });
          } else {
            const hitRadius = enemy.telegraphRadius;
            const hitDamage = enemy.isBoss ? 34 + enemy.level * 5 : 16 + enemy.level * 4;
            for (const p of world.players.values()) {
              if (Math.hypot(p.x - enemy.telegraphX, p.z - enemy.telegraphZ) <= hitRadius + 0.5) {
                hurtPlayer(world, p, hitDamage);
              }
            }
          }
        }
      }
      continue;
    }

    if (enemy.phase === 'active') {
      enemy.phaseTimer -= dt;
      if (enemy.archetype === 'colossus') {
        const ldx = enemy.telegraphX - enemy.x;
        const ldz = enemy.telegraphZ - enemy.z;
        const ldist = Math.hypot(ldx, ldz);
        if (ldist > 0.3) {
          const chargePos = resolveWorldPosition(
            enemy.x + (ldx / ldist) * 17.5 * dt,
            enemy.z + (ldz / ldist) * 17.5 * dt,
            1.05,
          );
          enemy.x = chargePos.x;
          enemy.z = chargePos.z;
        }
        for (const p of world.players.values()) {
          if (Math.hypot(p.x - enemy.x, p.z - enemy.z) <= 1.75) {
            hurtPlayer(world, p, 28 + enemy.level * 5);
          }
        }
      }
      if (enemy.phaseTimer <= 0) {
        enemy.phase = 'recover';
        enemy.phaseTimer = enemy.isBoss ? 0.65 : 0.45;
        enemy.attackCooldown =
          enemy.archetype === 'stalker' || enemy.archetype === 'thief'
            ? 1.35
            : enemy.archetype === 'colossus'
              ? 2.4
              : 1.9;
      }
      enemy.y = groundHeightAt(enemy.x, enemy.z);
      continue;
    }

    enemy.facing = Math.atan2(nx, nz);

    if (enemy.archetype === 'thief' || enemy.archetype === 'batras') {
      evaluateThiefBehaviorTree({
        enemy,
        target,
        dist,
        alliesAlive: thievesAlive,
        batrasAlive,
        whistleTriggered,
        dt,
        moveTo: (tx, tz, speed, rad = 0.75) => {
          const mx = tx - enemy.x;
          const mz = tz - enemy.z;
          const md = Math.hypot(mx, mz) || 1;
          const pos = resolveWorldPosition(
            enemy.x + (mx / md) * speed * dt,
            enemy.z + (mz / md) * speed * dt,
            rad,
          );
          enemy.x = pos.x;
          enemy.z = pos.z;
        },
        startMeleeWindup: (radius, windupSec) => {
          if (activeAttackTokens >= MAX_CONCURRENT_ATTACK_TOKENS) return;
          enemy.phase = 'windup';
          enemy.phaseTimer = windupSec;
          enemy.telegraphX = enemy.archetype === 'batras' ? enemy.x : target.x;
          enemy.telegraphZ = enemy.archetype === 'batras' ? enemy.z : target.z;
          enemy.telegraphRadius = radius;
          enemy.telegraphKind = enemy.archetype === 'batras' ? 'ring' : 'cone';
          activeAttackTokens += 1;
        },
        startRangedBolt: (windupSec) => {
          if (activeAttackTokens >= MAX_CONCURRENT_ATTACK_TOKENS) return;
          enemy.phase = 'windup';
          enemy.phaseTimer = windupSec;
          enemy.telegraphX = target.x;
          enemy.telegraphZ = target.z;
          enemy.telegraphRadius = 1.2;
          enemy.telegraphKind = 'bolt';
          activeAttackTokens += 1;
        },
      });
    } else if (enemy.archetype === 'stalker') {
      const flankAngle = Math.atan2(nx, nz) + enemy.orbitSign * 0.22;
      const moveSpeed = 5.4;
      if (dist > 2.0) {
        const pos = resolveWorldPosition(
          enemy.x + Math.sin(flankAngle) * moveSpeed * dt,
          enemy.z + Math.cos(flankAngle) * moveSpeed * dt,
          0.7,
        );
        enemy.x = pos.x;
        enemy.z = pos.z;
        enemy.phase = 'approach';
      } else if (enemy.attackCooldown <= 0 && activeAttackTokens < MAX_CONCURRENT_ATTACK_TOKENS) {
        enemy.phase = 'windup';
        enemy.phaseTimer = 0.42;
        enemy.telegraphX = target.x;
        enemy.telegraphZ = target.z;
        enemy.telegraphRadius = 2.0;
        enemy.telegraphKind = 'cone';
        activeAttackTokens += 1;
      }
    } else if (enemy.archetype === 'acolyte') {
      const moveSpeed = 4.1;
      if (dist < 7.5) {
        const pos = resolveWorldPosition(enemy.x - nx * moveSpeed * dt, enemy.z - nz * moveSpeed * dt, 0.75);
        enemy.x = pos.x;
        enemy.z = pos.z;
        enemy.phase = 'kite';
      } else if (dist > 12.5) {
        const pos = resolveWorldPosition(enemy.x + nx * moveSpeed * dt, enemy.z + nz * moveSpeed * dt, 0.75);
        enemy.x = pos.x;
        enemy.z = pos.z;
        enemy.phase = 'approach';
      } else if (enemy.attackCooldown <= 0 && activeAttackTokens < MAX_CONCURRENT_ATTACK_TOKENS) {
        enemy.phase = 'windup';
        enemy.phaseTimer = 0.55;
        enemy.telegraphX = target.x;
        enemy.telegraphZ = target.z;
        enemy.telegraphRadius = 1.4;
        enemy.telegraphKind = 'bolt';
        activeAttackTokens += 1;
      }
    } else if (enemy.archetype === 'colossus') {
      const moveSpeed = 3.2;
      if (dist > 7.5) {
        const pos = resolveWorldPosition(enemy.x + nx * moveSpeed * dt, enemy.z + nz * moveSpeed * dt, 1.05);
        enemy.x = pos.x;
        enemy.z = pos.z;
        enemy.phase = 'approach';
      } else if (enemy.attackCooldown <= 0 && activeAttackTokens < MAX_CONCURRENT_ATTACK_TOKENS) {
        enemy.phase = 'windup';
        enemy.phaseTimer = 0.65;
        enemy.telegraphX = enemy.x + nx * Math.min(9.5, dist + 2.5);
        enemy.telegraphZ = enemy.z + nz * Math.min(9.5, dist + 2.5);
        enemy.telegraphRadius = 1.8;
        enemy.telegraphKind = 'line';
        activeAttackTokens += 1;
      }
    } else if (enemy.archetype === 'warden') {
      const tangentX = -nz * enemy.orbitSign;
      const tangentZ = nx * enemy.orbitSign;
      const moveSpeed = 3.8;
      const radialPull = dist > 5.2 ? 0.65 : dist < 3.4 ? -0.45 : 0;
      const pos = resolveWorldPosition(
        enemy.x + (tangentX + nx * radialPull) * moveSpeed * dt,
        enemy.z + (tangentZ + nz * radialPull) * moveSpeed * dt,
        1.25,
      );
      enemy.x = pos.x;
      enemy.z = pos.z;
      enemy.phase = 'approach';

      if (dist <= 6.2 && enemy.attackCooldown <= 0 && activeAttackTokens < MAX_CONCURRENT_ATTACK_TOKENS) {
        enemy.phase = 'windup';
        enemy.phaseTimer = 0.72;
        enemy.telegraphX = enemy.x;
        enemy.telegraphZ = enemy.z;
        enemy.telegraphRadius = 5.4;
        enemy.telegraphKind = 'ring';
        activeAttackTokens += 1;
      }
    }

    enemy.y = groundHeightAt(enemy.x, enemy.z);
  }
}

export function stepProjectiles(world: SimWorld, dt: number) {
  const remaining: ProjectileState[] = [];
  for (const proj of world.projectiles) {
    proj.ttl -= dt;
    if (proj.ttl <= 0) continue;
    proj.x += proj.vx * dt;
    proj.z += proj.vz * dt;

    let hit = false;
    if (proj.fromEnemy) {
      for (const p of world.players.values()) {
        if (!p.alive) continue;
        if (Math.hypot(p.x - proj.x, p.z - proj.z) <= proj.radius + 0.65) {
          hurtPlayer(world, p, proj.damage);
          hit = true;
          break;
        }
      }
    } else {
      const attacker = world.players.get(proj.ownerId);
      for (const enemy of world.enemies) {
        if (enemy.phase === 'ko') continue;
        if (Math.hypot(enemy.x - proj.x, enemy.z - proj.z) <= proj.radius + (enemy.isBoss ? 1.2 : 0.75)) {
          if (attacker) {
            damageEnemy(world, enemy, attacker, proj.damage);
          }
          if (proj.slowSeconds > 0 && enemy.hp > 0) {
            enemy.stunTimer = Math.max(enemy.stunTimer, proj.slowSeconds * 0.45);
          }
          pushEvent(world, {
            kind: 'bolt_hit',
            x: proj.x,
            y: groundHeightAt(proj.x, proj.z) + 1.0,
            z: proj.z,
            color: proj.color,
          });
          hit = true;
          break;
        }
      }
    }

    if (!hit) remaining.push(proj);
  }
  world.projectiles = remaining;
}

export function stepShrinesAndLoot(world: SimWorld, dt: number) {
  for (const shrine of world.shrines) {
    const insidePlayers: PlayerState[] = [];
    for (const p of world.players.values()) {
      if (!p.alive) continue;
      if (Math.hypot(p.x - shrine.x, p.z - shrine.z) <= shrine.radius) {
        insidePlayers.push(p);
      }
    }
    if (insidePlayers.length > 0 && shrine.captureProgress < 100) {
      const prevFaction = shrine.controllingFaction;
      shrine.captureProgress = Math.min(100, shrine.captureProgress + insidePlayers.length * 22 * dt);
      if (shrine.captureProgress >= 60) {
        shrine.controllingFaction = 'solis';
      } else if (shrine.captureProgress > -20) {
        shrine.controllingFaction = 'neutral';
      }
      if (prevFaction !== 'solis' && shrine.controllingFaction === 'solis') {
        pushEvent(world, {
          kind: 'shrine_capture',
          x: shrine.x,
          y: groundHeightAt(shrine.x, shrine.z) + 3.2,
          z: shrine.z,
          radius: shrine.radius,
          color: '#34d399',
          label: `${shrine.name} Claimed!`,
        });
        for (const p of insidePlayers) {
          applyQuestEventToPlayer(world, p, { kind: 'capture_shrine' });
          awardPassXpWithNotify(world, p, 25);
          world.onPersistPlayer?.(p);
        }
        world.onWorldAnnouncement?.(`${shrine.name} reclaimed for Solis! (${shrine.buffLabel})`);
        world.onPersistShrine?.(shrine);
      }
    }
  }

  const remainingLoot: LootDrop[] = [];
  for (const drop of world.loot) {
    drop.ttl -= dt;
    if (drop.ttl <= 0) continue;

    let pickedBy: PlayerState | null = null;
    for (const p of world.players.values()) {
      if (!p.alive) continue;
      if (Math.hypot(p.x - drop.x, p.z - drop.z) <= 2.2) {
        pickedBy = p;
        break;
      }
    }

    if (pickedBy) {
      if (drop.kind === 'gold') {
        pickedBy.gold += drop.amount;
      } else if (drop.kind === 'potion') {
        pickedBy.potions += drop.amount;
      } else if (drop.kind === 'relic') {
        const existing = pickedBy.inventory.find((i) => i.itemKey === drop.itemKey);
        if (existing) {
          existing.quantity += 1;
          existing.power = Math.max(existing.power, drop.power);
        } else {
          pickedBy.inventory.push({
            id: `item-${world.nextSeq++}`,
            itemKey: drop.itemKey,
            name: drop.name,
            rarity: drop.rarity,
            slotType: 'charm',
            quantity: 1,
            power: drop.power,
          });
        }
        pickedBy.charmPower = Math.max(pickedBy.charmPower, drop.power);
      }
      pushEvent(world, {
        kind: 'loot',
        x: drop.x,
        y: groundHeightAt(drop.x, drop.z) + 1.2,
        z: drop.z,
        color: drop.kind === 'potion' ? '#34d399' : '#fbbf24',
        label: `+${drop.amount} ${drop.name}`,
        targetId: pickedBy.id,
      });
      applyQuestEventToPlayer(world, pickedBy, { kind: 'collect_loot' });
      world.onPersistPlayer?.(pickedBy);
    } else {
      remainingLoot.push(drop);
    }
  }
  world.loot = remainingLoot;
}

export function startDynamicWorldEvent(
  world: SimWorld,
  nowMs = Date.now(),
  overrideKind?: DynamicWorldEventKind,
): DynamicWorldEventState {
  // Remove any stale event enemies first
  world.enemies = world.enemies.filter((e) => !e.eventId);

  const { event, blueprint } = createDynamicWorldEvent(
    world.eventRotationIndex++,
    nowMs,
    overrideKind,
  );
  world.dynamicEvent = event;
  world.tempestHazardTimer = 3.0;

  blueprint.enemySpawns.forEach((sp, idx) => {
    const enemy = createEnemyFromTemplate(
      {
        id: `${event.id}-mob-${idx}`,
        archetype: sp.archetype,
        name: sp.name,
        level: sp.level,
        x: event.x + sp.ox,
        z: event.z + sp.oz,
        isBoss: sp.isBoss,
      },
      event.id,
    );
    world.enemies.push(enemy);
  });

  pushEvent(world, {
    kind: 'world_event',
    x: event.x,
    y: groundHeightAt(event.x, event.z) + 3.0,
    z: event.z,
    radius: event.radius,
    color: event.kind === 'tempest' ? '#38bdf8' : '#c084fc',
    label: event.title,
  });

  world.onWorldAnnouncement?.(`WORLD EVENT: ${event.title} in ${event.zoneName}!`);
  world.onPersistWorldEvent?.(event);
  return event;
}

function finalizeDynamicWorldEvent(world: SimWorld, outcome: 'completed' | 'expired') {
  const evt = world.dynamicEvent;
  if (!evt) return;
  evt.status = outcome;

  if (outcome === 'completed') {
    pushEvent(world, {
      kind: 'world_event',
      x: evt.x,
      y: groundHeightAt(evt.x, evt.z) + 3.2,
      z: evt.z,
      radius: evt.radius,
      color: '#fde047',
      label: `${evt.title} Victory!`,
    });

    const bonusXp = evt.kind === 'dungeon_rift' ? 210 : evt.kind === 'tempest' ? 165 : 150;
    const bonusGold = evt.kind === 'dungeon_rift' ? 120 : evt.kind === 'tempest' ? 95 : 85;

    for (const p of world.players.values()) {
      const participated =
        Boolean(evt.participantScores[p.id]) ||
        Math.hypot(p.x - evt.x, p.z - evt.z) <= evt.radius + 8;
      if (!participated) continue;
      p.gold += bonusGold;
      grantPlayerXp(world, p, bonusXp);
      awardPassXpWithNotify(world, p, 60);
      applyQuestEventToPlayer(world, p, { kind: 'world_event' });
      world.onPersistPlayer?.(p);
    }

    // Spawn guaranteed event reward relic cache at event center
    world.loot.push({
      id: `loot-evt-${world.nextSeq++}`,
      x: evt.x,
      z: evt.z,
      kind: 'relic',
      itemKey: evt.kind === 'dungeon_rift' ? 'vault_chrono_seal' : 'storm_aegis_prism',
      name: evt.kind === 'dungeon_rift' ? 'Sunken Vault Seal' : 'Stormforged Prism',
      rarity: 'epic',
      power: 19,
      amount: 1,
      ttl: 60,
    });
    world.onWorldAnnouncement?.(`${evt.title} overcome! Heroes rewarded (${evt.rewardLabel}).`);
  } else {
    world.onWorldAnnouncement?.(`${evt.title} subsided across Solis Reach.`);
  }

  world.onPersistWorldEvent?.(evt);
  // Clean up event enemies & reset countdown
  world.enemies = world.enemies.filter((e) => e.eventId !== evt.id);
  world.dynamicEvent = null;
  world.nextEventCountdownSec = 42;
}

export function stepDynamicWorldEvent(world: SimWorld, dt: number, nowMs = Date.now()) {
  const evt = world.dynamicEvent;
  if (!evt) {
    if (world.players.size > 0) {
      world.nextEventCountdownSec -= dt;
      if (world.nextEventCountdownSec <= 0) {
        startDynamicWorldEvent(world, nowMs);
      }
    }
    return;
  }

  if (evt.status !== 'active') return;

  // Barrow Ambush 3-Phase Progression:
  // Phase 1 (Setup & Crows) -> Phase 2 (Whistle Trigger when player approaches) -> Phase 3 (Batras Flank Finale)
  if (evt.kind === 'barrow_ambush') {
    if (!evt.whistleTriggered) {
      for (const p of world.players.values()) {
        if (!p.alive) continue;
        if (Math.hypot(p.x - evt.x, p.z - evt.z) <= evt.radius + 1.5) {
          evt.whistleTriggered = true;
          evt.ambushPhase = 2;
          for (const e of world.enemies) {
            if (e.eventId === evt.id) e.hiddenInCover = false;
          }
          pushEvent(world, {
            kind: 'whistle',
            x: evt.x,
            y: groundHeightAt(evt.x, evt.z) + 2.4,
            z: evt.z,
            radius: evt.radius,
            color: '#fb7185',
            label: 'Whistle in Liar’s Copse!',
          });
          world.onWorldAnnouncement?.('A sharp whistle pierces Liar’s Copse—Batras’s Thieves spring the ambush!');
          break;
        }
      }
    } else if (evt.ambushPhase === 2 && evt.progress >= 2) {
      evt.ambushPhase = 3;
      pushEvent(world, {
        kind: 'crow_alert',
        x: evt.x,
        y: groundHeightAt(evt.x, evt.z) + 2.6,
        z: evt.z,
        radius: 8,
        color: '#f59e0b',
        label: 'Rykker & Proudis Flank Batras!',
      });
      world.onWorldAnnouncement?.('Phase 3: Rykker & Proudis spur forward on the flank—finish Batras at the Mound!');
    }
  }

  // Sunken Vault progress ticks up while players stand inside the Seal ring
  if (evt.kind === 'dungeon_rift') {
    let insideCount = 0;
    for (const p of world.players.values()) {
      if (!p.alive) continue;
      if (Math.hypot(p.x - evt.x, p.z - evt.z) <= evt.radius) {
        insideCount += 1;
        const prev = evt.participantScores[p.id]?.score ?? 0;
        evt.participantScores[p.id] = { name: p.name, score: prev + dt * 10 };
      }
    }
    if (insideCount > 0) {
      evt.progress = Math.min(evt.goal, evt.progress + insideCount * 11 * dt);
    }
  }

  // Aether Tempest natural disaster lightning strikes inside the storm ring
  if (evt.kind === 'tempest') {
    world.tempestHazardTimer -= dt;
    if (world.tempestHazardTimer <= 0) {
      world.tempestHazardTimer = 3.2;
      const angle = (world.time * 1.7 + world.nextSeq * 0.9) % (Math.PI * 2);
      const r = 3 + ((world.nextSeq * 1.9) % Math.max(4, evt.radius - 3));
      const sx = evt.x + Math.cos(angle) * r;
      const sz = evt.z + Math.sin(angle) * r;
      pushEvent(world, {
        kind: 'lightning',
        x: sx,
        y: groundHeightAt(sx, sz) + 0.2,
        z: sz,
        radius: 2.6,
        color: '#38bdf8',
        label: 'Tempest Strike!',
      });
      for (const p of world.players.values()) {
        if (!p.alive) continue;
        if (Math.hypot(p.x - sx, p.z - sz) <= 2.4) {
          hurtPlayer(world, p, 14);
        }
      }
    }
  }

  if (evt.progress >= evt.goal) {
    finalizeDynamicWorldEvent(world, 'completed');
    return;
  }

  if (nowMs >= evt.expiresAt) {
    finalizeDynamicWorldEvent(world, 'expired');
  }
}

export function stepSimWorld(world: SimWorld, rawDt: number, nowMs = Date.now()) {
  const dt = Math.min(rawDt, 0.05);
  world.time += dt;
  world.nowMs = nowMs;
  world.events = [];

  for (const player of world.players.values()) {
    stepPlayer(world, player, dt);
  }
  stepCompanions(world.companions, world.players.values(), world.enemies, dt, world.time, {
    resolvePos: (x, z, r) => resolveWorldPosition(x, z, r),
    damageEnemy: (enemy, owner, dmg, kx, kz) => damageEnemy(world, enemy, owner, dmg, kx, kz),
    spawnBolt: (fromX, fromZ, toX, toZ, owner, dmg, color) => {
      const dx = toX - fromX;
      const dz = toZ - fromZ;
      const len = Math.hypot(dx, dz) || 1;
      world.projectiles.push({
        id: `cproj-${world.nextSeq++}`,
        ownerId: owner.id,
        fromEnemy: false,
        x: fromX,
        z: fromZ,
        vx: (dx / len) * 22,
        vz: (dz / len) * 22,
        radius: 0.75,
        damage: dmg,
        ttl: 0.9,
        color,
        slowSeconds: 0,
      });
    },
    healPlayer: (player, amount) => {
      player.hp = Math.min(player.maxHp, player.hp + amount);
      pushEvent(world, {
        kind: 'heal',
        x: player.x,
        y: groundHeightAt(player.x, player.z) + 1.8,
        z: player.z,
        color: '#34d399',
        value: amount,
        targetId: player.id,
      });
    },
  });
  stepEnemies(world, dt);
  stepProjectiles(world, dt);
  stepShrinesAndLoot(world, dt);
  stepDynamicWorldEvent(world, dt, nowMs);
  world.tacticalAdvice = evaluateSynthesizerAdvice(world.players.values(), world.enemies, world.dynamicEvent);
}
