'use client';

import React, { useRef, useState } from 'react';
import { Swords, Sparkles, Flame, Wind, FlaskConical } from 'lucide-react';
import type { SnapshotPlayer } from '@/lib/game/types';
import { CLASS_SPECS } from '@/lib/game/worldData';

interface MobileTouchControlsProps {
  player: SnapshotPlayer | null;
  onJoystickMove: (x: number, y: number) => void;
  onCastSkill: (index: 0 | 1 | 2) => void;
  onDash: () => void;
  onUsePotion: () => void;
}

export default function MobileTouchControls({
  player,
  onJoystickMove,
  onCastSkill,
  onDash,
  onUsePotion,
}: MobileTouchControlsProps) {
  const padRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });

  if (!player) return null;
  const spec = CLASS_SPECS[player.heroClass];

  const updateStick = (clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.36;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(maxR, dist);
    const angle = Math.atan2(dy, dx);
    const ox = Math.cos(angle) * clamped;
    const oy = Math.sin(angle) * clamped;
    setKnobOffset({ x: ox, y: oy });
    onJoystickMove(ox / maxR, oy / maxR);
  };

  const resetStick = () => {
    pointerIdRef.current = null;
    setKnobOffset({ x: 0, y: 0 });
    onJoystickMove(0, 0);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 flex items-end justify-between px-4 pb-4 pointer-events-none md:hidden">
      {/* Left-Thumb Virtual Analog Stick (Natural Reach Zone) */}
      <div
        ref={padRef}
        data-testid="mobile-joystick"
        onPointerDown={(e) => {
          e.stopPropagation();
          pointerIdRef.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          updateStick(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (pointerIdRef.current !== e.pointerId) return;
          updateStick(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          if (pointerIdRef.current !== e.pointerId) return;
          e.currentTarget.releasePointerCapture(e.pointerId);
          resetStick();
        }}
        onPointerCancel={resetStick}
        className="pointer-events-auto relative w-28 h-28 rounded-full bg-[#0d121c]/70 border-2 border-[#e5a93c]/35 flex items-center justify-center touch-none"
      >
        <div
          className="w-12 h-12 rounded-full bg-[#e5a93c]/90 border-2 border-[#f8f5ee]/70 shadow-lg"
          style={{
            transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
          }}
        />
      </div>

      {/* Right-Thumb Ergonomic Skill Cluster (>= 44x44px hitboxes) */}
      <div className="pointer-events-auto flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            tabIndex={-1}
            onClick={() => onUsePotion()}
            disabled={player.potions <= 0}
            aria-label="Use Potion"
            className="w-11 h-11 rounded-full bg-[#0d121c]/88 border border-[#34d399]/50 disabled:opacity-45 flex flex-col items-center justify-center text-[#34d399] active:scale-95"
          >
            <FlaskConical className="w-4 h-4" />
            <span className="font-mono-num text-[9px] font-bold leading-none mt-0.5">
              {player.potions}
            </span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={() => onDash()}
            disabled={player.dashCooldown > 0.05}
            aria-label="Dash"
            className="w-11 h-11 rounded-full bg-[#0d121c]/88 border border-[#38bdf8]/50 disabled:opacity-45 flex items-center justify-center text-[#38bdf8] active:scale-95"
          >
            <Wind className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-end gap-2">
          <button
            type="button"
            tabIndex={-1}
            onClick={() => onCastSkill(2)}
            disabled={player.cooldowns[2] > 0.05 || player.mana < spec.skills[2].manaCost}
            aria-label={spec.skills[2].name}
            className="w-12 h-12 rounded-full bg-[#0d121c]/88 border border-white/25 disabled:opacity-45 flex flex-col items-center justify-center text-[#f8f5ee] active:scale-95"
          >
            <Flame className="w-4 h-4 text-[#fb923c]" />
            <span className="font-mono-num text-[9px]">
              {player.cooldowns[2] > 0.05 ? player.cooldowns[2].toFixed(1) : '3'}
            </span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={() => onCastSkill(1)}
            disabled={player.cooldowns[1] > 0.05 || player.mana < spec.skills[1].manaCost}
            aria-label={spec.skills[1].name}
            className="w-12 h-12 rounded-full bg-[#0d121c]/88 border border-white/25 disabled:opacity-45 flex flex-col items-center justify-center text-[#f8f5ee] active:scale-95"
          >
            <Sparkles className="w-4 h-4 text-[#38bdf8]" />
            <span className="font-mono-num text-[9px]">
              {player.cooldowns[1] > 0.05 ? player.cooldowns[1].toFixed(1) : '2'}
            </span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={() => onCastSkill(0)}
            disabled={player.cooldowns[0] > 0.05}
            aria-label={spec.skills[0].name}
            className="w-14 h-14 rounded-full bg-[#e5a93c] border-2 border-[#fde047] disabled:opacity-50 flex items-center justify-center text-[#0c1018] shadow-xl active:scale-95"
          >
            <Swords className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
