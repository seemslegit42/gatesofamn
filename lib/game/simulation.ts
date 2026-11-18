import type {
  EnemyArchetype,
  EnemyState,
  HeroClass,
  InventoryItem,
  LootDrop,
  PlayerState,
  ProjectileState,
  Rarity,
  ShrineState,
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
  groundHeightAt,
} from './worldData.ts';

export interface SimWorld {
  time: number;
  players: Map<string, PlayerState>;
  enemies: EnemyState[];
  shrines: ShrineState[];
  loot: LootDrop[];
  projectiles: ProjectileState[];
  events: WorldEffectEvent[];
  nextSeq: number;
  onPersistPlayer?: (player: PlayerState) => void;
  onPersistShrine?: (shrine: ShrineState) => void;
  onWorldAnnouncement?: (text: string) => void;
}

const MAX_CONCURRENT_ATTACK_TOKENS = 4;

export function createEnemyFromTemplate(t: (typeof ENEMY_SPAWNS)[number]): EnemyState {
  const statsByArchetype: Record<EnemyArchetype, { hp: number }> = {
    stalker: { hp: 95 + t.level * 22 },
    acolyte: { hp: 85 + t.level * 18 },
    colossus: { hp: 210 + t.level * 40 },
    warden: { hp: 620 + t.level * 70 },
  };
  const maxHp = statsByArchetype[t.archetype].hp;
  return {
    id: t.id,
    archetype: t.archetype,
    name: t.name,
    level: t.level,
    isBoss: t.isBoss,
    x: t.x,
    y: groundHeightAt(t.x, t.z),
    z: t.z,
    vx: 0,
    vz: 0,
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
    telegraphRadius: 2.4,
    telegraphKind: t.archetype === 'colossus' ? 'line' : t.archetype === 'warden' ? 'ring' : 'cone',
    targetPlayerId: null,
    hurtFlash: 0,
    orbitSign: t.id.endsWith('2') || t.id.endsWith('4') ? -1 : 1,
  };
}

export function createSimWorld(initialShrines?: ShrineState[]): SimWorld {
  return {
    time: 0,
    players: new Map(),
    enemies: ENEMY_SPAWNS.map(createEnemyFromTemplate),
    shrines: (initialShrines && initialShrines.length > 0 ? initialShrines : INITIAL_SHRINES).map((s) => ({
      ...s,
    })),
    loot: [],
    projectiles: [],
    events: [],
    nextSeq: 1,
  };
}

