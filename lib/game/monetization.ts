import type {
  ActiveAdBuff,
  BattlePassTierDef,
  CosmeticCatalogItem,
  HeroAppearance,
  HeroCloakStyle,
  HeroOutfitStyle,
  HeroWeaponSkin,
  PlayerMonetizationState,
  PlayerState,
  RewardedAdKind,
  RewardedAdOffer,
} from './types.ts';

export const BATTLE_PASS_XP_PER_TIER = 100;
export const BATTLE_PASS_MAX_TIER = 8;
export const BATTLE_PASS_GOLD_PRICE = 180;
export const BATTLE_PASS_SUB_PRICE = '$9.99 / Season';

export const STARTER_OUTFITS = new Set<HeroOutfitStyle>([
  'sanctuary',
  'warden',
  'astral',
  'nomad',
]);

export const COSMETIC_CATALOG: CosmeticCatalogItem[] = [
  {
    id: 'cloak_wolfskin',
    name: 'Timberwolf Pelt Cloak',
    category: 'cloak',
    description: 'Rough timberwolf mantle bound with wrought-iron shoulder clasps.',
    goldPrice: 60,
    usdPrice: '$2.99',
    rarity: 'rare',
    statNote: 'Cosmetic Only',
    cloakStyle: 'wolfskin',
  },
  {
    id: 'cloak_frostwolf',
    name: 'Frostwolf Alpha Mantle',
    category: 'cloak',
    description: 'Bleached highland wolf pelt pinned with silver-forged fang brooches.',
    goldPrice: 95,
    usdPrice: '$4.99',
    rarity: 'epic',
    statNote: 'Cosmetic Only',
    cloakStyle: 'frostwolf',
  },
  {
    id: 'cloak_ragged_ash',
    name: 'Ashen Marauder Shroud',
    category: 'cloak',
    description: 'Charred war-cloak frayed along the hem from cinder rift patrols.',
    goldPrice: 45,
    usdPrice: '$1.99',
    rarity: 'rare',
    statNote: 'Cosmetic Only',
    cloakStyle: 'ragged_ash',
    battlePassSource: 'Pass Tier 2 (Free)',
  },
  {
    id: 'armor_wolfguard',
    name: 'Wolfguard Brigandine',
    category: 'armor',
    description: 'Riveted blackened iron plates layered beneath heavy wolf-fur pauldrons.',
    goldPrice: 110,
    usdPrice: '$4.99',
    rarity: 'epic',
    statNote: 'Cosmetic Only',
    outfitStyle: 'wolfguard',
  },
  {
    id: 'armor_ashstalker',
    name: 'Ashstalker Leathers',
    category: 'armor',
    description: 'Weathered hide harness strapped with twin throwing sheaths.',
    goldPrice: 85,
    usdPrice: '$3.99',
    rarity: 'rare',
    statNote: 'Cosmetic Only',
    outfitStyle: 'ashstalker',
  },
  {
    id: 'armor_ironbound',
    name: 'Ironbound Dreadplate',
    category: 'armor',
    description: 'Spiked darkforge gorget and heavy siege spaulders.',
    goldPrice: 140,
    usdPrice: '$6.99',
    rarity: 'relic',
    statNote: 'Cosmetic Only',
    outfitStyle: 'ironbound',
    battlePassSource: 'Pass Tier 4 (Covenant)',
  },
  {
    id: 'wpn_ashen_fang',
    name: 'Ashen Fang',
    category: 'weapon',
    description: 'Serrated obsidian-iron silhouette tailored cleanly to your class weapon.',
    goldPrice: 75,
    usdPrice: '$3.99',
    rarity: 'rare',
    statNote: 'Cosmetic Only',
    weaponSkin: 'ashen_fang',
  },
  {
    id: 'wpn_runeblade',
    name: 'Solis Runeforge',
    category: 'weapon',
    description: 'Amber-etched rune channeling along blade, staff conduit, or recurve limbs.',
    goldPrice: 115,
    usdPrice: '$4.99',
    rarity: 'epic',
    statNote: 'Cosmetic Only',
    weaponSkin: 'runeblade',
    battlePassSource: 'Pass Tier 6 (Free)',
  },
  {
    id: 'wpn_stormcaller',
    name: 'Stormcaller Reliquary',
    category: 'weapon',
    description: 'Tempest-tempered weapon silhouette veined with pale cobalt steel.',
    goldPrice: 150,
    usdPrice: '$6.99',
    rarity: 'relic',
    statNote: 'Cosmetic Only',
    weaponSkin: 'stormcaller',
    battlePassSource: 'Pass Tier 8 (Covenant)',
  },
];

