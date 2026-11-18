'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Compass, ScrollText, X } from 'lucide-react';
import type { QuestCategory, QuestProgress } from '@/lib/game/types';
import { QUEST_BY_ID } from '@/lib/game/quests';

interface QuestJournalModalProps {
  open: boolean;
  quests: QuestProgress[];
  trackedQuestId: string | null;
  onClose: () => void;
  onTrackQuest: (questId: string) => void;
  onNavigateQuest: (x: number, z: number, questId: string) => void;
  onClaimQuest: (questId: string) => void;
}

const CATEGORY_TABS: { id: QuestCategory; label: string }[] = [
  { id: 'main', label: 'Main Story' },
  { id: 'side', label: 'Side Quests' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
];

export default function QuestJournalModal({
  open,
  quests,
  trackedQuestId,
  onClose,
  onTrackQuest,
  onNavigateQuest,
  onClaimQuest,
}: QuestJournalModalProps) {
  const [activeTab, setActiveTab] = useState<QuestCategory>('main');

  if (!open) return null;

  const filtered = quests.filter((q) => q.category === activeTab);

  return (
    <div
      data-testid="quest-journal-modal"
      className="fixed inset-0 z-30 bg-[#080b12]/72 flex items-center justify-center p-3 sm:p-5 pointer-events-auto"
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-2xl rounded-2xl bg-[#0d121c] border border-[#e5a93c]/35 shadow-2xl max-h-[86vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#101725]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#182235] border border-[#e5a93c]/40 flex items-center justify-center text-[#e5a93c]">
              <ScrollText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-[#f8f5ee]">
                Quest Chronicle
              </h2>
              <div className="text-xs text-[#9fb0c7] flex items-center gap-2 font-mono-num">
                <span>{quests.filter((q) => q.status === 'completed').length} Ready</span>
                <span aria-hidden="true">·</span>
                <span>{quests.filter((q) => q.status === 'active').length} Active</span>
                <span aria-hidden="true">·</span>
                <span>{quests.filter((q) => q.status === 'claimed').length} Completed</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Quest Chronicle"
            className="w-10 h-10 rounded-xl bg-[#161f30] border border-white/15 hover:border-white/35 flex items-center justify-center text-[#f8f5ee] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category Filter Tabs */}
        <div className="px-5 pt-3.5 pb-2 grid grid-cols-4 gap-1.5 bg-[#0d121c]">
          {CATEGORY_TABS.map((t) => {
            const count = quests.filter((q) => q.category === t.id && q.status !== 'claimed').length;
            const ready = quests.some((q) => q.category === t.id && q.status === 'completed');
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`h-10 px-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === t.id
                    ? 'bg-[#e5a93c] text-[#0c1018] border-[#e5a93c]'
                    : 'bg-[#121927] text-[#b8c2d4] border-white/10 hover:border-white/25'
                }`}
              >
                <span>{t.label}</span>
                {count > 0 && (
                  <span className="font-mono-num text-[11px] opacity-80">
                    ({count}{ready ? '!' : ''})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Quest List */}
        <div className="p-5 pt-2.5 space-y-3 overflow-y-auto custom-scrollbar flex-1">
          {filtered.length === 0 ? (
            <div className="rounded-xl bg-[#111827] border border-white/10 p-6 text-center text-xs text-[#9fb0c7]">
              No quests available in this category yet. Complete earlier chapters to unlock more.
            </div>
          ) : (
            filtered.map((qp) => {
              const def = QUEST_BY_ID[qp.questId];
              if (!def) return null;
              const isTracked = trackedQuestId === qp.questId;
              const pct = Math.max(0, Math.min(100, (qp.progress / Math.max(1, qp.targetCount)) * 100));

              return (
                <div
                  key={qp.questId}
                  className={`rounded-xl border p-4 transition-colors ${
                    qp.status === 'claimed'
                      ? 'bg-[#0b1019] border-white/8 opacity-65'
                      : qp.status === 'completed'
                        ? 'bg-[#15202e] border-[#34d399]/50'
                        : isTracked
                          ? 'bg-[#131b2b] border-[#e5a93c]/45'
                          : 'bg-[#111826] border-white/12'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-1.5">
                    <div>
                      <div className="text-[11px] text-[#9fb0c7] flex items-center gap-2">
                        <span className="text-[#e5a93c] font-semibold">{def.chapterLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span className="capitalize">
                          {qp.status === 'claimed'
                            ? 'Completed'
                            : qp.status === 'completed'
                              ? 'Ready to Claim'
                              : 'In Progress'}
                        </span>
                      </div>
                      <h3 className="font-display text-base font-bold text-[#f8f5ee] mt-0.5">
                        {def.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {qp.status === 'completed' && (
                        <button
                          type="button"
                          onClick={() => onClaimQuest(qp.questId)}
                          className="h-10 px-4 rounded-xl bg-[#34d399] hover:bg-[#4ade80] text-[#0c1018] font-bold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Claim Reward</span>
                        </button>
                      )}
                      {qp.status !== 'claimed' && (
                        <>
                          <button
                            type="button"
                            onClick={() => onTrackQuest(qp.questId)}
                            className={`h-10 px-3 rounded-xl border text-xs font-semibold cursor-pointer whitespace-nowrap ${
                              isTracked
                                ? 'bg-[#1d283d] border-[#e5a93c] text-[#e5a93c]'
                                : 'bg-[#151e2e] border-white/15 text-[#d7dfec] hover:border-white/35'
                            }`}
                          >
                            {isTracked ? 'Tracked' : 'Track'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onNavigateQuest(def.targetX, def.targetZ, qp.questId);
                              onClose();
                            }}
                            title="Move toward objective"
                            className="h-10 px-3 rounded-xl bg-[#151e2e] border border-white/15 hover:border-[#38bdf8] text-xs font-semibold text-[#38bdf8] flex items-center gap-1 cursor-pointer whitespace-nowrap"
                          >
                            <Compass className="w-3.5 h-3.5" />
                            <span>Guide</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-[#b8c2d4] leading-relaxed mb-3">
                    {def.description}
                  </p>

                  {/* Objective & Tabular Progress Bar */}
                  <div className="mb-2.5">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-[#f8f5ee]">{def.objectiveLabel}</span>
                      <span className="font-mono-num text-[#e5a93c] font-bold">
                        {qp.progress} / {qp.targetCount}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[#090d14] border border-white/10 overflow-hidden">
                      <div
                        className={`h-full transition-[width] duration-200 ${
                          qp.status === 'active' ? 'bg-[#e5a93c]' : 'bg-[#34d399]'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Unboxed Rewards Line */}
                  <div className="text-[11px] font-mono-num text-[#9fb0c7] flex flex-wrap items-center gap-2">
                    <span className="text-[#fde047]">+{def.reward.xp} XP</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#fbbf24]">+{def.reward.gold} Gold</span>
                    {def.reward.potions ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#34d399]">+{def.reward.potions} Flask</span>
                      </>
                    ) : null}
                    {def.reward.relic ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#c084fc]">{def.reward.relic.name}</span>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </div>
  );
}
