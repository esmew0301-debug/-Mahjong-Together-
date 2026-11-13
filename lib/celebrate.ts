"use client";

import type { RefObject } from "react";
import type { ConfettiRef } from "@/components/ui/confetti";
import { BRAND_GREEN } from "./brand";

/**
 * Shared confetti timing for the existing Confetti component (canvas-confetti). Call from an effect and return
 * the cleanup. Bursts are scheduled with timers; `onStart` runs only when the first burst ACTUALLY fires, so a
 * React Strict Mode mount→cleanup→mount (development) or an early unmount never marks a celebration as "done"
 * without it being shown. Cleanup cancels pending bursts (no loops, nothing left running after navigation).
 */
export const CONFETTI_COLORS = [BRAND_GREEN, "#FFD60A", "#FF9F0A", "#0A84FF", "#FF2D55", "#AF52DE"];

function count() {
  try { const el = document.documentElement; el.dataset.confetti = String(Number(el.dataset.confetti || 0) + 1); } catch {}
}

/** Gentle fall from the top of the screen: a few small bursts over ~2s. */
export function gentleConfetti(ref: RefObject<ConfettiRef>, opts: { delay?: number; bursts?: number; onStart?: () => void } = {}) {
  const timers: number[] = [];
  const n = opts.bursts ?? 6;
  for (let i = 0; i < n; i++)
    timers.push(window.setTimeout(() => {
      if (i === 0) { opts.onStart?.(); count(); }
      ref.current?.fire({
        particleCount: 14, angle: 270, spread: 70, startVelocity: 4, gravity: 0.55, drift: (Math.random() - 0.5) * 0.6, ticks: 320, scalar: 0.9,
        origin: { x: 0.1 + Math.random() * 0.8, y: -0.05 }, colors: CONFETTI_COLORS,
      });
    }, (opts.delay ?? 0) + i * 380));
  return () => timers.forEach(clearTimeout);
}

/** The existing small declaration accent: two light bursts. */
export function smallConfetti(ref: RefObject<ConfettiRef>, onStart?: () => void) {
  const fire = (x: number) => ref.current?.fire({ particleCount: 18, angle: 270, spread: 70, startVelocity: 5, gravity: 0.8, ticks: 140, scalar: 0.8, origin: { x, y: -0.05 }, colors: CONFETTI_COLORS });
  const t1 = window.setTimeout(() => { onStart?.(); count(); fire(0.35); }, 0);
  const t2 = window.setTimeout(() => fire(0.65), 250);
  return () => { clearTimeout(t1); clearTimeout(t2); };
}

export const seenKey = (store: "local" | "session", key: string) => {
  try { return (store === "local" ? localStorage : sessionStorage).getItem(key) === "1"; } catch { return false; }
};
export const markKey = (store: "local" | "session", key: string) => {
  try { (store === "local" ? localStorage : sessionStorage).setItem(key, "1"); } catch {}
};