export const COSMETIC_BY_ID: Record<string, CosmeticCatalogItem> = Object.fromEntries(
  COSMETIC_CATALOG.map((item) => [item.id, item]),
);

export const AD_REWARDS_CATALOG: RewardedAdOffer[] = [
  {
    kind: 'swiftness',
    title: 'Windwalker Adrenaline',
    benefitLabel: '+25% Move Speed & +30% Dash Recovery for 3m',
    durationSec: 180,
    cooldownSec: 30,
    accentColor: '#38bdf8',
  },
  {
    kind: 'fury',
    title: 'Berserker Spirit',
    benefitLabel: '+18% Skill Damage vs Monsters for 3m',
    durationSec: 180,
    cooldownSec: 30,
    accentColor: '#f43f5e',
  },
  {
    kind: 'tribute',
    title: 'Merchant Guild Stipend',
    benefitLabel: '+65 Gold immediately (60s cooldown)',
    durationSec: 0,
    cooldownSec: 60,
    accentColor: '#fbbf24',
  },
];

export const AD_OFFER_BY_KIND: Record<RewardedAdKind, RewardedAdOffer> = Object.fromEntries(
  AD_REWARDS_CATALOG.map((o) => [o.kind, o]),
) as Record<RewardedAdKind, RewardedAdOffer>;

export const BATTLE_PASS_TIERS: BattlePassTierDef[] = [
  {
    tier: 1,
    xpRequired: 100,
    freeReward: { kind: 'gold', label: '35 Gold', amount: 35 },
    premiumReward: { kind: 'gold', label: '75 Gold', amount: 75 },
  },
  {
    tier: 2,
    xpRequired: 200,
    freeReward: {
      kind: 'cosmetic',
      label: 'Ashen Marauder Shroud',
      cosmeticId: 'cloak_ragged_ash',
    },
    premiumReward: { kind: 'potions', label: '3 Aether Flasks', amount: 3 },
  },
  {
    tier: 3,
    xpRequired: 300,
    freeReward: { kind: 'potions', label: '2 Aether Flasks', amount: 2 },
    premiumReward: {
      kind: 'cosmetic',
      label: 'Timberwolf Pelt Cloak',
      cosmeticId: 'cloak_wolfskin',
    },
  },
  {
    tier: 4,
    xpRequired: 400,
    freeReward: { kind: 'gold', label: '55 Gold', amount: 55 },
    premiumReward: {
      kind: 'cosmetic',
      label: 'Ironbound Dreadplate',
      cosmeticId: 'armor_ironbound',
    },
  },
  {
    tier: 5,
    xpRequired: 500,
    freeReward: { kind: 'gold', label: '65 Gold', amount: 65 },
    premiumReward: {
      kind: 'cosmetic',
      label: 'Ashen Fang Weapon',
      cosmeticId: 'wpn_ashen_fang',
    },
  },
  {
    tier: 6,
    xpRequired: 600,
    freeReward: {
      kind: 'cosmetic',
      label: 'Solis Runeforge',
      cosmeticId: 'wpn_runeblade',
    },
    premiumReward: {
      kind: 'cosmetic',
      label: 'Frostwolf Alpha Mantle',
      cosmeticId: 'cloak_frostwolf',
    },
  },
  {
    tier: 7,
    xpRequired: 700,
    freeReward: { kind: 'potions', label: '3 Aether Flasks', amount: 3 },
    premiumReward: {
      kind: 'cosmetic',
      label: 'Wolfguard Brigandine',
      cosmeticId: 'armor_wolfguard',
    },
  },
  {
    tier: 8,
    xpRequired: 800,
    freeReward: { kind: 'gold', label: '110 Gold', amount: 110 },
    premiumReward: {
      kind: 'cosmetic',
      label: 'Stormcaller Reliquary',
      cosmeticId: 'wpn_stormcaller',
    },
  },
];

