"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

type Values = Record<string, number>;

/**
 * Smoothly eases a set of numbers toward their targets with an exponential
 * (critically damped) approach. `snap` moves values instantly, which is used
 * while a curve is being dragged so it tracks the pointer exactly.
 */
export function useTween<T extends Values>(target: T, timeConstantMs = 85): [T, (partial: Partial<T>) => void] {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState<T>(target);
  const shownRef = useRef<T>(target);
  const targetRef = useRef<T>(target);
  const frameRef = useRef<number | null>(null);
  const lastRef = useRef(0);

  const step = useCallback(
    (now: number) => {
      const dt = Math.min(100, Math.max(0, now - lastRef.current));
      lastRef.current = now;
      const k = 1 - Math.exp(-dt / timeConstantMs);
      const goal = targetRef.current;
      const next = { ...shownRef.current };
      let moving = false;

      for (const key of Object.keys(goal) as (keyof T)[]) {
        const to = goal[key];
        const from = next[key] ?? to;
        const diff = to - from;
        const scale = Math.max(1, Math.abs(to));
        if (Math.abs(diff) < 1e-4 * scale) {
          next[key] = to;
        } else {
          next[key] = (from + diff * k) as T[keyof T];
          moving = true;
        }
      }

      shownRef.current = next;
      setShown(next);
      frameRef.current = moving ? requestAnimationFrame(step) : null;
    },
    [timeConstantMs],
  );

  useEffect(() => {
    targetRef.current = target;
    if (reduced) {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      shownRef.current = target;
      setShown(target);
      return;
    }
    if (frameRef.current == null) {
      lastRef.current = performance.now();
      frameRef.current = requestAnimationFrame(step);
    }
  }, [target, reduced, step]);

  useEffect(
    () => () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      // Reset so a remount (e.g. React Strict Mode) can start a new loop.
      frameRef.current = null;
    },
    [],
  );

  const snap = useCallback((partial: Partial<T>) => {
    shownRef.current = { ...shownRef.current, ...partial };
    setShown(shownRef.current);
  }, []);

  return [shown, snap];
}
