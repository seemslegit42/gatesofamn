'use client';

import React, { useEffect, useRef } from 'react';
import type { GameLifecycleState } from '@/lib/game/types';

interface GameLoopProps {
  gameState: GameLifecycleState;
  onTick?: (dt: number, currentTime: number) => void;
  onHeartbeat?: () => void;
  heartbeatIntervalMs?: number;
  children?: React.ReactNode;
}

export default function GameLoop({
  gameState,
  onTick,
  onHeartbeat,
  heartbeatIntervalMs = 5000,
  children,
}: GameLoopProps) {
  const gameStateRef = useRef(gameState);
  const onTickRef = useRef(onTick);
  const onHeartbeatRef = useRef(onHeartbeat);
  const lastTimeRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  useEffect(() => {
    onHeartbeatRef.current = onHeartbeat;
  }, [onHeartbeat]);

  // RequestAnimationFrame Game Loop
  useEffect(() => {
    let active = true;
    lastTimeRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now();

    const loop = (time: number) => {
      if (!active) return;
      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = time;

      if (gameStateRef.current === 'playing' && onTickRef.current) {
        onTickRef.current(dt, time);
      }

      rafIdRef.current = requestAnimationFrame(loop);
    };

    if (typeof window !== 'undefined') {
      rafIdRef.current = requestAnimationFrame(loop);
    }

    return () => {
      active = false;
      if (rafIdRef.current !== null && typeof window !== 'undefined') {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  // Turso Backend Heartbeat & Sync Loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    const interval = setInterval(() => {
      if (gameStateRef.current === 'playing') {
        if (onHeartbeatRef.current) {
          onHeartbeatRef.current();
        } else if (typeof window !== 'undefined') {
          // Default Turso sync heartbeat ping to /api/world
          fetch('/api/world', { method: 'GET', cache: 'no-store' })
            .then((r) => r.json())
            .catch(() => {});
        }
      }
    }, heartbeatIntervalMs);

    heartbeatTimerRef.current = interval;

    return () => {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
      }
    };
  }, [gameState, heartbeatIntervalMs]);

  return <>{children}</>;
}
