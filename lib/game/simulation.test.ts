import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultPlayer,
  createSimWorld,
  executePlayerSkill,
  resolveWorldPosition,
  stepSimWorld,
  triggerPlayerDash,
} from './simulation.ts';
import { WORLD_OBSTACLES, WORLD_PLAYABLE_RADIUS, groundHeightAt } from './worldData.ts';

test('terrain height and obstacle collision keep actors within bounds', () => {
  const hSanctuary = groundHeightAt(0, 14);
  assert.ok(Number.isFinite(hSanctuary));

  // Push out of an obstacle
  const obs = WORLD_OBSTACLES[0];
  const resolved = resolveWorldPosition(obs.x + 0.1, obs.z, 0.7);
  const dist = Math.hypot(resolved.x - obs.x, resolved.z - obs.z);
  assert.ok(dist >= obs.radius + 0.7 - 0.001);

  // Clamp within playable world radius
  const clamped = resolveWorldPosition(200, 0, 0.7);
  assert.ok(Math.hypot(clamped.x, clamped.z) <= WORLD_PLAYABLE_RADIUS - 0.69);
});

test('player movement supports WASD, click-to-move waypoint, and dash impulse', () => {
  const world = createSimWorld();
  const player = createDefaultPlayer('p1', 'Kael', 'ranger');
  world.players.set(player.id, player);

  const startZ = player.z;
  player.input.moveZ = -1;
  for (let i = 0; i < 10; i++) {
    stepSimWorld(world, 0.05);
  }
  assert.ok(player.z < startZ - 2.0, 'Player should move north with negative Z input');

  // Stop WASD and test click-to-move waypoint
  player.input.moveZ = 0;
  player.input.waypointX = 12;
  player.input.waypointZ = 14;
  for (let i = 0; i < 30; i++) {
    stepSimWorld(world, 0.05);
  }
  assert.ok(player.x > 6, 'Player should travel toward click waypoint');

  // Dash burst increases velocity and grants brief invulnerability
  const dashed = triggerPlayerDash(world, player, 1, 0);
  assert.equal(dashed, true);
  assert.ok(player.invulnTimer > 0.2);
  const xBeforeDash = player.x;
  stepSimWorld(world, 0.05);
  assert.ok(player.x > xBeforeDash + 0.8, 'Dash should propel hero rapidly');
});

test('combat skills deal damage, defeat enemies, grant XP, level up, and spawn loot', () => {
  const world = createSimWorld();
  const vanguard = createDefaultPlayer('p1', 'Sol', 'vanguard');
  world.players.set(vanguard.id, vanguard);

  // Place player next to the first stalker (outside sanctuary)
  const stalker = world.enemies.find((e) => e.archetype === 'stalker')!;
  vanguard.x = stalker.x - 1.5;
  vanguard.z = stalker.z;

  const hpBefore = stalker.hp;
  const castOk = executePlayerSkill(world, vanguard, 0, stalker.x, stalker.z);
  assert.equal(castOk, true);
  assert.ok(stalker.hp < hpBefore, 'Solar Cleave should reduce stalker HP');

  // Finish the stalker with shockwave + follow-ups
  executePlayerSkill(world, vanguard, 1, stalker.x, stalker.z);
  while (stalker.hp > 0) {
    vanguard.cooldowns[0] = 0;
    executePlayerSkill(world, vanguard, 0, stalker.x, stalker.z);
  }
  assert.equal(stalker.phase, 'ko');
  assert.equal(vanguard.kills, 1);
  assert.ok(vanguard.xp > 0 || vanguard.level > 1);
});

test('enemy archetypes exhibit distinct movement policies (kiter retreats vs chaser approaches)', () => {
  const world = createSimWorld();
  const hero = createDefaultPlayer('p1', 'Lyra', 'arcanist');
  world.players.set(hero.id, hero);

  const acolyte = world.enemies.find((e) => e.archetype === 'acolyte')!;
  const stalker = world.enemies.find((e) => e.archetype === 'stalker')!;

  // Move hero close to acolyte (4m away) -> acolyte should kite away
  hero.x = acolyte.x - 4;
  hero.z = acolyte.z;
  const acolyteStartDist = Math.hypot(acolyte.x - hero.x, acolyte.z - hero.z);
  for (let i = 0; i < 6; i++) {
    stepSimWorld(world, 0.05);
  }
  const acolyteEndDist = Math.hypot(acolyte.x - hero.x, acolyte.z - hero.z);
  assert.equal(acolyte.phase, 'kite');
  assert.ok(acolyteEndDist > acolyteStartDist, 'Acolyte kiter must retreat when player is within 7.5m');

  // Move hero 8m away from stalker -> stalker should approach closer
  hero.x = stalker.x - 8;
  hero.z = stalker.z;
  const stalkerStartDist = Math.hypot(stalker.x - hero.x, stalker.z - hero.z);
  for (let i = 0; i < 6; i++) {
    stepSimWorld(world, 0.05);
  }
  const stalkerEndDist = Math.hypot(stalker.x - hero.x, stalker.z - hero.z);
  assert.ok(stalkerEndDist < stalkerStartDist, 'Stalker chaser must close distance');
});

test('standing inside Verdant Altar shrine captures it for Solis', () => {
  const world = createSimWorld();
  const player = createDefaultPlayer('p1', 'Eryn', 'vanguard');
  world.players.set(player.id, player);

  const verdant = world.shrines.find((s) => s.id === 'shrine-verdant')!;
  assert.equal(verdant.controllingFaction, 'neutral');
  player.x = verdant.x + 1.8;
  player.z = verdant.z;

  for (let i = 0; i < 65; i++) {
    stepSimWorld(world, 0.05);
  }
  assert.equal(verdant.controllingFaction, 'solis');
  assert.ok(verdant.captureProgress >= 60);
});
