'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X, Trophy, ShieldCheck, Play, RotateCcw, Home } from 'lucide-react';
import type { GameLifecycleState, InventoryItem, SnapshotPlayer } from '@/lib/game/types';

interface LeaderboardRow {
  id: string;
  name: string;
  heroClass: string;
  level: number;
  kills: number;
  gold: number;
}

interface GameModalsProps {
  gameState: GameLifecycleState;
  player: SnapshotPlayer | null;
  inventory: InventoryItem[];
  inventoryOpen: boolean;
  onCloseInventory: () => void;
  onEquipItem: (itemId: string) => void;
  onResume: () => void;
  onRespawn: () => void;
  onReturnTitle: () => void;
}

export default function GameModals({
  gameState,
  player,
  inventory,
  inventoryOpen,
  onCloseInventory,
  onEquipItem,
  onResume,
  onRespawn,
  onReturnTitle,
}: GameModalsProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);

  useEffect(() => {
    if (!inventoryOpen) return;
    fetch('/api/world')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.leaderboard)) setLeaderboard(d.leaderboard);
      })
      .catch(() => {});
  }, [inventoryOpen]);

  // 1. Pause Modal
  if (gameState === 'paused') {
    return (
      <div className="fixed inset-0 z-30 bg-[#080b12]/75 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm rounded-2xl bg-[#0d121c] border border-[#e5a93c]/35 p-6 shadow-2xl text-center"
        >
          <h2 className="font-display text-2xl font-bold text-[#f8f5ee] mb-1">
            Journey Paused
          </h2>
          <p className="text-xs text-[#9fb0c7] mb-5">
            Your hero state remains synced in Solis Reach.
          </p>
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={onResume}
              className="w-full h-11 rounded-xl bg-[#e5a93c] hover:bg-[#f0b94d] text-[#0c1018] font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Resume</span>
            </button>
            <button
              type="button"
              onClick={onReturnTitle}
              className="w-full h-11 rounded-xl bg-[#161f30] border border-white/15 hover:border-white/30 text-[#f8f5ee] font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>Character Select</span>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // 2. Defeat / Respawn Modal
  if (gameState === 'gameover') {
    return (
      <div className="fixed inset-0 z-30 bg-[#080b12]/80 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md rounded-2xl bg-[#0d121c] border border-[#f43f5e]/40 p-6 shadow-2xl text-center"
        >
          <h2 className="font-display text-2xl font-bold text-[#f8f5ee] mb-1">
            Fallen in Solis Reach
          </h2>
          <p className="text-xs text-[#9fb0c7] mb-5">
            Your progress and relics are safely preserved in libSQL.
          </p>

          <div className="grid grid-cols-3 gap-2.5 mb-6">
            <div className="rounded-xl bg-[#131a28] border border-white/10 py-3 px-2">
              <div className="text-[10px] uppercase tracking-wider text-[#9fb0c7]">Level</div>
              <div className="font-mono-num text-xl font-bold text-[#e5a93c] mt-0.5">
                {player?.level ?? 1}
              </div>
            </div>
            <div className="rounded-xl bg-[#131a28] border border-white/10 py-3 px-2">
              <div className="text-[10px] uppercase tracking-wider text-[#9fb0c7]">Slain</div>
              <div className="font-mono-num text-xl font-bold text-[#f8f5ee] mt-0.5">
                {player?.kills ?? 0}
              </div>
            </div>
            <div className="rounded-xl bg-[#131a28] border border-white/10 py-3 px-2">
              <div className="text-[10px] uppercase tracking-wider text-[#9fb0c7]">Gold</div>
              <div className="font-mono-num text-xl font-bold text-[#fbbf24] mt-0.5">
                {player?.gold ?? 0}
              </div>
            </div>
          </div>

          <div className="flex gap-2.5">
            <button
              type="button"
              data-start="true"
              onClick={onRespawn}
              className="flex-1 h-12 rounded-xl bg-[#e5a93c] hover:bg-[#f0b94d] text-[#0c1018] font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Revive at Sanctuary</span>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // 3. Inventory & Realm Leaderboard Drawer
  if (inventoryOpen) {
    return (
      <div className="fixed inset-0 z-30 bg-[#080b12]/70 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl rounded-2xl bg-[#0d121c] border border-[#e5a93c]/35 p-5 sm:p-6 shadow-2xl max-h-[84vh] overflow-y-auto custom-scrollbar"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-xl font-bold text-[#f8f5ee]">
                Satchel & Realm Ledger
              </h2>
              <p className="text-xs text-[#9fb0c7]">
                Weapon Power +{player?.weaponPower ?? 0} · Charm Power +{player?.charmPower ?? 0}
              </p>
            </div>
            <button
              type="button"
              onClick={onCloseInventory}
              className="w-10 h-10 rounded-xl bg-[#161f30] border border-white/15 flex items-center justify-center text-[#f8f5ee] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Persistent Inventory */}
            <div>
              <h3 className="text-xs uppercase tracking-wider text-[#e5a93c] font-semibold mb-2 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Relics & Gear ({inventory.length})
              </h3>
              <div className="space-y-2">
                {inventory.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl bg-[#131a28] border border-white/10 px-3 py-2.5 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#f8f5ee] truncate">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-[#9fb0c7] font-mono-num">
                        +{item.power} Power · x{item.quantity} · {item.rarity}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onEquipItem(item.id)}
                      className="px-3 h-8 rounded-lg bg-[#1d283d] hover:bg-[#e5a93c] hover:text-[#0c1018] text-xs font-semibold text-[#f8f5ee] whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Equip
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Turso Global Leaderboard */}
            <div>
              <h3 className="text-xs uppercase tracking-wider text-[#38bdf8] font-semibold mb-2 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5" />
                Solis Leaderboard (libSQL)
              </h3>
              <div className="space-y-1.5">
                {leaderboard.length === 0 ? (
                  <div className="text-xs text-[#9fb0c7] py-4">Loading realm heroes...</div>
                ) : (
                  leaderboard.map((row, idx) => (
                    <div
                      key={row.id}
                      className="rounded-xl bg-[#131a28] border border-white/10 px-3 py-2 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono-num text-[#e5a93c] font-bold">
                          #{idx + 1}
                        </span>
                        <span className="font-semibold text-[#f8f5ee] truncate">
                          {row.name}
                        </span>
                        <span className="text-[#9fb0c7] capitalize">{row.heroClass}</span>
                      </div>
                      <div className="font-mono-num text-[#d7dfec] whitespace-nowrap">
                        Lv {row.level} · {row.kills} KO
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return null;
}
