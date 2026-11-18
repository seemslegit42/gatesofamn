import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getDefaultAppearance,
  randomizeAppearance,
  sanitizeAppearance,
} from './appearance.ts';
import {
  advancePlayerQuests,
  ensurePlayerQuests,
  getDailyPeriodKey,
  getWeeklyPeriodKey,
} from './quests.ts';
import {
  claimPlayerQuest,
  createDefaultPlayer,
  createSimWorld,
  damageEnemy,
  startDynamicWorldEvent,
  stepDynamicWorldEvent,
  stepSimWorld,
} from './simulation.ts';

test('appearance defaults, sanitization, and randomization stay valid across classes', () => {
  const arcDefault = getDefaultAppearance('arcanist');
  assert.equal(arcDefault.outfitStyle, 'astral');
  assert.equal(arcDefault.eyeGlow, 'cyan');

  const sanitized = sanitizeAppearance(
    {
      bodyType: 'invalid' as never,
      skinTone: 'not-hex',
      faceStyle: 'masked',
      hairStyle: 'braided',
      outfitTint: '#112233',
    },
    'vanguard',
  );
  assert.equal(sanitized.bodyType, 'titan');
  assert.equal(sanitized.faceStyle, 'masked');
  assert.equal(sanitized.hairStyle, 'braided');
  assert.equal(sanitized.outfitTint, '#112233');

  const rnd = randomizeAppearance(7);
  assert.match(rnd.skinTone, /^#[0-9a-f]{6}$/);
  assert.match(rnd.outfitTint, /^#[0-9a-f]{6}$/);
});

test('main story quest unlocks sequentially, grants relic reward, and side/daily quests reset by period', () => {
  const world = createSimWorld();
  const hero = createDefaultPlayer('q-hero', 'Sera', 'vanguard');
  world.players.set(hero.id, hero);

  // Chapter I active, Chapter II locked behind prerequisite
  assert.ok(hero.quests.some((q) => q.questId === 'main-ch1-stalkers' && q.status === 'active'));
  assert.equal(hero.quests.some((q) => q.questId === 'main-ch2-shrine'), false);

  // Defeat 3 stalkers to complete Chapter I
  for (let i = 0; i < 3; i++) {
    advancePlayerQuests(hero, { kind: 'kill_archetype', archetype: 'stalker' });
    advancePlayerQuests(hero, { kind: 'kill_any' });
  }
  const ch1 = hero.quests.find((q) => q.questId === 'main-ch1-stalkers')!;
  assert.equal(ch1.status, 'completed');
  assert.equal(ch1.progress, 3);

  // Claim Chapter I -> unlocks Chapter II and adds Dawn Guard Charm
  const claimed = claimPlayerQuest(world, hero, 'main-ch1-stalkers');
  assert.equal(claimed, true);
  assert.equal(ch1.status, 'claimed');
  assert.ok(hero.quests.some((q) => q.questId === 'main-ch2-shrine' && q.status === 'active'));
  assert.ok(hero.inventory.some((item) => item.itemKey === 'dawn_guard_charm'));

  // Side quest zone discovery
  hero.x = 22;
  hero.z = 8;
  stepSimWorld(world, 0.05);
  const verdantSide = hero.quests.find((q) => q.questId === 'side-verdant-crossing')!;
  assert.equal(verdantSide.status, 'completed');

  // Daily & Weekly period key rollover resets repeatable quest progress
  const dayOne = Date.UTC(2026, 0, 10, 12, 0, 0);
  const dayTwo = Date.UTC(2026, 0, 11, 12, 0, 0);
  const nextWeek = Date.UTC(2026, 0, 18, 12, 0, 0);
  assert.notEqual(getDailyPeriodKey(dayOne), getDailyPeriodKey(dayTwo));
  assert.notEqual(getWeeklyPeriodKey(dayOne), getWeeklyPeriodKey(nextWeek));

  ensurePlayerQuests(hero, dayOne);
  const daily = hero.quests.find((q) => q.questId === 'daily-valley-patrol')!;
  daily.progress = 5;
  daily.status = 'completed';
  ensurePlayerQuests(hero, dayTwo);
  assert.equal(daily.status, 'active');
  assert.equal(daily.progress, 0);
});

test('dynamic world events spawn event mobs, track cooperative progress, reward heroes, and advance daily quest', () => {
  const world = createSimWorld();
  const persistedEvents: string[] = [];
  world.onPersistWorldEvent = (evt) => {
    persistedEvents.push(`${evt.id}:${evt.status}:${evt.progress}`);
  };

  const hero = createDefaultPlayer('evt-hero', 'Veyra', 'arcanist');
  world.players.set(hero.id, hero);

  const evt = startDynamicWorldEvent(world, 10_000, 'invasion');
  assert.equal(evt.kind, 'invasion');
  assert.equal(evt.status, 'active');

  const eventMobs = world.enemies.filter((e) => e.eventId === evt.id);
  assert.equal(eventMobs.length, 5);

  const goldBefore = hero.gold;
  // Defeat all invasion mobs
  for (const mob of eventMobs) {
    damageEnemy(world, mob, hero, 9999);
  }
  assert.equal(evt.progress, evt.goal);
  assert.ok(evt.participantScores[hero.id].score > 0);

  // Step world to finalize completed event
  stepDynamicWorldEvent(world, 0.05, 10_500);
  assert.equal(world.dynamicEvent, null);
  assert.equal(world.enemies.some((e) => e.eventId === evt.id), false);
  assert.ok(hero.gold > goldBefore + 80);
  assert.ok(persistedEvents.some((p) => p.includes(':completed:')));

  const dailyEventQuest = hero.quests.find((q) => q.questId === 'daily-world-event')!;
  assert.equal(dailyEventQuest.status, 'completed');

  // Test Sunken Vault capture progression
  const vault = startDynamicWorldEvent(world, 20_000, 'dungeon_rift');
  hero.x = vault.x;
  hero.z = vault.z;
  stepDynamicWorldEvent(world, 1.0, 21_000);
  assert.ok(vault.progress > 5, 'Standing inside Vault Seal should advance progress');
});
