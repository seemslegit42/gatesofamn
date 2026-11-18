'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Check,
  Coins,
  Crown,
  Flame,
  Lock,
  Play,
  Shield,
  ShoppingBag,
  Sparkles,
  Swords,
  Tv,
  Wind,
  X,
} from 'lucide-react';
import type {
  CosmeticCategory,
  HeroAppearance,
  PlayerMonetizationState,
  RewardedAdKind,
  SnapshotPlayer,
} from '@/lib/game/types';
import {
  AD_REWARDS_CATALOG,
  BATTLE_PASS_GOLD_PRICE,
  BATTLE_PASS_MAX_TIER,
  BATTLE_PASS_SUB_PRICE,
  BATTLE_PASS_TIERS,
  BATTLE_PASS_XP_PER_TIER,
  COSMETIC_CATALOG,
  getBattlePassTier,
} from '@/lib/game/monetization';

interface StorefrontModalProps {
  open: boolean;
  player: SnapshotPlayer | null;
  appearance: HeroAppearance;
  monetization: PlayerMonetizationState;
  serverTime: number;
  notice: string | null;
  onClose: () => void;
  onPurchaseCosmetic: (itemId: string, method: 'gold' | 'direct') => void;
  onEquipAppearance: (next: HeroAppearance) => void;
  onActivateBattlePass: (method: 'gold' | 'subscription') => void;
  onClaimPassTier: (tier: number, track: 'free' | 'premium') => void;
  onClaimAdReward: (kind: RewardedAdKind) => void;
}

type StoreTab = 'cosmetics' | 'pass' | 'ads';

const AD_DURATION_SEC = 5;

