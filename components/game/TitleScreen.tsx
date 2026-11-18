'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Shield, Sparkles, Compass, Play, SlidersHorizontal } from 'lucide-react';
import type { HeroAppearance, HeroClass } from '@/lib/game/types';
import { CLASS_SPECS } from '@/lib/game/worldData';

interface TitleScreenProps {
  heroName: string;
  heroClass: HeroClass;
  appearance: HeroAppearance;
  onChangeName: (name: string) => void;
  onChangeClass: (heroClass: HeroClass) => void;
  onOpenCreator: () => void;
  onStart: () => void;
}

const CLASS_ORDER: HeroClass[] = ['vanguard', 'arcanist', 'ranger'];

export default function TitleScreen({
  heroName,
  heroClass,
  appearance,
  onChangeName,
  onChangeClass,
  onOpenCreator,
  onStart,
}: TitleScreenProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStart();
  };

  const renderClassIcon = (id: HeroClass) => {
    if (id === 'vanguard') return <Shield className="w-5 h-5 text-[#e5a93c]" />;
    if (id === 'arcanist') return <Sparkles className="w-5 h-5 text-[#38bdf8]" />;
    return <Compass className="w-5 h-5 text-[#34d399]" />;
  };

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-5 sm:p-10 pointer-events-none">
      {/* Asymmetric Left-Third Panel leaving 60%+ live 3D Solis Reach open on the right */}
      <div className="my-auto w-full max-w-[430px] pointer-events-auto">
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: 'easeOut' }}
          className="rounded-2xl bg-[#0d121c]/90 border border-[#e5a93c]/30 shadow-[0_24px_60px_rgba(0,0,0,0.65)] p-5 sm:p-7"
        >
          {/* Bespoke Inline SVG Title Crest */}
          <div className="flex items-center gap-3.5 mb-5">
            <svg
              viewBox="0 0 64 64"
              className="w-12 h-12 shrink-0"
              aria-hidden="true"
            >
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="#e5a93c"
                strokeWidth="2"
                strokeOpacity="0.6"
              />
              <polygon
                points="32,6 42,26 60,32 42,38 32,58 22,38 4,32 22,26"
                fill="#162032"
                stroke="#e5a93c"
                strokeWidth="2.2"
              />
              <circle cx="32" cy="32" r="7" fill="#38bdf8" />
            </svg>
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-wide text-[#f8f5ee] leading-none">
                AETHERGATE
              </h1>
              <p className="text-xs tracking-[0.2em] uppercase text-[#e5a93c] mt-1 font-semibold">
                Shards of Solis
              </p>
            </div>
          </div>

          {/* Character Name */}
          <label className="block mb-4">
            <span className="block text-[11px] uppercase tracking-[0.14em] text-[#a9b4c7] font-semibold mb-1.5">
              Hero Name
            </span>
            <input
              type="text"
              maxLength={20}
              value={heroName}
              onChange={(e) => onChangeName(e.target.value)}
              placeholder="Enter hero name"
              className="w-full h-11 px-3.5 rounded-lg bg-[#080b12] border border-white/15 text-[#f8f5ee] text-sm font-medium placeholder:text-slate-500 focus:outline-none focus:border-[#e5a93c]"
            />
          </label>

          {/* Class Selector */}
          <div className="mb-4">
            <span className="block text-[11px] uppercase tracking-[0.14em] text-[#a9b4c7] font-semibold mb-2">
              Choose Path
            </span>
            <div className="grid grid-cols-1 gap-2">
              {CLASS_ORDER.map((cid) => {
                const spec = CLASS_SPECS[cid];
                const selected = heroClass === cid;
                return (
                  <button
                    key={cid}
                    type="button"
                    onClick={() => onChangeClass(cid)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl border transition-colors flex items-center gap-3 min-h-[44px] cursor-pointer ${
                      selected
                        ? 'bg-[#1a2234] border-[#e5a93c] text-[#f8f5ee]'
                        : 'bg-[#0a0e16]/85 border-white/10 text-[#b8c2d4] hover:border-white/25'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#0c1018] border border-white/10 flex items-center justify-center shrink-0">
                      {renderClassIcon(cid)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-[#f8f5ee]">
                          {spec.name}
                        </span>
                        <span className="text-[11px] text-[#9aa6bc] whitespace-nowrap">
                          {spec.title}
                        </span>
                      </div>
                      <p className="text-xs text-[#9aa6bc] truncate mt-0.5">
                        {spec.summary}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Character Appearance Summary + Hero Forge Button */}
          <div className="mb-4 flex items-center justify-between gap-2 rounded-xl bg-[#0a0e16] border border-white/10 px-3.5 py-2.5">
            <div className="min-w-0">
              <div className="text-[11px] text-[#9aa6bc]">Appearance</div>
              <div className="text-xs font-semibold text-[#f8f5ee] capitalize truncate">
                {appearance.bodyType} · {appearance.faceStyle} · {appearance.hairStyle} · {appearance.outfitStyle}
              </div>
            </div>
            <button
              type="button"
              data-testid="open-hero-forge"
              onClick={onOpenCreator}
              className="h-10 px-3 rounded-lg bg-[#182235] border border-[#e5a93c]/40 hover:border-[#e5a93c] text-xs font-semibold text-[#e5a93c] flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Customize</span>
            </button>
          </div>

          <button
            type="submit"
            data-start="true"
            className="w-full h-12 rounded-xl bg-[#e5a93c] hover:bg-[#f0b94d] active:scale-[0.99] text-[#0c1018] font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-transform cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Enter Realm</span>
          </button>
        </motion.form>
      </div>

      {/* Single Flat Borderless Control Hint */}
      <div className="text-center text-xs text-[#f8f5ee]/85 hud-text-stroke tracking-wide">
        WASD or Click Ground Move · 1–3 Skills · Space Dash · J Quests · Q/E Orbit · Esc Pause
      </div>
    </div>
  );
}
