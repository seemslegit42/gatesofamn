import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activateBattlePass,
  applyRewardedAdBenefit,
  claimBattlePassTierReward,
  enforceUnlockedAppearance,
  getActiveAdBuffMultipliers,
  getBattlePassTier,
  purchaseCosmeticItem,
  sanitizeMonetizationState,
} from './monetization.ts';
import { getDefaultAppearance } from './appearance.ts';
import {
  createDefaultPlayer,
  createSimWorld,
  damageEnemy,
  executePlayerSkill,
  stepSimWorld,
} from './simulation.ts';

test('non-consumable cosmetics unlock permanently, preserve fair-play stats, and block unowned equips', () => {
  const hero = createDefaultPlayer('cos-hero', 'Kaelen', 'vanguard');
  const baseMaxHp = hero.maxHp;
  const baseWeaponPower = hero.weaponPower;
  const baseCharmPower = hero.charmPower;

  // Attempt gold purchase without enough gold fails cleanly
  hero.gold = 10;
  const tooPoor = purchaseCosmeticItem(hero, 'cloak_wolfskin', 'gold');
  assert.equal(tooPoor.ok, false);
  assert.equal(hero.monetization.unlockedCosmetics.includes('cloak_wolfskin'), false);

  // Unlock via gold when affordable
  hero.gold = 100;
  const bought = purchaseCosmeticItem(hero, 'cloak_wolfskin', 'gold', true);
  assert.equal(bought.ok, true);
  assert.equal(hero.gold, 40);
  assert.ok(hero.monetization.unlockedCosmetics.includes('cloak_wolfskin'));
  assert.equal(hero.appearance.cloakStyle, 'wolfskin');

  // Zero combat stat changes!
  assert.equal(hero.maxHp, baseMaxHp);
  assert.equal(hero.weaponPower, baseWeaponPower);
  assert.equal(hero.charmPower, baseCharmPower);

  // Unlock weapon skin via non-consumable IAP direct flow
  const directWpn = purchaseCosmeticItem(hero, 'wpn_ashen_fang', 'direct', true);
  assert.equal(directWpn.ok, true);
  assert.equal(hero.appearance.weaponSkin, 'ashen_fang');

  // Trying to equip an unowned cosmetic outfit/cloak is rejected by enforceUnlockedAppearance
  const tampered = {
    ...hero.appearance,
    outfitStyle: 'ironbound' as const,
    cloakStyle: 'frostwolf' as const,
  };
  const enforced = enforceUnlockedAppearance(
    tampered,
    hero.appearance,
    hero.monetization.unlockedCosmetics,
  );
  assert.equal(enforced.outfitStyle, 'sanctuary');
  assert.equal(enforced.cloakStyle, 'wolfskin');
});

test('rewarded video ad benefits grant temporary swiftness/fury boosts and gold stipends with expiry', () => {
  const world = createSimWorld();
  const hero = createDefaultPlayer('ad-hero', 'Lyra', 'vanguard');
  hero.x = 0;
  hero.z = 22;
  world.players.set(hero.id, hero);

  const now0 = 1_000_000;

  // 1. Gold stipend (+65 gold) & 60s cooldown enforcement
  const goldBefore = hero.gold;
  const stipend = applyRewardedAdBenefit(hero, 'tribute', now0);
  assert.equal(stipend.ok, true);
  assert.equal(hero.gold, goldBefore + 65);
  assert.equal(hero.monetization.adsWatchedCount, 1);

  const tooSoon = applyRewardedAdBenefit(hero, 'tribute', now0 + 15_000);
  assert.equal(tooSoon.ok, false);

  // 2. Swiftness boon increases move speed by +25%
  const swift = applyRewardedAdBenefit(hero, 'swiftness', now0 + 61_000);
  assert.equal(swift.ok, true);
  const mults = getActiveAdBuffMultipliers(hero, now0 + 62_000);
  assert.ok(mults.moveSpeedMult > 1.2);
  assert.ok(mults.dashRecoveryMult > 1.25);

  // 3. Fury boon boosts skill damage in simulation
  const targetEnemy = world.enemies[0];
  targetEnemy.x = hero.x;
  targetEnemy.z = hero.z - 1.5;
  const hpBeforeNormal = targetEnemy.hp;
  executePlayerSkill(world, hero, 0, targetEnemy.x, targetEnemy.z);
  const normalDamage = hpBeforeNormal - targetEnemy.hp;

  hero.cooldowns[0] = 0;
  hero.mana = hero.maxMana;
  const fury = applyRewardedAdBenefit(hero, 'fury', now0 + 65_000);
  assert.equal(fury.ok, true);
  world.nowMs = now0 + 66_000;

  const hpBeforeFury = targetEnemy.hp;
  executePlayerSkill(world, hero, 0, targetEnemy.x, targetEnemy.z);
  const furyDamage = hpBeforeFury - targetEnemy.hp;
  assert.ok(furyDamage > normalDamage, `Expected fury damage (${furyDamage}) > normal (${normalDamage})`);

  // 4. Expired buffs are pruned during world step
  stepSimWorld(world, 0.05, now0 + 500_000);
  assert.equal(hero.monetization.activeAdBuffs.length, 0);
});

test('seasonal battle pass tracks progression from combat and unlocks free vs covenant subscription rewards', () => {
  const world = createSimWorld();
  const hero = createDefaultPlayer('bp-hero', 'Thorne', 'ranger');
  world.players.set(hero.id, hero);

  // Slay enough monsters (12 XP each; boss 35 XP) to hit Tier 2 (>= 200 XP)
  for (let i = 0; i < 6; i++) {
    const boss = world.enemies.find((e) => e.isBoss)!;
    boss.phase = 'patrol';
    boss.hp = boss.maxHp;
    damageEnemy(world, boss, hero, 9999);
  }
  assert.ok(getBattlePassTier(hero.monetization.battlePassXp) >= 2);

  // Claim Free Tier 2 -> unlocks Ashen Marauder Shroud cosmetic
  const freeTier2 = claimBattlePassTierReward(hero, 2, 'free');
  assert.equal(freeTier2.ok, true);
  assert.ok(hero.monetization.unlockedCosmetics.includes('cloak_ragged_ash'));

  // Claiming Premium Tier 3 before activating subscription fails
  const premBefore = claimBattlePassTierReward(hero, 3, 'premium');
  assert.equal(premBefore.ok, false);

  // Activate Covenant Pass Subscription and claim Tier 3 -> unlocks Timberwolf Pelt Cloak
  const sub = activateBattlePass(hero, 'subscription');
  assert.equal(sub.ok, true);
  assert.equal(hero.monetization.battlePassPremium, true);

  // Ensure Tier 3 XP is reached
  const boss = world.enemies.find((e) => e.isBoss)!;
  for (let i = 0; i < 4; i++) {
    boss.phase = 'patrol';
    boss.hp = boss.maxHp;
    damageEnemy(world, boss, hero, 9999);
  }
  assert.ok(getBattlePassTier(hero.monetization.battlePassXp) >= 3);

  const premTier3 = claimBattlePassTierReward(hero, 3, 'premium');
  assert.equal(premTier3.ok, true);
  assert.ok(hero.monetization.unlockedCosmetics.includes('cloak_wolfskin'));

  // Sanitization preserves persisted monetization data & prunes expired buffs
  const sanitized = sanitizeMonetizationState(hero.monetization, Date.now());
  assert.equal(sanitized.battlePassPremium, true);
  assert.ok(sanitized.unlockedCosmetics.includes('cloak_wolfskin'));
  assert.equal(getDefaultAppearance('ranger').cloakStyle, 'standard');
});
