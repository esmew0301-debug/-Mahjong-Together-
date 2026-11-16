"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import type { PublicPlayer, SocialItem } from "@/lib/types";
import { EMOJI_FONT, emojiFor } from "./avatar";

/**
 * Live "danmaku" layer: new table messages and emoji reactions drift right → left across the upper table.
 * - pointer-events: none — never blocks tiles, claim buttons or dialogs.
 * - 3 lanes, at most 4 visible; extra messages wait in a short queue (only the ANIMATION can be skipped,
 *   the message itself always stays in Table Chat history).
 * - Items come only from the shared room state, keyed by their server id → each client shows each one once.
 * - Reduced motion: a static pill that fades out instead of moving.
 */
const LANES = 3, MAX = 4, DURATION = 5200, QUEUE_MAX = 8;
type Live = { id: string; lane: number; text: string; emoji: boolean; who: PublicPlayer | undefined };

export function Danmaku({ items, players }: { items: SocialItem[]; players: PublicPlayer[] }) {
  const reduce = useReducedMotion();
  const seen = useRef<Set<string> | null>(null);
  const queue = useRef<SocialItem[]>([]);
  const laneFree = useRef<number[]>(Array(LANES).fill(0));
  const [live, setLive] = useState<Live[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(800);

  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth)); ro.observe(el); setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // first render: everything already in the room is history (no replay); afterwards queue new items once
  useEffect(() => {
    if (!seen.current) { seen.current = new Set(items.map((i) => i.id)); return; }
    for (const it of items) if (!seen.current.has(it.id)) { seen.current.add(it.id); queue.current.push(it); }
    if (queue.current.length > QUEUE_MAX) queue.current = queue.current.slice(-QUEUE_MAX);
    pump();
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const liveRef = useRef<Live[]>([]);
  const timers = useRef<number[]>([]);
  useEffect(() => () => { timers.current.forEach((t) => window.clearTimeout(t)); }, []);
  const pump = () => {
    const now = Date.now();
    let changed = false;
    while (queue.current.length && liveRef.current.length < MAX) {
      // pick the lane that has been free the longest (reduces overlap when several people send at once)
      const lane = laneFree.current.indexOf(Math.min(...laneFree.current));
      const it = queue.current.shift()!;
      laneFree.current[lane] = now + 1400;
      const raw = it.text.length > 80 ? it.text.slice(0, 79) + "…" : it.text;
      liveRef.current = [...liveRef.current, { id: it.id, lane, text: it.kind === "ask" ? `asks: ${raw}` : raw, emoji: it.kind === "emoji", who: players.find((p) => p.id === it.pid) }];
      changed = true;
      timers.current.push(window.setTimeout(() => {
        liveRef.current = liveRef.current.filter((x) => x.id !== it.id);
        setLive(liveRef.current);
        pump();
      }, DURATION));
    }
    if (changed) setLive(liveRef.current);
  };

  return (
    <div ref={box} className="absolute inset-x-0 top-[24%] h-[36%] overflow-hidden pointer-events-none z-30" aria-live="polite" data-danmaku>
      {live.map((l) => (
        <div key={l.id} data-float-id={l.id}
          className={reduce ? "mt-fade" : "mt-danmaku"}
          style={{ position: "absolute", top: `${l.lane * 34}%`, left: reduce ? "50%" : "100%", ["--dist" as string]: `-${w + 420}px`, transform: reduce ? "translateX(-50%)" : undefined }}>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[rgba(255,253,247,0.92)] text-[#1c1c1e] border border-white/60 shadow-[0_2px_10px_rgba(0,0,0,0.15)] px-3 py-1 text-[13px] leading-5">
            <span style={{ ...EMOJI_FONT, fontSize: 15 }}>{emojiFor(l.who || {})}</span>
            <b className="font-semibold">{l.who?.name || "Player"}:</b>
            <span style={l.emoji ? { ...EMOJI_FONT, fontSize: 16 } : undefined}>{l.text}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
