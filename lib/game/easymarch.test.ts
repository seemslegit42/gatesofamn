import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialCompanions,
  evaluateSynthesizerAdvice,
  evaluateThiefBehaviorTree,
  selectWorgenSwarmMode,
  stepCompanions,
} from './ai.ts';
import {
  createDefaultPlayer,
  createSimWorld,
  executeCampPrep,
  executeMountedManeuver,
  executePathAbility,
  executePlayerSkill,
  resolvePhilosophicalChoice,
  setPlayerCombatStance,
  startDynamicWorldEvent,
  stepSimWorld,
  togglePlayerMount,
} from './simulation.ts';
import {
  initDatabase,
  loadOrCreatePlayer,
  recordLegacyLedger,
  savePlayerState,
} from '../db/turso.ts';
import type { EnemyState } from './types.ts';

function makeThief(id: string, x: number, z: number, hp = 100): EnemyState {
  return {
    id,
    archetype: 'thief',
    name: 'Shadow Thief',
    level: 2,
    isBoss: false,
    x,
    y: 0,
    z,
    vx: 0,
    vz: 0,
    impulseX: 0,
    impulseZ: 0,
    stunTimer: 0,
    homeX: x,
    homeZ: z,
    facing: 0,
    hp,
    maxHp: 100,
    phase: 'patrol',
    phaseTimer: 0,
    koTimer: 0,
    respawnTimer: 0,
    attackCooldown: 0,
    telegraphX: x,
    telegraphZ: z,
    telegraphRadius: 2,
    telegraphKind: 'cone',
    targetPlayerId: null,
    hurtFlash: 0,
    orbitSign: 1,
    hiddenInCover: true,
    aiRole: 'skulk',
  };
}

test('Thief Behavior Tree transitions from Skulk to Assault after Whistle and Retreat when disadvantaged', () => {
  const hero = createDefaultPlayer('bt-hero', 'Aeloria', 'vanguard');
  hero.x = -10;
  hero.z = 21;

  const thief = makeThief('bt-thief-1', -20, 21, 100);
  let boltStarted = false;
  let meleeStarted = false;
  let moved = false;

  // 1. Before whistle at distance > 5.5 -> remains hidden skulk
  evaluateThiefBehaviorTree({
    enemy: thief,
    target: hero,
    dist: 10,
    alliesAlive: 4,
    batrasAlive: true,
    whistleTriggered: false,
    dt: 0.1,
    moveTo: () => {
      moved = true;
    },
    startMeleeWindup: () => {
      meleeStarted = true;
    },
    startRangedBolt: () => {
      boltStarted = true;
    },
  });
  assert.equal(thief.hiddenInCover, true);
  assert.equal(moved, false);

  // 2. After whistle triggered -> drops cover & launches coordinated assault
  evaluateThiefBehaviorTree({
    enemy: thief,
    target: hero,
    dist: 2.0,
    alliesAlive: 4,
    batrasAlive: true,
    whistleTriggered: true,
    dt: 0.1,
    moveTo: () => {
      moved = true;
    },
    startMeleeWindup: () => {
      meleeStarted = true;
    },
    startRangedBolt: () => {
      boltStarted = true;
    },
  });
  assert.equal(thief.hiddenInCover, false);
  assert.equal(thief.aiRole, 'assault');
  assert.equal(meleeStarted, true);

  // 3. When Batras falls and few allies remain -> Tactical Retreat & Ranged Bolt
  evaluateThiefBehaviorTree({
    enemy: thief,
    target: hero,
    dist: 10,
    alliesAlive: 1,
    batrasAlive: false,
    whistleTriggered: true,
    dt: 0.1,
    moveTo: () => {},
    startMeleeWindup: () => {},
    startRangedBolt: () => {
      boltStarted = true;
    },
  });
  assert.equal(thief.aiRole, 'retreat');
  assert.equal(boltStarted, true);
});

test('Warband Companions (Graymstrum triage, Worgen swarm, Outriders, Cavalry) & Synthesizer operate cohesively', () => {
  const hero = createDefaultPlayer('war-hero', 'Athelstane', 'vanguard');
  hero.x = -24;
  hero.z = 21;
  hero.hp = Math.round(hero.maxHp * 0.4); // Wounded to trigger Graymstrum triage

  const companions = createInitialCompanions();
  assert.equal(companions.length, 7);

  // Place companions near hero & spawn visible threat
  for (const c of companions) {
    c.x = hero.x + 1;
    c.z = hero.z + 1;
    c.cooldown = 0;
  }
  const threat = makeThief('war-threat', hero.x + 2, hero.z + 2, 120);
  threat.hiddenInCover = false;

  let healed = 0;
  let bolts = 0;
  let meleeHits = 0;

  stepCompanions(companions, [hero], [threat], 0.15, 5.0, {
    resolvePos: (x, z) => ({ x, z }),
    damageEnemy: () => {
      meleeHits++;
    },
    spawnBolt: () => {
      bolts++;
    },
    healPlayer: (_p, amt) => {
      healed += amt;
    },
  });

  assert.ok(healed > 0, 'Graymstrum should trigger Field Triage on wounded hero');
  assert.ok(bolts >= 2, 'Krydon & Hellas should fire Outrider bolts');
  assert.ok(meleeHits >= 1, 'Haft / Worgen / Cavalry should strike visible nearby threats');

  // Verify Worgen swarm decision produces valid tactical modes
  const modes = new Set<string>();
  for (let s = 1; s <= 16; s++) {
    modes.add(selectWorgenSwarmMode(4, 0.7, s));
  }
  assert.ok(modes.size >= 2, 'Probabilistic Swarm should distribute across multiple tactical modes');

  // Synthesizer reacts to hidden ambushers at Barrow Mound
  const hiddenMob = makeThief('synth-hidden', hero.x + 4, hero.z + 2, 100);
  const advice = evaluateSynthesizerAdvice([hero], [hiddenMob], null);
  assert.equal(advice.crowAlert, true);
  assert.equal(advice.threatLevel, 'ambush');
});

