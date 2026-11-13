"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { RotateCcw } from "lucide-react";
import { buildScene, type Pt, type SceneItem } from "@/lib/tutorial/scenes";
import { tutorialMotion as M } from "@/lib/tutorial/motion";
import { TileFace } from "./TileFace";

/**
 * Plays one instructional scene with the shared five-stage template:
 * initial (400ms) → highlight (200ms) → action(s) (650–900ms each) → final state held → optional Replay.
 * - Starts once when it first becomes visible; never restarts on polling/re-render (scene is memoised by id).
 * - prefers-reduced-motion: shows the final state immediately (arrows and labels keep the meaning), no motion.
 * - Uses transform/opacity only; timers are cleared on unmount.
 */
export function TutorialVisual({ sceneId, decisions = {}, compact = false }: { sceneId: string; decisions?: Record<string, string>; compact?: boolean }) {
  const reduce = useReducedMotion();
  const dir = decisions.exchangeDir || "";
  const scene = useMemo(() => buildScene(sceneId, { exchangeDir: dir }), [sceneId, dir]);
  const last = scene ? scene.phases - 1 : 0;
  const [phase, setPhase] = useState(0);
  const [run, setRun] = useState(0);
  const [seen, setSeen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") { setSeen(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);

  useEffect(() => {
    if (!scene) return;
    if (reduce) { setPhase(last); return; }
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
  }, [scene, run, seen, reduce, last]);

  if (!scene) return null;
  const durFor = (p: number) => (reduce ? 0 : p <= 1 ? M.duration.feedback : scene.long?.includes(p) ? M.duration.tileSequence : M.duration.tileMove);
  const pos = (it: SceneItem): Pt => (Array.isArray(it.at[0]) ? (it.at as Pt[])[Math.min(phase, (it.at as Pt[]).length - 1)] : (it.at as Pt));
  const visible = (it: SceneItem) => phase >= (it.show ?? 0) && (it.hide === undefined || phase < it.hide);
  const tr = (d: number) => `transform ${d}ms ${M.easing.standard}, opacity ${reduce ? 0 : M.duration.feedback}ms ${M.easing.standard}`;
  const toneFill = (tone?: string) => (tone === "brand" ? "var(--brand-text)" : tone === "ink" ? "var(--fg)" : "var(--muted)");

  return (
    <div ref={ref} className="relative w-full select-none" data-scene={scene.id} data-phase={phase}>
      <svg viewBox={`0 0 ${scene.w} ${scene.h}`} className={compact ? "w-full max-w-[360px] h-auto" : "w-full h-auto"} role="img" aria-label={scene.title}>
        <title>{scene.title}</title>
        <defs>
          <marker id={`ah-${scene.id}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="var(--brand)" />
          </marker>
          <marker id={`ahi-${scene.id}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="var(--fg)" />
          </marker>
        </defs>
        {scene.items.map((it) => {
          const [x, y] = pos(it);
          const hl = !!it.hl?.includes(phase);
          const dim = !!it.dim?.includes(phase);
          const op = visible(it) ? (dim ? M.opacity.inactive : 1) : 0;
          const d = durFor(phase);
          if (it.kind === "zone") {
            const isTable = it.id === "table";
            return (
              <rect key={it.id} x={x} y={y} width={it.w} height={it.h} rx={isTable ? 14 : it.h && it.h < 14 ? 4 : 10}
                fill={isTable ? "var(--surface)" : it.h && it.h < 14 ? "var(--line)" : "none"}
                stroke={hl ? "var(--brand)" : "var(--line)"} strokeWidth={hl ? 2 : 1.2} strokeDasharray={!isTable && !(it.h && it.h < 14) ? "5 4" : undefined}
                style={{ opacity: op, transition: tr(d) }} />
            );
          }
          if (it.kind === "arrow")
            return (
              <path key={it.id} d={it.path} fill="none" stroke={it.tone === "ink" ? "var(--fg)" : "var(--brand)"} strokeWidth="2" strokeLinecap="round"
                markerEnd={`url(#${it.tone === "ink" ? "ahi" : "ah"}-${scene.id})`} style={{ opacity: op, transition: tr(d) }} />
            );
          if (it.kind === "seat") {
            // The circle always shows the seat letter (A/B/C/D); a role or wind name sits beside it.
            const seat = it.id.replace("seat-", "");
            const name = it.text && it.text !== seat ? it.text : "";
            const side = seat === "A" || seat === "C";
            return (
              <g key={it.id} style={{ transform: `translate(${x}px, ${y}px) scale(${hl ? M.scale.emphasis : 1})`, transition: tr(d), opacity: op }}>
                <circle r="14" fill={hl ? "var(--brand)" : "var(--bg)"} stroke={hl ? "var(--brand)" : "var(--fg)"} strokeWidth="1.5" />
                <text y="5" textAnchor="middle" fontSize="13" fontWeight="700" fill={hl ? "#FFFFFF" : "var(--fg)"}>{seat}</text>
                {name && <text x={side ? 20 : 0} y={side ? 4 : 29} textAnchor={side ? "start" : "middle"} fontSize="11" fontWeight="600" fill="var(--muted)">{name}</text>}
              </g>
            );
          }
          if (it.kind === "label")
            return (
              <text key={it.id} textAnchor={it.anchor || "middle"} fontSize={it.size || 12} fontWeight={it.weight || 400} fill={toneFill(it.tone)}
                style={{ transform: `translate(${x}px, ${y}px)`, transition: tr(d), opacity: op }}>{it.text}</text>
            );
          // tile
          const s = (it.scale ?? 1) * (hl ? M.scale.emphasis : 1);
          return (
            <g key={it.id} style={{ transform: `translate(${x}px, ${y}px) scale(${s})`, transition: tr(d), opacity: op }}>
              <TileFace t={it.tile!} faceUp={it.faceFrom === undefined || phase >= it.faceFrom} highlight={hl} />
            </g>
          );
        })}
      </svg>
      {!reduce && (
        <button type="button" onClick={() => { setSeen(true); setRun((n) => n + 1); }} aria-label="Replay animation" title="Replay"
          className="absolute top-1 right-1 h-9 w-9 rounded-full bg-bg/90 border border-line flex items-center justify-center text-muted hover:text-ink">
          <RotateCcw size={15} strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}