export function createDefaultMonetizationState(): PlayerMonetizationState {
  return {
    unlockedCosmetics: [],
    battlePassPremium: false,
    battlePassXp: 0,
    claimedFreeTiers: [],
    claimedPremiumTiers: [],
    activeAdBuffs: [],
    lastAdClaimAt: 0,
    adsWatchedCount: 0,
  };
}

export function sanitizeMonetizationState(
  raw: Partial<PlayerMonetizationState> | null | undefined,
  nowMs = Date.now(),
): PlayerMonetizationState {
  const def = createDefaultMonetizationState();
  if (!raw || typeof raw !== 'object') return def;

  const unlockedCosmetics = Array.isArray(raw.unlockedCosmetics)
    ? Array.from(
        new Set(
          raw.unlockedCosmetics.filter((id): id is string => typeof id === 'string' && Boolean(COSMETIC_BY_ID[id])),
        ),
      )
    : [];

  const claimedFreeTiers = Array.isArray(raw.claimedFreeTiers)
    ? Array.from(
        new Set(
          raw.claimedFreeTiers.filter((t): t is number => typeof t === 'number' && t >= 1 && t <= BATTLE_PASS_MAX_TIER),
        ),
      )
    : [];

  const claimedPremiumTiers = Array.isArray(raw.claimedPremiumTiers)
    ? Array.from(
        new Set(
          raw.claimedPremiumTiers.filter(
            (t): t is number => typeof t === 'number' && t >= 1 && t <= BATTLE_PASS_MAX_TIER,
          ),
        ),
      )
    : [];

  const activeAdBuffs: ActiveAdBuff[] = Array.isArray(raw.activeAdBuffs)
    ? raw.activeAdBuffs.filter(
        (b): b is ActiveAdBuff =>
          Boolean(b) &&
          (b.kind === 'swiftness' || b.kind === 'fury') &&
          typeof b.label === 'string' &&
          typeof b.expiresAt === 'number' &&
          b.expiresAt > nowMs,
      )
    : [];

  return {
    unlockedCosmetics,
    battlePassPremium: Boolean(raw.battlePassPremium),
    battlePassXp: Math.max(0, Math.min(BATTLE_PASS_MAX_TIER * BATTLE_PASS_XP_PER_TIER, Number(raw.battlePassXp) || 0)),
    claimedFreeTiers,
    claimedPremiumTiers,
    activeAdBuffs,
    lastAdClaimAt: Math.max(0, Number(raw.lastAdClaimAt) || 0),
    adsWatchedCount: Math.max(0, Math.floor(Number(raw.adsWatchedCount) || 0)),
  };
}

export function getBattlePassTier(xp: number): number {
  return Math.min(BATTLE_PASS_MAX_TIER, Math.floor(Math.max(0, xp) / BATTLE_PASS_XP_PER_TIER));
}

export function isCosmeticOutfitUnlocked(
  outfitStyle: HeroOutfitStyle,
  unlockedCosmetics: string[],
): boolean {
  if (STARTER_OUTFITS.has(outfitStyle)) return true;
  return COSMETIC_CATALOG.some(
    (c) => c.outfitStyle === outfitStyle && unlockedCosmetics.includes(c.id),
  );
}

export function isCloakUnlocked(
  cloakStyle: HeroCloakStyle,
  unlockedCosmetics: string[],
): boolean {
  if (cloakStyle === 'standard') return true;
  return COSMETIC_CATALOG.some(
    (c) => c.cloakStyle === cloakStyle && unlockedCosmetics.includes(c.id),
  );
}