test('Combat stances, mounted maneuvers, weapon oils, whetstone, and philosophical dilemmas apply mechanically', () => {
  const world = createSimWorld();
  const hero = createDefaultPlayer('mech-hero', 'Solis', 'vanguard');
  hero.x = 0;
  hero.z = 26;
  hero.gold = 200;
  world.players.set(hero.id, hero);

  const dummyA = makeThief('dummy-a', 0, 24.5, 500);
  dummyA.hiddenInCover = false;
  world.enemies.push(dummyA);

  // Heavy stance deals more damage & impulse than Swift stance
  setPlayerCombatStance(world, hero, 'heavy');
  const hpBeforeHeavy = dummyA.hp;
  executePlayerSkill(world, hero, 0, dummyA.x, dummyA.z);
  const heavyDmg = hpBeforeHeavy - dummyA.hp;
  const heavyImpulse = Math.hypot(dummyA.impulseX, dummyA.impulseZ);

  hero.cooldowns[0] = 0;
  setPlayerCombatStance(world, hero, 'swift');
  const hpBeforeSwift = dummyA.hp;
  executePlayerSkill(world, hero, 0, dummyA.x, dummyA.z);
  const swiftDmg = hpBeforeSwift - dummyA.hp;
  assert.ok(heavyDmg > swiftDmg, 'Heavy stance should out-damage Swift stance per strike');
  assert.ok(heavyImpulse > 0.5, 'Heavy stance should apply physics-feel momentum impulse');

  // Mount & Mounted Spin maneuver
  assert.equal(togglePlayerMount(world, hero), true);
  assert.equal(hero.philosophy.mounted, true);
  const spinRes = executeMountedManeuver(world, hero, 'spin');
  assert.equal(spinRes.ok, true);

  // Preparation Camp: Whetstone + Oil + Bolts
  const whet = executeCampPrep(world, hero, { kind: 'whetstone' });
  assert.equal(whet.ok, true);
  assert.ok(hero.philosophy.whetstoneExpiresAt > world.nowMs);

  const oil = executeCampPrep(world, hero, { kind: 'apply_oil', oil: 'barrowbane' });
  assert.equal(oil.ok, true);
  assert.equal(hero.philosophy.weaponOil, 'barrowbane');
  assert.ok(hero.philosophy.oilCharges > 0);

  const bolts = executeCampPrep(world, hero, { kind: 'craft_bolts', bolt: 'fire' });
  assert.equal(bolts.ok, true);
  assert.equal(hero.philosophy.arblastBolt, 'fire');
  assert.ok(hero.philosophy.boltAmmo >= 5);

  // Philosophical dilemma & Path Ability
  const choice = resolvePhilosophicalChoice(world, hero, 'barrow_parley', 'bellow_challenge');
  assert.equal(choice.ok, true);
  assert.equal(hero.philosophy.athelstaneAffinity, 25);

  const roar = executePathAbility(world, hero, 'battle_roar');
  assert.equal(roar.ok, true);
});

test('Barrow Ambush world event & Turso/libSQL philosophy persistence round-trip', async () => {
  await initDatabase();

  const world = createSimWorld();
  const id = `barrow-db-${Date.now()}`;
  const hero = createDefaultPlayer(id, 'BarrowTest', 'ranger');
  hero.x = -23;
  hero.z = 21;
  world.players.set(hero.id, hero);

  // Trigger Barrow Ambush dynamic world event
  const ev = startDynamicWorldEvent(world, world.nowMs, 'barrow_ambush');
  assert.equal(ev.kind, 'barrow_ambush');
  assert.equal(ev.ambushPhase, 1);

  // Step simulation so Hero triggers ambush whistle Phase 2
  stepSimWorld(world, 0.2);
  assert.equal(world.dynamicEvent?.whistleTriggered, true);
  assert.equal(world.dynamicEvent?.ambushPhase, 2);

  // Mutate philosophy and persist to libSQL / Turso
  setPlayerCombatStance(world, hero, 'heavy');
  resolvePhilosophicalChoice(world, hero, 'obelisk_tribute', 'klepsydra_pact');
  await savePlayerState(hero);
  await recordLegacyLedger(hero.id, 'dilemma', 'graymstrum', 'Attuned the Klepsydra');

  const reloaded = await loadOrCreatePlayer(id, 'BarrowTest', 'ranger', 0);
  assert.equal(reloaded.philosophy.activeStance, 'heavy');
  assert.equal(reloaded.philosophy.arblastBolt, 'poison');
  assert.ok(reloaded.philosophy.resolvedDilemmas.includes('obelisk_tribute'));
  assert.ok(reloaded.philosophy.graymstrumAffinity >= 25);
});
