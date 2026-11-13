"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { RotateCcw } from "lucide-react";
import { CSS_PALETTE, buildArtScene, posAt, scaleAt, visibleAt } from "@/lib/tutorial/sichuan-art";
import { tutorialMotion as M } from "@/lib/tutorial/motion";

/**
 * Plays one Sichuan instructional scene (lib/tutorial/sichuan-art.ts) with the shared motion template:
 * initial 400ms → highlight → action(s) 650–900ms → final state held → Replay.
 * Starts once when visible; never restarts on polling (scene memoised by id + direction).
 * prefers-reduced-motion: shows the final state immediately. Transform/opacity only.
 */
export function ArtVisual({ id, dir, replay = true, className }: { id: string; dir?: string; replay?: boolean; className?: string }) {
  const reduce = useReducedMotion();
  const scene = useMemo(() => buildArtScene(id, CSS_PALETTE, dir || "counterclockwise"), [id, dir]);
  const last = scene ? scene.phases - 1 : 0;
  const animated = !!scene && scene.phases > 1;
  const [phase, setPhase] = useState(animated ? 0 : last);
  const [run, setRun] = useState(0);
  const [seen, setSeen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || seen || !animated) return;
    if (typeof IntersectionObserver === "undefined") { setSeen(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect(); } }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, [seen, animated]);

  useEffect(() => {
    if (!scene) return;
    if (reduce || !animated) { setPhase(last); return; }
    if (!seen) { setPhase(0); return; }
    setPhase(0);
    const timers: number[] = [];
    let t = M.stage.initial;
    timers.push(window.setTimeout(() => setPhase(1), t));
    t += M.stage.highlight + M.duration.feedback;
    for (let p = 2; p <= last; p++) {
      const at = t;
      timers.push(window.setTimeout(() => setPhase(p), at));
      t += (scene.long?.includes(p) ? M.duration.tileSequence : M.duration.tileMove) + M.duration.pauseBetweenSteps;
    }
    return () => timers.forEach(clearTimeout);
  }, [scene, run, seen, reduce, last, animated]);

  if (!scene) return null;
  const dur = reduce ? 0 : phase <= 1 ? M.duration.feedback : scene.long?.includes(phase) ? M.duration.tileSequence : M.duration.tileMove;
  const tr = `transform ${dur}ms ${M.easing.standard}, opacity ${reduce ? 0 : M.duration.transition}ms ${M.easing.standard}`;

  return (
    <div ref={ref} className={"relative w-full select-none " + (className || "")} data-scene={scene.id} data-phase={phase}>
      <svg viewBox={`0 0 ${scene.w} ${scene.h}`} className="w-full h-auto block" role="img" aria-label={scene.title}>
        <title>{scene.title}</title>
        {scene.items.map((it) => {
          const [x, y] = posAt(it, phase);
          const op = visibleAt(it, phase) ? (it.dim?.includes(phase) ? M.opacity.inactive : 1) : 0;
          return (
            <g key={it.id} style={{ transform: `translate(${x}px, ${y}px) scale(${scaleAt(it, phase)})`, opacity: op, transition: tr }}>
              <g dangerouslySetInnerHTML={{ __html: it.art }} />
            </g>
          );
        })}
      </svg>
      {animated && replay && !reduce && (
        <button type="button" onClick={() => { setSeen(true); setRun((n) => n + 1); }} aria-label="Replay animation" title="Replay"
          className="absolute top-0 right-0 h-10 w-10 rounded-full bg-bg/90 border border-line flex items-center justify-center text-muted hover:text-ink">
          <RotateCcw size={15} strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}