export function createDefaultPlayer(
  id: string,
  name: string,
  heroClass: HeroClass,
  spawnIndex = 0,
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
  return {
    id,
    name: name.trim().slice(0, 20) || 'Wanderer',
    heroClass,
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
    lastHitTime: -10,
  };
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

export function getSolisShrineBuffCount(world: SimWorld): number {
  return world.shrines.filter((s) => s.controllingFaction === 'solis').length;
}

export function awardXpAndLoot(
  world: SimWorld,
  player: PlayerState,
  enemy: EnemyState,
) {
  const xpGain = enemy.isBoss ? 140 : 32 + enemy.level * 12;
  const goldGain = enemy.isBoss ? 85 : 10 + enemy.level * 6;
  player.xp += xpGain;
  player.gold += goldGain;
  player.kills += 1;

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

  // Spawn collectible world loot drop
  const roll = ((world.nextSeq * 37 + Math.round(enemy.x * 13)) % 100 + 100) % 100;
  if (enemy.isBoss || roll < 68) {
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
  const buffMult = 1 + getSolisShrineBuffCount(world) * 0.08;
  const dmg = Math.max(1, Math.round(rawDamage * buffMult));
  enemy.hp = Math.max(0, enemy.hp - dmg);
  enemy.hurtFlash = 0.14;
  enemy.targetPlayerId = attacker.id;

  const pushed = resolveWorldPosition(enemy.x + knockbackX, enemy.z + knockbackZ, enemy.isBoss ? 1.3 : 0.8);
  enemy.x = pushed.x;
  enemy.z = pushed.z;
  enemy.y = groundHeightAt(enemy.x, enemy.z);

  pushEvent(world, {
    kind: 'damage',
    x: enemy.x,
    y: enemy.y + (enemy.isBoss ? 2.6 : 1.7),
    z: enemy.z,
    color: '#fbbf24',
    value: dmg,
    targetId: enemy.id,
  });

  if (enemy.hp <= 0) {
    enemy.phase = 'ko';
    enemy.koTimer = 0.42;
    enemy.respawnTimer = enemy.isBoss ? 22 : 12;
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

  player.mana -= skill.manaCost;
  player.cooldowns[skillIndex] = skill.cooldown;
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

  const powerBonus = 1 + (player.level - 1) * 0.14 + (player.weaponPower + player.charmPower) * 0.025;
  const damage = Math.round(skill.baseDamage * powerBonus);

  if (skill.kind === 'cleave' || skill.kind === 'shockwave') {
    const isFullCircle = skill.kind === 'shockwave';
    pushEvent(world, {
      kind: isFullCircle ? 'nova' : 'slash',
      x: player.x,
      y: groundHeightAt(player.x, player.z) + 0.35,
      z: player.z,
      angle: player.facing,
      radius: skill.radius,
      color: skill.color,
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
        const kb = edist > 0.01 ? 0.65 : 0;
        damageEnemy(world, enemy, player, damage, (ex / (edist || 1)) * kb, (ez / (edist || 1)) * kb);
        if (isFullCircle && enemy.hp > 0) {
          enemy.phase = 'recover';
          enemy.phaseTimer = 0.7;
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

    pushEvent(world, {
      kind: 'volley',
      x: player.x + dx * 0.9,
      y: groundHeightAt(player.x, player.z) + 1.1,
      z: player.z + dz * 0.9,
      angle: baseAngle,
      color: skill.color,
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
        damage,
        ttl: skill.range / speed,
        color: skill.color,
        slowSeconds: 0,
      });
    }
  }

  return true;
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
  player.cooldowns[0] = Math.max(0, player.cooldowns[0] - dt);
  player.cooldowns[1] = Math.max(0, player.cooldowns[1] - dt);
  player.cooldowns[2] = Math.max(0, player.cooldowns[2] - dt);
  player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  player.castFlashTimer = Math.max(0, player.castFlashTimer - dt);
  player.hurtTimer = Math.max(0, player.hurtTimer - dt);
  player.invulnTimer = Math.max(0, player.invulnTimer - dt);

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

  const spec = CLASS_SPECS[player.heroClass];
  const speed = spec.moveSpeed * (1 + shrineBuffs * 0.05);

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
}

function hurtPlayer(world: SimWorld, player: PlayerState, damage: number) {
  if (!player.alive || player.invulnTimer > 0) return;
  // Sanctuary is a safe harbor
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

  for (const enemy of world.enemies) {
    enemy.hurtFlash = Math.max(0, enemy.hurtFlash - dt);
    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);

    if (enemy.phase === 'ko') {
      enemy.koTimer -= dt;
      if (enemy.koTimer <= 0) {
        enemy.respawnTimer -= dt;
        if (enemy.respawnTimer <= 0) {
          enemy.hp = enemy.maxHp;
          enemy.x = enemy.homeX;
          enemy.z = enemy.homeZ;
          enemy.y = groundHeightAt(enemy.x, enemy.z);
          enemy.phase = 'patrol';
          enemy.targetPlayerId = null;
        }
      }
      continue;
    }

    // Acquire nearest living player outside Sanctuary
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

    // Windup telegraph phase (0.45s - 0.75s visible ground warning before active hit)
    if (enemy.phase === 'windup') {
      enemy.phaseTimer -= dt;
      if (enemy.phaseTimer <= 0) {
        enemy.phase = 'active';
        if (enemy.archetype === 'colossus') {
          enemy.phaseTimer = 0.28; // Dash rush duration
        } else {
          enemy.phaseTimer = 0.12;
          // Instant resolve for stalker lunge, acolyte bolt, or warden ring
          if (enemy.archetype === 'acolyte') {
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
              damage: 18 + enemy.level * 4,
              ttl: 1.5,
              color: '#c084fc',
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
        enemy.attackCooldown = enemy.archetype === 'stalker' ? 1.35 : enemy.archetype === 'colossus' ? 2.4 : 1.9;
      }
      enemy.y = groundHeightAt(enemy.x, enemy.z);
      continue;
    }

    // Distinct Archetype Movement Policies
    enemy.facing = Math.atan2(nx, nz);

    if (enemy.archetype === 'stalker') {
      // Policy 1: Chaser / Pack Flanker
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
      // Policy 2: Kiter / Ranged Standoff (maintains 9-12.5m range, retreats if closer than 7.5m)
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
      // Policy 3: Line-of-Sight Charger
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
      // Policy 4: Boss Orbiter + Area-Denial Solar Shockwave
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
    let playersInside = 0;
    for (const p of world.players.values()) {
      if (!p.alive) continue;
      if (Math.hypot(p.x - shrine.x, p.z - shrine.z) <= shrine.radius) {
        playersInside += 1;
      }
    }
    if (playersInside > 0 && shrine.captureProgress < 100) {
      const prevFaction = shrine.controllingFaction;
      shrine.captureProgress = Math.min(100, shrine.captureProgress + playersInside * 22 * dt);
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
      world.onPersistPlayer?.(pickedBy);
    } else {
      remainingLoot.push(drop);
    }
  }
  world.loot = remainingLoot;
}

export function stepSimWorld(world: SimWorld, rawDt: number) {
  const dt = Math.min(rawDt, 0.05);
  world.time += dt;
  world.events = [];

  for (const player of world.players.values()) {
    stepPlayer(world, player, dt);
  }
  stepEnemies(world, dt);
  stepProjectiles(world, dt);
  stepShrinesAndLoot(world, dt);
}