export function isWeaponSkinUnlocked(
  weaponSkin: HeroWeaponSkin,
  unlockedCosmetics: string[],
): boolean {
  if (weaponSkin === 'standard') return true;
  return COSMETIC_CATALOG.some(
    (c) => c.weaponSkin === weaponSkin && unlockedCosmetics.includes(c.id),
  );
}

export function enforceUnlockedAppearance(
  candidate: HeroAppearance,
  fallback: HeroAppearance,
  unlockedCosmetics: string[],
): HeroAppearance {
  return {
    ...candidate,
    outfitStyle: isCosmeticOutfitUnlocked(candidate.outfitStyle, unlockedCosmetics)
      ? candidate.outfitStyle
      : isCosmeticOutfitUnlocked(fallback.outfitStyle, unlockedCosmetics)
        ? fallback.outfitStyle
        : 'sanctuary',
    cloakStyle: isCloakUnlocked(candidate.cloakStyle, unlockedCosmetics)
      ? candidate.cloakStyle
      : isCloakUnlocked(fallback.cloakStyle, unlockedCosmetics)
        ? fallback.cloakStyle
        : 'standard',
    weaponSkin: isWeaponSkinUnlocked(candidate.weaponSkin, unlockedCosmetics)
      ? candidate.weaponSkin
      : isWeaponSkinUnlocked(fallback.weaponSkin, unlockedCosmetics)
        ? fallback.weaponSkin
        : 'standard',
  };
}

export function applyCosmeticToAppearance(
  appearance: HeroAppearance,
  item: CosmeticCatalogItem,
): HeroAppearance {
  return {
    ...appearance,
    outfitStyle: item.outfitStyle ?? appearance.outfitStyle,
    cloakStyle: item.cloakStyle ?? appearance.cloakStyle,
    weaponSkin: item.weaponSkin ?? appearance.weaponSkin,
  };
}

export function purchaseCosmeticItem(
  player: PlayerState,
  itemId: string,
  method: 'gold' | 'direct',
  autoEquip = true,
): { ok: boolean; alreadyOwned?: boolean; reason?: string; item?: CosmeticCatalogItem } {
  const item = COSMETIC_BY_ID[itemId];
  if (!item) return { ok: false, reason: 'Unknown cosmetic item' };

  const owned = player.monetization.unlockedCosmetics.includes(item.id);
  if (!owned) {
    if (method === 'gold') {
      if (player.gold < item.goldPrice) {
        return { ok: false, reason: `Need ${item.goldPrice} Gold` };
      }
      player.gold -= item.goldPrice;
    }
    player.monetization.unlockedCosmetics.push(item.id);
  }

  if (autoEquip) {
    player.appearance = applyCosmeticToAppearance(player.appearance, item);
  }

  return { ok: true, alreadyOwned: owned, item };
}

export function activateBattlePass(
  player: PlayerState,
  method: 'gold' | 'subscription',
): { ok: boolean; reason?: string } {
  if (player.monetization.battlePassPremium) {
    return { ok: true };
  }
  if (method === 'gold') {
    if (player.gold < BATTLE_PASS_GOLD_PRICE) {
      return { ok: false, reason: `Need ${BATTLE_PASS_GOLD_PRICE} Gold` };
    }
    player.gold -= BATTLE_PASS_GOLD_PRICE;
  }
  player.monetization.battlePassPremium = true;
  return { ok: true };
}

export function grantBattlePassXp(player: PlayerState, amount: number): boolean {
  if (amount <= 0) return false;
  const maxTotal = BATTLE_PASS_MAX_TIER * BATTLE_PASS_XP_PER_TIER;
  const prevTier = getBattlePassTier(player.monetization.battlePassXp);
  player.monetization.battlePassXp = Math.min(maxTotal, player.monetization.battlePassXp + amount);
  const nextTier = getBattlePassTier(player.monetization.battlePassXp);
  return nextTier > prevTier;
}

