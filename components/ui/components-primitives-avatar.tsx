"use client";

import { useEffect, useId, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * User-supplied green AI orb ("components-primitives-avatar"), kept close to the original. Narrow adaptations:
 *  - `blinkKey`: every change triggers an immediate one-shot blink of BOTH eyes (independent of the ambient 3.6 s blink).
 *  - `decorative`: hides the orb from assistive tech when it sits inside a labelled <button> (no nested role="img").
 *  - softer outer shadow on the green preset (natural, not a neon halo); the press animation is a gentle squeeze.
 *  - prefers-reduced-motion: no ambient blinking and no press squeeze (the click blink stays, it is brief).
 */
export type AvatarColor = "blue" | "orange" | "red" | "green" | "purple" | "yellow" | "cyan" | "pink" | "indigo" | "lime" | "turquoise" | "violet";
export type AvatarSize = "sm" | "md" | "lg";
export type AvatarShape = "circle" | "square" | "squircle";

export interface AvatarProps {
  blinking?: boolean;
  color?: AvatarColor;
  size?: AvatarSize;
  shape?: AvatarShape;
  className?: string;
  /** Change this value to make the eyes blink once right now. */
  blinkKey?: number;
  /** Decorative inside an interactive parent (the parent carries the accessible name). */
  decorative?: boolean;
}

const BLINK_KEYFRAMES = `
@keyframes av-blink {
  0%, 88%, 100% { transform: scaleY(1); }
  93%            { transform: scaleY(0.07); }
  97%            { transform: scaleY(0.07); }
}
@keyframes av-blink-once {
  0%, 100% { transform: scaleY(1); }
  35%, 65% { transform: scaleY(0.07); }
}
`;
const SHINE = "radial-gradient(ellipse at 30% 24%, rgba(255,255,255,.75) 0%, rgba(255,255,255,.1) 50%, transparent 70%)";
const GLOW = (rgb: string) => `0 0 4px 0px rgba(${rgb},.35), 0 0 16px 6px rgba(${rgb},.18), inset 0 0 0 1px rgba(255,255,255,.05)`;
const PRESETS: Record<AvatarColor, { gradient: string; boxShadow: string; iris: string; shine: string }> = {
  blue: { gradient: "radial-gradient(circle at 50% 45%, #0d4d9a 0%, #3d7dd8 40%, #6fb3ff 68%, #e0eeff 100%)", boxShadow: GLOW("20,102,216"), iris: "linear-gradient(135deg, #ffffff 0%, #d4ecff 100%)", shine: SHINE },
  orange: { gradient: "radial-gradient(circle at 50% 45%, #a63e10 0%, #e27a2a 40%, #ffb46a 68%, #ffe8cc 100%)", boxShadow: GLOW("232,100,0"), iris: "linear-gradient(135deg, #ffffff 0%, #ffd9b8 100%)", shine: SHINE },
  red: { gradient: "radial-gradient(circle at 50% 45%, #a60033 0%, #e74668 40%, #ff8aaa 68%, #ffd6e8 100%)", boxShadow: GLOW("223,24,92"), iris: "linear-gradient(135deg, #ffffff 0%, #ffcde4 100%)", shine: SHINE },
  // green: same gradient/iris/shine as supplied; the outer glow is toned down to a natural edge + tiny lift
  green: { gradient: "radial-gradient(circle at 50% 45%, #0d6632 0%, #2a9d5f 40%, #6dd187 68%, #d1fadd 100%)", boxShadow: "0 1px 2px rgba(13,102,50,.28), 0 0 0 1px rgba(13,102,50,.10), inset 0 0 0 1px rgba(255,255,255,.06)", iris: "linear-gradient(135deg, #ffffff 0%, #c5f5d8 100%)", shine: SHINE },
  purple: { gradient: "radial-gradient(circle at 50% 45%, #4a0080 0%, #8b3fd1 40%, #c896ff 68%, #e8d4ff 100%)", boxShadow: GLOW("110,46,224"), iris: "linear-gradient(135deg, #ffffff 0%, #e0c9ff 100%)", shine: SHINE },
  yellow: { gradient: "radial-gradient(circle at 50% 45%, #8a5500 0%, #d4a000 40%, #ffc93a 68%, #fff5cc 100%)", boxShadow: GLOW("214,142,0"), iris: "linear-gradient(135deg, #ffffff 0%, #fff0a8 100%)", shine: SHINE },
  cyan: { gradient: "radial-gradient(circle at 50% 45%, #003d66 0%, #0a8fb5 40%, #5dd4ff 68%, #cdf5ff 100%)", boxShadow: GLOW("10,143,181"), iris: "linear-gradient(135deg, #ffffff 0%, #d0f0ff 100%)", shine: SHINE },
  pink: { gradient: "radial-gradient(circle at 50% 45%, #7a0055 0%, #d63384 40%, #ff6bb3 68%, #ffe5f5 100%)", boxShadow: GLOW("214,51,132"), iris: "linear-gradient(135deg, #ffffff 0%, #ffd6ed 100%)", shine: SHINE },
  indigo: { gradient: "radial-gradient(circle at 50% 45%, #2d157a 0%, #4f46e5 40%, #8b7eff 68%, #ddd6ff 100%)", boxShadow: GLOW("79,70,229"), iris: "linear-gradient(135deg, #ffffff 0%, #e0d9ff 100%)", shine: SHINE },
  lime: { gradient: "radial-gradient(circle at 50% 45%, #4a5910 0%, #84cc16 40%, #bef264 68%, #ecfccf 100%)", boxShadow: GLOW("132,204,22"), iris: "linear-gradient(135deg, #ffffff 0%, #f7fee8 100%)", shine: SHINE },
  turquoise: { gradient: "radial-gradient(circle at 50% 45%, #1a5555 0%, #0d9488 40%, #2dd4bf 68%, #ccfbf1 100%)", boxShadow: GLOW("13,148,136"), iris: "linear-gradient(135deg, #ffffff 0%, #c0fdf5 100%)", shine: SHINE },
  violet: { gradient: "radial-gradient(circle at 50% 45%, #4a2a7a 0%, #a855f7 40%, #d8b4fe 68%, #f3e8ff 100%)", boxShadow: GLOW("168,85,247"), iris: "linear-gradient(135deg, #ffffff 0%, #ede9fe 100%)", shine: SHINE },
};

const SIZE: Record<AvatarSize, { orb: string; eye: string; eyeGap: string; eyeY: string }> = {
  sm: { orb: "size-8", eye: "w-1 h-1.5", eyeGap: "gap-1.5", eyeY: "-translate-y-0.5" },
  md: { orb: "size-12", eye: "w-1.5 h-2.5", eyeGap: "gap-2.5", eyeY: "-translate-y-0.5" },
  lg: { orb: "size-16", eye: "w-2 h-3", eyeGap: "gap-3.5", eyeY: "-translate-y-1" },
};
const SHAPE_RADIUS: Record<AvatarShape, string> = { circle: "rounded-full", square: "rounded-[0%]", squircle: "rounded-[40%]" };

function Eye({ blinking, blinkNow, delayMs = 0, irisGradient, sizeClass }: { blinking: boolean; blinkNow: boolean; delayMs?: number; irisGradient: string; sizeClass: string }) {
  return (
    <div
      data-eye
      data-blinking-now={blinkNow ? "" : undefined}
      className={["rounded-full", sizeClass].filter(Boolean).join(" ")}
      style={{
        background: irisGradient,
        ...(blinkNow ? { animation: `av-blink-once 240ms ease-in-out ${delayMs / 3}ms 1` } : blinking ? { animation: `av-blink 3.6s ease-in-out ${delayMs}ms infinite` } : {}),
      }}
    />
  );
}

function Avatar({ blinking = true, color = "blue", size = "md", shape = "circle", className = "", blinkKey, decorative = false }: AvatarProps) {
  const uid = useId();
  const reduce = useReducedMotion();
  const noiseId = `av-n${uid.replace(/\W/g, "")}`;
  const preset = PRESETS[color] ?? PRESETS.blue;
  const dims = SIZE[size] ?? SIZE.md;
  const [blinkNow, setBlinkNow] = useState(false);
  useEffect(() => {
    if (!blinkKey) return;
    setBlinkNow(true);
    const t = setTimeout(() => setBlinkNow(false), 300);
    return () => clearTimeout(t);
  }, [blinkKey]);

  return (
    <>
      <style>{BLINK_KEYFRAMES}</style>
      <motion.div
        {...(decorative ? { "aria-hidden": true } : { "aria-label": "AI Avatar", role: "img" })}
        whileTap={reduce ? undefined : { scale: 0.94 }}
        transition={{ type: "tween", duration: 0.18, ease: [0.34, 1.56, 0.64, 1] }}
        className={["relative flex cursor-pointer items-center justify-center overflow-hidden", dims.orb, SHAPE_RADIUS[shape], className].filter(Boolean).join(" ")}
        style={{ background: preset.gradient, boxShadow: preset.boxShadow }}
      >
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.2] mix-blend-overlay" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id={noiseId} x="0%" y="0%" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="4" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
          </defs>
          <rect width="100%" height="100%" filter={`url(#${noiseId})`} />
        </svg>
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.2] mix-blend-overlay" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id={`grain-${uid.replace(/\W/g, "")}`} x="0%" y="0%" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="3.2" numOctaves="1" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
          </defs>
          <rect width="100%" height="100%" filter={`url(#grain-${uid.replace(/\W/g, "")})`} />
        </svg>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: preset.shine }} />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 blur-xs" style={{ background: "radial-gradient(circle at 62% 68%, rgba(0,0,0,0.18) 0%, transparent 55%)" }} />
        <div className={["relative z-10 flex items-center", dims.eyeGap, dims.eyeY].join(" ")}>
          <Eye blinking={blinking && !reduce} blinkNow={blinkNow} delayMs={0} irisGradient={preset.iris} sizeClass={dims.eye} />
          <Eye blinking={blinking && !reduce} blinkNow={blinkNow} delayMs={60} irisGradient={preset.iris} sizeClass={dims.eye} />
        </div>
      </motion.div>
    </>
  );
}

export default Avatar;
