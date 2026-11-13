"use client";

import { useId } from "react";
import styles from "./loader-15.module.css";

/** The supplied loader-15 motion (gooey dual stroke + soft shadow), in Mahjong Together greens.
 *  SVG filter/gradient ids are unique per instance (React useId) so several loaders never collide. */
const PATH = "m 164,100 c 0,-35.346224 -28.65378,-64 -64,-64 -35.346224,0 -64,28.653776 -64,64 0,35.34622 28.653776,64 64,64 35.34622 0 64,-26.21502 64,-64 0,-37.784981 -26.92058,-64 -64,-64 -37.079421,0 -65.267479,26.922736 -64,64 1.267479,37.07726 26.703171,65.05317 64,64 37.29683,-1.05317 64,-64 64,-64";

export function Loader15({ active = true, size = 176 }: { active?: boolean; size?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const goo = `mt-goo-${uid}`, base = `mt-grad-base-${uid}`, grad = `mt-grad-${uid}`;
  const strokes = (
    <>
      <path className={styles.halvan} d={PATH} stroke={`url(#${grad})`} />
      <circle className={styles.strecken} cx={100} cy={100} r={64} stroke={`url(#${grad})`} />
    </>
  );
  return (
    <div className={`${styles.wrap} ${active ? styles.active : styles.idle}`} style={{ width: size, height: size }} aria-hidden>
      <svg className={styles.filterDefs} focusable="false">
        <defs>
          <filter id={goo}>
            <feGaussianBlur in="SourceGraphic" stdDeviation={7} result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 20 -10" result="goo" />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
          <linearGradient id={base}>
            <stop offset={0} style={{ stopColor: "var(--brand)" }} />
            <stop offset={1} style={{ stopColor: "color-mix(in srgb, var(--brand) 55%, #ffffff)" }} />
          </linearGradient>
          <linearGradient id={grad} href={`#${base}`} gradientUnits="userSpaceOnUse" x1={40} y1={40} x2={160} y2={160} />
        </defs>
      </svg>
      <svg className={styles.svg} viewBox="0 0 200 200">
        <circle className={styles.track} cx={100} cy={100} r={64} />
        {/* completed / reduced-motion: one calm static ring */}
        <g className={styles.still}><circle className={styles.done} cx={100} cy={100} r={64} stroke={`url(#${grad})`} /></g>
        <g className={styles.moving} filter={`url(#${goo})`}>{strokes}</g>
      </svg>
      <svg className={`${styles.svg} ${styles.shadow} ${styles.moving}`} viewBox="0 0 200 200">{strokes}</svg>
    </div>
  );
}

/** One waiting ring for every "waiting for the group" moment (Random Match, End Game). The motion only says
 *  "still waiting"; the number in the middle is always the real count passed in. */
export function WaitingProgressRing({ current, total = 4, label, active }: { current: number; total?: number; label: string; active: boolean }) {
  return (
    <div className="relative h-[176px] w-[176px]" role="img" aria-label={`${current} of ${total} ${label}`}>
      <Loader15 active={active} />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[30px] leading-[36px] font-semibold text-green-text tabular-nums" aria-live="polite">{current}/{total}</span>
        <span className="t-meta text-muted">{label}</span>
      </div>
    </div>
  );
}