export function claimBattlePassTierReward(
  player: PlayerState,
  tier: number,
  track: 'free' | 'premium',
): { ok: boolean; reason?: string; rewardLabel?: string } {
  const tierDef = BATTLE_PASS_TIERS.find((t) => t.tier === tier);
  if (!tierDef) return { ok: false, reason: 'Invalid Battle Pass tier' };

  const unlockedTier = getBattlePassTier(player.monetization.battlePassXp);
  if (unlockedTier < tier) {
    return { ok: false, reason: `Requires Tier ${tier}` };
  }

  if (track === 'premium') {
    if (!player.monetization.battlePassPremium) {
      return { ok: false, reason: 'Requires Covenant Battle Pass' };
    }
    if (player.monetization.claimedPremiumTiers.includes(tier)) {
      return { ok: false, reason: 'Already claimed' };
    }
    player.monetization.claimedPremiumTiers.push(tier);
    applyRewardEntry(player, tierDef.premiumReward);
    return { ok: true, rewardLabel: tierDef.premiumReward.label };
  }

  if (player.monetization.claimedFreeTiers.includes(tier)) {
    return { ok: false, reason: 'Already claimed' };
  }
  player.monetization.claimedFreeTiers.push(tier);
  applyRewardEntry(player, tierDef.freeReward);
  return { ok: true, rewardLabel: tierDef.freeReward.label };
}

function applyRewardEntry(
  player: PlayerState,
  reward: BattlePassTierDef['freeReward'],
) {
  if (reward.kind === 'gold' && reward.amount) {
    player.gold += reward.amount;
  } else if (reward.kind === 'potions' && reward.amount) {
    player.potions += reward.amount;
  } else if (reward.kind === 'cosmetic' && reward.cosmeticId) {
    if (!player.monetization.unlockedCosmetics.includes(reward.cosmeticId)) {
      player.monetization.unlockedCosmetics.push(reward.cosmeticId);
    }
  }
}

export function pruneExpiredAdBuffs(player: PlayerState, nowMs: number) {
  player.monetization.activeAdBuffs = player.monetization.activeAdBuffs.filter(
    (b) => b.expiresAt > nowMs,
  );
}

export function applyRewardedAdBenefit(
  player: PlayerState,
  kind: RewardedAdKind,
  nowMs = Date.now(),
): { ok: boolean; reason?: string; offer?: RewardedAdOffer } {
  const offer = AD_OFFER_BY_KIND[kind];
  if (!offer) return { ok: false, reason: 'Unknown ad reward' };

  pruneExpiredAdBuffs(player, nowMs);

  const cooldownMs = offer.cooldownSec * 1000;
  if (kind === 'tribute' && player.monetization.lastAdClaimAt > 0 && nowMs - player.monetization.lastAdClaimAt < cooldownMs) {
    const waitSec = Math.ceil((cooldownMs - (nowMs - player.monetization.lastAdClaimAt)) / 1000);
    return { ok: false, reason: `Stipend ready in ${waitSec}s` };
  }

  player.monetization.lastAdClaimAt = nowMs;
  player.monetization.adsWatchedCount += 1;
  if (player.philosophy) {
    player.philosophy.potentialScore = (player.philosophy.potentialScore ?? 0) + 25;
  }

  if (kind === 'tribute') {
    player.gold += 65;
  } else {
    const remaining = player.monetization.activeAdBuffs.filter((b) => b.kind !== kind);
    remaining.push({
      kind,
      label: offer.title,
      expiresAt: nowMs + offer.durationSec * 1000,
    });
    player.monetization.activeAdBuffs = remaining;
  }

  return { ok: true, offer };
}

export function getActiveAdBuffMultipliers(
  player: PlayerState,
  nowMs: number,
): { moveSpeedMult: number; dashRecoveryMult: number; damageMult: number } {
  let moveSpeedMult = 1;
  let dashRecoveryMult = 1;
  let damageMult = 1;

  for (const buff of player.monetization.activeAdBuffs) {
    if (buff.expiresAt <= nowMs) continue;
    if (buff.kind === 'swiftness') {
      moveSpeedMult += 0.25;
      dashRecoveryMult += 0.3;
    } else if (buff.kind === 'fury') {
      damageMult += 0.18;
    }
  }

  return { moveSpeedMult, dashRecoveryMult, damageMult };
}