export default function StorefrontModal({
  open,
  player,
  appearance,
  monetization,
  serverTime,
  notice,
  onClose,
  onPurchaseCosmetic,
  onEquipAppearance,
  onActivateBattlePass,
  onClaimPassTier,
  onClaimAdReward,
}: StorefrontModalProps) {
  const [tab, setTab] = useState<StoreTab>('cosmetics');
  const [categoryFilter, setCategoryFilter] = useState<'all' | CosmeticCategory>('all');
  const [watchingAdKind, setWatchingAdKind] = useState<RewardedAdKind | null>(null);
  const [adElapsed, setAdElapsed] = useState<number>(0);
  const adCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Interactive 5-second Rewarded Video Ad Vignette Timer + Animated Canvas
  useEffect(() => {
    if (!open || !watchingAdKind) return;

    let raf = 0;
    const startMs = performance.now();

    const drawFrame = (now: number) => {
      const elapsedSec = Math.min(AD_DURATION_SEC, (now - startMs) / 1000);
      setAdElapsed(elapsedSec);

      const canvas = adCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.fillStyle = '#090d15';
          ctx.fillRect(0, 0, w, h);

          // Atmospheric dark-fantasy horizon & animated energy shard
          const grad = ctx.createRadialGradient(w * 0.5, h * 0.45, 12, w * 0.5, h * 0.45, w * 0.65);
          const glowColor =
            watchingAdKind === 'swiftness'
              ? 'rgba(56,189,248,0.34)'
              : watchingAdKind === 'fury'
                ? 'rgba(244,63,94,0.34)'
                : 'rgba(251,191,36,0.34)';
          grad.addColorStop(0, glowColor);
          grad.addColorStop(1, 'rgba(9,13,21,0)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, w, h);

          // Rotating forge rune rings
          ctx.save();
          ctx.translate(w * 0.5, h * 0.46);
          ctx.rotate(elapsedSec * 0.9);
          ctx.strokeStyle =
            watchingAdKind === 'swiftness'
              ? '#38bdf8'
              : watchingAdKind === 'fury'
                ? '#f43f5e'
                : '#fbbf24';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, 44, 0, Math.PI * 1.65);
          ctx.stroke();
          ctx.rotate(-elapsedSec * 1.6);
          ctx.strokeStyle = 'rgba(248,245,238,0.45)';
          ctx.beginPath();
          ctx.arc(0, 0, 30, 0, Math.PI * 1.4);
          ctx.stroke();
          ctx.restore();

          ctx.fillStyle = '#f8f5ee';
          ctx.font = '700 15px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('SOLIS GUILD DISPATCH', w * 0.5, h * 0.8);
          ctx.fillStyle = '#9fb0c7';
          ctx.font = '400 11px sans-serif';
          ctx.fillText('Sponsored Expedition Chronicle · Non-Intrusive Boon', w * 0.5, h * 0.9);
        }
      }

      if (elapsedSec < AD_DURATION_SEC) {
        raf = requestAnimationFrame(drawFrame);
      }
    };

    raf = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(raf);
  }, [open, watchingAdKind]);

  if (!open) return null;

  const currentGold = player?.gold ?? 0;
  const unlockedSet = new Set(monetization.unlockedCosmetics);
  const currentTier = getBattlePassTier(monetization.battlePassXp);
  const tierProgress = monetization.battlePassXp % BATTLE_PASS_XP_PER_TIER;
  const maxTotalXp = BATTLE_PASS_MAX_TIER * BATTLE_PASS_XP_PER_TIER;
  const overallPassPct = Math.min(100, (monetization.battlePassXp / maxTotalXp) * 100);

  const activeBuffByKind = new Map(
    (monetization.activeAdBuffs ?? [])
      .filter((b) => b.expiresAt > serverTime)
      .map((b) => [b.kind, Math.max(0, Math.ceil((b.expiresAt - serverTime) / 1000))]),
  );

  const tributeCooldownRemain =
    monetization.lastAdClaimAt > 0
      ? Math.max(0, 60 - Math.floor((serverTime - monetization.lastAdClaimAt) / 1000))
      : 0;

  const filteredCosmetics = COSMETIC_CATALOG.filter(
    (c) => categoryFilter === 'all' || c.category === categoryFilter,
  );

  const isCosmeticEquipped = (itemId: string) => {
    const item = COSMETIC_CATALOG.find((c) => c.id === itemId);
    if (!item) return false;
    if (item.cloakStyle) return appearance.cloakStyle === item.cloakStyle;
    if (item.outfitStyle) return appearance.outfitStyle === item.outfitStyle;
    if (item.weaponSkin) return appearance.weaponSkin === item.weaponSkin;
    return false;
  };

  const handleEquipOwned = (itemId: string) => {
    const item = COSMETIC_CATALOG.find((c) => c.id === itemId);
    if (!item) return;
    onEquipAppearance({
      ...appearance,
      cloakStyle: item.cloakStyle ?? appearance.cloakStyle,
      outfitStyle: item.outfitStyle ?? appearance.outfitStyle,
      weaponSkin: item.weaponSkin ?? appearance.weaponSkin,
    });
  };

  const adReadyToClaim = watchingAdKind !== null && adElapsed >= AD_DURATION_SEC - 0.05;
  const watchingOffer = watchingAdKind
    ? AD_REWARDS_CATALOG.find((o) => o.kind === watchingAdKind) ?? null
    : null;

  return (
    <div
      data-testid="storefront-modal"
      className="fixed inset-0 z-40 bg-[#080b12]/85 flex items-center justify-center p-3 sm:p-6 pointer-events-auto"
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-4xl rounded-2xl bg-[#0d121c] border border-[#e5a93c]/35 shadow-[0_28px_80px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Top Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-white/10 bg-[#101725]">
          <div className="min-w-0">
            <h2 className="font-display text-lg sm:text-xl font-bold text-[#f8f5ee] flex items-center gap-2">
              <Crown className="w-5 h-5 text-[#e5a93c] shrink-0" />
              <span className="truncate">Solis Armory &amp; Covenant</span>
            </h2>
            <p className="text-xs text-[#9fb0c7] truncate">
              Cosmetic-Only Non-Consumables · Season I Pass · Voluntary Ad Blessings
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 font-mono-num text-sm font-bold text-[#fbbf24]">
              <Coins className="w-4 h-4" />
              <span>{currentGold}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setWatchingAdKind(null);
                onClose();
              }}
              aria-label="Close Armory and Battle Pass"
              className="w-11 h-11 rounded-xl bg-[#161f30] border border-white/15 hover:border-white/35 flex items-center justify-center text-[#f8f5ee] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-4 sm:px-6 pt-3 pb-2 border-b border-white/10 bg-[#0d121c] flex flex-wrap gap-2 items-center justify-between">
          <div className="flex gap-1.5 w-full sm:w-auto">
            {(
              [
                { id: 'cosmetics', label: 'Cosmetic Outfitter', icon: ShoppingBag },
                { id: 'pass', label: 'Covenant Pass', icon: Crown },
                { id: 'ads', label: 'Ad Blessings', icon: Tv },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                data-testid={`store-tab-${id}`}
                onClick={() => {
                  setWatchingAdKind(null);
                  setTab(id);
                }}
                className={`flex-1 sm:flex-initial h-11 px-4 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  tab === id
                    ? 'bg-[#e5a93c] text-[#0c1018] border-[#e5a93c]'
                    : 'bg-[#121927] text-[#b8c2d4] border-white/10 hover:border-white/30'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {notice && (
            <div
              data-testid="store-notice"
              className="text-xs font-semibold text-[#34d399] truncate"
            >
              {notice}
            </div>
          )}
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
          {tab === 'cosmetics' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-1.5">
                  {(
                    [
                      { id: 'all', label: 'All Cosmetics' },
                      { id: 'cloak', label: 'Wolfskin & Cloaks' },
                      { id: 'armor', label: 'Armor Sets' },
                      { id: 'weapon', label: 'Weapon Designs' },
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategoryFilter(cat.id)}
                      className={`h-9 px-3 rounded-lg border text-xs font-semibold cursor-pointer whitespace-nowrap ${
                        categoryFilter === cat.id
                          ? 'bg-[#1a2436] border-[#e5a93c] text-[#f8f5ee]'
                          : 'bg-[#090d14] border-white/10 text-[#9fb0c7] hover:border-white/25'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
                <div className="text-xs text-[#9fb0c7]">
                  Fair Play Guarantee · Zero Combat Stat Changes
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredCosmetics.map((item) => {
                  const owned = unlockedSet.has(item.id);
                  const equipped = isCosmeticEquipped(item.id);
                  const canAffordGold = currentGold >= item.goldPrice;
                  return (
                    <div
                      key={item.id}
                      data-testid={`cosmetic-card-${item.id}`}
                      className={`rounded-xl border p-3.5 flex flex-col justify-between gap-3 ${
                        equipped
                          ? 'bg-[#141e30] border-[#34d399]/60'
                          : owned
                            ? 'bg-[#111826] border-[#e5a93c]/35'
                            : 'bg-[#0a0e16] border-white/12'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-display text-sm font-bold text-[#f8f5ee]">
                            {item.name}
                          </h3>
                          <span className="font-mono-num text-[11px] font-bold text-[#e5a93c] whitespace-nowrap shrink-0">
                            {owned ? 'Owned' : item.usdPrice}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#9fb0c7] capitalize mt-0.5">
                          {item.category} · {item.rarity} · {item.statNote}
                        </div>
                        <p className="text-xs text-[#b8c2d4] mt-2 leading-relaxed">
                          {item.description}
                        </p>
                        {item.battlePassSource && !owned && (
                          <div className="text-[11px] text-[#38bdf8] mt-1.5 font-semibold">
                            Also in {item.battlePassSource}
                          </div>
                        )}
                      </div>

                      {owned ? (
                        <button
                          type="button"
                          onClick={() => handleEquipOwned(item.id)}
                          disabled={equipped}
                          className={`w-full h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                            equipped
                              ? 'bg-[#183029] text-[#34d399] border border-[#34d399]/40 cursor-default'
                              : 'bg-[#e5a93c] hover:bg-[#f0b94d] text-[#0c1018]'
                          }`}
                        >
                          <Check className="w-4 h-4" />
                          <span>{equipped ? 'Equipped on Hero' : 'Equip Cosmetic'}</span>
                        </button>
                      ) : (
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            data-testid={`buy-gold-${item.id}`}
                            disabled={!canAffordGold}
                            onClick={() => onPurchaseCosmetic(item.id, 'gold')}
                            className={`h-11 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 font-mono-num cursor-pointer ${
                              canAffordGold
                                ? 'bg-[#182235] border-[#fbbf24]/50 hover:border-[#fbbf24] text-[#fbbf24]'
                                : 'bg-[#0c111b] border-white/10 text-[#64748b] cursor-not-allowed'
                            }`}
                          >
                            <Coins className="w-3.5 h-3.5" />
                            <span>{item.goldPrice}</span>
                          </button>
                          <button
                            type="button"
                            data-testid={`buy-iap-${item.id}`}
                            onClick={() => onPurchaseCosmetic(item.id, 'direct')}
                            className="h-11 rounded-xl bg-[#e5a93c] hover:bg-[#f0b94d] text-[#0c1018] text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>Unlock {item.usdPrice}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {tab === 'pass' && (
            <div className="space-y-4">
              {/* Season Banner */}
              <div className="rounded-2xl bg-[#111927] border border-[#e5a93c]/35 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-[#e5a93c]" />
                    <span className="font-display text-base font-bold text-[#f8f5ee]">
                      Season I: Covenant of Ash &amp; Wolf
                    </span>
                  </div>
                  <div className="text-xs text-[#9fb0c7] font-mono-num">
                    Tier {currentTier}/{BATTLE_PASS_MAX_TIER} · {monetization.battlePassXp}/{maxTotalXp} Pass XP
                    {currentTier < BATTLE_PASS_MAX_TIER ? ` · ${tierProgress}/${BATTLE_PASS_XP_PER_TIER} to next` : ''}
                  </div>
                  <div className="h-2 rounded-full bg-[#090d14] border border-white/10 overflow-hidden max-w-md">
                    <div
                      className="h-full bg-[#e5a93c] transition-[width] duration-200"
                      style={{ width: `${overallPassPct}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-[#9fb0c7]">
                    Earn Pass XP from Monsters, Quests, Shrines, and Dynamic World Events.
                  </div>
                </div>

                {monetization.battlePassPremium ? (
                  <div className="h-11 px-4 rounded-xl bg-[#183029] border border-[#34d399]/50 text-[#34d399] text-xs font-bold flex items-center gap-2 shrink-0">
                    <Check className="w-4 h-4" />
                    <span>Covenant Pass Active</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      type="button"
                      data-testid="activate-pass-gold"
                      disabled={currentGold < BATTLE_PASS_GOLD_PRICE}
                      onClick={() => onActivateBattlePass('gold')}
                      className={`h-11 px-3.5 rounded-xl border text-xs font-bold font-mono-num flex items-center gap-1.5 cursor-pointer ${
                        currentGold >= BATTLE_PASS_GOLD_PRICE
                          ? 'bg-[#182235] border-[#fbbf24]/50 hover:border-[#fbbf24] text-[#fbbf24]'
                          : 'bg-[#090d14] border-white/10 text-[#64748b] cursor-not-allowed'
                      }`}
                    >
                      <Coins className="w-4 h-4" />
                      <span>{BATTLE_PASS_GOLD_PRICE} Gold</span>
                    </button>
                    <button
                      type="button"
                      data-testid="activate-pass-sub"
                      onClick={() => onActivateBattlePass('subscription')}
                      className="h-11 px-4 rounded-xl bg-[#e5a93c] hover:bg-[#f0b94d] text-[#0c1018] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Crown className="w-4 h-4" />
                      <span>Subscribe {BATTLE_PASS_SUB_PRICE}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 8-Tier Free & Covenant Track */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {BATTLE_PASS_TIERS.map((t) => {
                  const unlocked = currentTier >= t.tier;
                  const freeClaimed = monetization.claimedFreeTiers.includes(t.tier);
                  const premClaimed = monetization.claimedPremiumTiers.includes(t.tier);
                  const canClaimFree = unlocked && !freeClaimed;
                  const canClaimPrem = unlocked && monetization.battlePassPremium && !premClaimed;

                  return (
                    <div
                      key={t.tier}
                      className={`rounded-xl border p-3 space-y-2.5 ${
                        unlocked
                          ? 'bg-[#111826] border-[#e5a93c]/35'
                          : 'bg-[#090d14] border-white/10 opacity-80'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-display font-bold text-[#f8f5ee]">
                          Tier {t.tier}
                        </span>
                        <span className="font-mono-num text-[11px] text-[#9fb0c7]">
                          {t.xpRequired} XP
                        </span>
                      </div>

                      {/* Free Track */}
                      <div className="rounded-lg bg-[#0d131f] border border-white/10 p-2">
                        <div className="text-[10px] uppercase tracking-wider text-[#9fb0c7]">
                          Free Track
                        </div>
                        <div className="text-xs font-semibold text-[#f8f5ee] truncate mt-0.5">
                          {t.freeReward.label}
                        </div>
                        <button
                          type="button"
                          disabled={!canClaimFree}
                          onClick={() => onClaimPassTier(t.tier, 'free')}
                          className={`mt-1.5 w-full h-9 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer ${
                            freeClaimed
                              ? 'bg-[#183029] text-[#34d399]'
                              : canClaimFree
                                ? 'bg-[#34d399] hover:bg-[#4ade80] text-[#0c1018]'
                                : 'bg-[#141c2c] text-[#64748b] cursor-not-allowed'
                          }`}
                        >
                          {freeClaimed ? <Check className="w-3.5 h-3.5" /> : !unlocked ? <Lock className="w-3 h-3" /> : null}
                          <span>{freeClaimed ? 'Claimed' : unlocked ? 'Claim' : 'Locked'}</span>
                        </button>
                      </div>

                      {/* Covenant Premium Track */}
                      <div className="rounded-lg bg-[#161a28] border border-[#e5a93c]/25 p-2">
                        <div className="text-[10px] uppercase tracking-wider text-[#e5a93c] flex items-center gap-1">
                          <Crown className="w-3 h-3" />
                          <span>Covenant</span>
                        </div>
                        <div className="text-xs font-semibold text-[#f8f5ee] truncate mt-0.5">
                          {t.premiumReward.label}
                        </div>
                        <button
                          type="button"
                          disabled={!canClaimPrem}
                          onClick={() => onClaimPassTier(t.tier, 'premium')}
                          className={`mt-1.5 w-full h-9 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer ${
                            premClaimed
                              ? 'bg-[#183029] text-[#34d399]'
                              : canClaimPrem
                                ? 'bg-[#e5a93c] hover:bg-[#f0b94d] text-[#0c1018]'
                                : 'bg-[#141c2c] text-[#64748b] cursor-not-allowed'
                          }`}
                        >
                          {premClaimed ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : !monetization.battlePassPremium || !unlocked ? (
                            <Lock className="w-3 h-3" />
                          ) : null}
                          <span>
                            {premClaimed
                              ? 'Claimed'
                              : !monetization.battlePassPremium
                                ? 'Pass Req'
                                : unlocked
                                  ? 'Claim'
                                  : 'Locked'}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'ads' && (
            <div className="space-y-4">
              {watchingAdKind && watchingOffer ? (
                <div
                  data-testid="rewarded-ad-player"
                  className="rounded-2xl bg-[#090d15] border border-[#e5a93c]/40 p-4 sm:p-5 flex flex-col items-center gap-3"
                >
                  <div className="w-full flex items-center justify-between text-xs text-[#9fb0c7]">
                    <span className="font-semibold text-[#f8f5ee]">
                      Rewarded Dispatch · {watchingOffer.title}
                    </span>
                    <span className="font-mono-num text-[#e5a93c]">
                      {adReadyToClaim
                        ? 'Reward Ready'
                        : `${Math.max(1, Math.ceil(AD_DURATION_SEC - adElapsed))}s remaining`}
                    </span>
                  </div>

                  <canvas
                    ref={adCanvasRef}
                    width={480}
                    height={200}
                    className="w-full max-w-[520px] rounded-xl border border-white/10"
                  />

                  <div className="w-full max-w-[520px] h-2 rounded-full bg-[#161f30] overflow-hidden">
                    <div
                      className="h-full bg-[#e5a93c]"
                      style={{ width: `${Math.min(100, (adElapsed / AD_DURATION_SEC) * 100)}%` }}
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setWatchingAdKind(null)}
                      className="h-11 px-4 rounded-xl bg-[#161f30] border border-white/15 text-xs font-semibold text-[#b8c2d4] cursor-pointer"
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      data-testid="claim-ad-reward-btn"
                      disabled={!adReadyToClaim}
                      onClick={() => {
                        onClaimAdReward(watchingAdKind);
                        setWatchingAdKind(null);
                      }}
                      className={`h-11 px-5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                        adReadyToClaim
                          ? 'bg-[#34d399] hover:bg-[#4ade80] text-[#0c1018]'
                          : 'bg-[#1a2232] text-[#64748b] cursor-not-allowed'
                      }`}
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Claim {watchingOffer.title}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs text-[#9fb0c7]">
                    <span>
                      Voluntary Rewarded Dispatches · Zero Forced Interruptions
                    </span>
                    <span className="font-mono-num text-[#e5a93c]">
                      Dispatches Viewed: {monetization.adsWatchedCount}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {AD_REWARDS_CATALOG.map((offer) => {
                      const remainBuffSec =
                        offer.kind !== 'tribute' ? activeBuffByKind.get(offer.kind) ?? 0 : 0;
                      const tributeBlocked = offer.kind === 'tribute' && tributeCooldownRemain > 0;
                      const Icon =
                        offer.kind === 'swiftness'
                          ? Wind
                          : offer.kind === 'fury'
                            ? Flame
                            : Coins;

                      return (
                        <div
                          key={offer.kind}
                          data-testid={`ad-offer-${offer.kind}`}
                          className="rounded-xl bg-[#0a0e16] border border-white/12 p-4 flex flex-col justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Icon className="w-4 h-4" style={{ color: offer.accentColor }} />
                                <h3 className="font-display text-sm font-bold text-[#f8f5ee]">
                                  {offer.title}
                                </h3>
                              </div>
                            </div>
                            <p className="text-xs text-[#b8c2d4] mt-2 leading-relaxed">
                              {offer.benefitLabel}
                            </p>
                            {remainBuffSec > 0 && (
                              <div className="text-xs font-mono-num font-bold text-[#34d399] mt-2">
                                Active · {Math.floor(remainBuffSec / 60)}:
                                {String(remainBuffSec % 60).padStart(2, '0')} left
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            data-testid={`watch-ad-${offer.kind}`}
                            disabled={tributeBlocked}
                            onClick={() => {
                              setAdElapsed(0);
                              setWatchingAdKind(offer.kind);
                            }}
                            className={`w-full h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                              tributeBlocked
                                ? 'bg-[#131a28] text-[#64748b] border border-white/10 cursor-not-allowed'
                                : 'bg-[#e5a93c] hover:bg-[#f0b94d] text-[#0c1018]'
                            }`}
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>
                              {tributeBlocked
                                ? `Ready in ${tributeCooldownRemain}s`
                                : remainBuffSec > 0
                                  ? 'Refresh Boon (5s Ad)'
                                  : 'Watch Dispatch (5s)'}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="rounded-xl bg-[#111826] border border-white/10 p-3 text-xs text-[#9fb0c7] flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#34d399] shrink-0" />
                    <span>
                      Temporary PvE boons and merchant stipends reward free-to-play explorers without paywalling combat progression.
                    </span>
                    <Swords className="w-4 h-4 text-[#e5a93c] shrink-0 hidden sm:block" />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
