"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { Btn, cx } from "@/components/ui";
import { tileArt, type Face } from "@/lib/tutorial/sichuan-art";

/**
 * Optional, private knowledge check for each learning module (one visual multiple-choice question).
 * Answers stay on this device: nothing about right/wrong answers is sent to the room. Correct → continue;
 * incorrect → short reason + correct example, then Try Again or Skip for Now (never blocks the group).
 */
const S = (s: "c" | "b" | "d", n: number): Face => ({ s, n });
type Opt = { id: string; tiles?: Face[]; wall?: { long: number; short: number; double: boolean }; label: string };
type Q = { q: string; options: Opt[]; correct: string; why: string };

const QUIZ: Record<string, Q> = {
  "sc-tiles": {
    q: "Which tiles belong in Sichuan Mahjong?",
    options: [
      { id: "a", tiles: [S("c", 3), S("b", 5), S("d", 7)], label: "Characters, Bamboo, Dots" },
      { id: "b", tiles: [{ wind: "E" }, { wind: "S" }, { wind: "N" }], label: "Winds" },
      { id: "c", tiles: [{ dragon: "R" }, { dragon: "G" }, { flower: 1 }], label: "Dragons & Flowers" },
    ],
    correct: "a",
    why: "Sichuan Mahjong uses only the three suits: Characters, Bamboo and Dots, 1–9, four of each (108 tiles).",
  },
  "sc-wall": {
    q: "Which wall arrangement is correct?",
    options: [
      { id: "a", wall: { long: 18, short: 18, double: true }, label: "18 · 18 · 18 · 18 stacks of 2" },
      { id: "b", wall: { long: 14, short: 13, double: true }, label: "14 · 13 · 14 · 13 stacks of 2" },
      { id: "c", wall: { long: 14, short: 13, double: false }, label: "14 · 13 · 14 · 13 single tiles" },
    ],
    correct: "b",
    why: "Each stack holds two tiles: top and bottom walls have 14 stacks, left and right 13. (14+14+13+13) × 2 = 108.",
  },
  "sc-exchange": {
    q: "Which three tiles can be exchanged?",
    options: [
      { id: "a", tiles: [S("c", 3), S("b", 5), S("d", 7)], label: "Mixed suits" },
      { id: "b", tiles: [S("b", 2), S("b", 5), S("b", 8)], label: "All Bamboo" },
      { id: "c", tiles: [S("c", 1), S("c", 2), S("d", 3)], label: "Two suits" },
    ],
    correct: "b",
    why: "The three tiles must share a suit, but their numbers can differ.",
  },
  "sc-dingque": {
    q: "If Bamboo is your missing suit, which tiles should you discard?",
    options: [
      { id: "a", tiles: [S("c", 2), S("c", 6), S("c", 9)], label: "Characters" },
      { id: "b", tiles: [S("b", 3), S("b", 6), S("b", 9)], label: "Bamboo" },
      { id: "c", tiles: [S("d", 1), S("d", 4), S("d", 8)], label: "Dots" },
    ],
    correct: "b",
    why: "Your missing suit must be cleared: discard every Bamboo tile before you can win.",
  },
};

function TileRow({ tiles }: { tiles: Face[] }) {
  return (
    <span className="flex gap-1 justify-center" aria-hidden>
      {tiles.map((f, i) => <svg key={i} viewBox="-17 -22 34 50" className="h-11 w-auto"><g dangerouslySetInnerHTML={{ __html: tileArt(f) }} /></svg>)}
    </span>
  );
}
function WallMini({ long, short, double }: { long: number; short: number; double: boolean }) {
  // Simple diagram: one small block per stack (darker edge = a second tile underneath).
  const S2 = 120, step = (S2 - 12) / long, depth = 9;
  const blocks: React.ReactNode[] = [];
  const block = (x: number, y: number, w: number, h: number, k: string) => (
    <g key={k}>{double && <rect x={x + 1} y={y + 1.2} width={w} height={h} rx="1" fill="#1F4D1A" />}<rect x={x} y={y} width={w} height={h} rx="1" fill={double ? "#2F6E28" : "#4E8C45"} /></g>
  );
  for (let i = 0; i < long; i++) { blocks.push(block(6 + i * step, 2, step - 0.8, depth, `t${i}`)); blocks.push(block(6 + i * step, S2 - depth - 2, step - 0.8, depth, `b${i}`)); }
  const vs = (S2 - 2 * depth - 8) / short;
  for (let i = 0; i < short; i++) { blocks.push(block(2, depth + 4 + i * vs, depth, vs - 0.8, `l${i}`)); blocks.push(block(S2 - depth - 2, depth + 4 + i * vs, depth, vs - 0.8, `r${i}`)); }
  return <svg viewBox={`0 0 ${S2} ${S2}`} className="h-24 w-24" aria-hidden>{blocks}</svg>;
}

export function Quiz({ stepId, onDone, onClose }: { stepId: string; onDone: (result: "correct" | "skipped") => void; onClose: () => void }) {
  const q = QUIZ[stepId];
  const [pick, setPick] = useState<string | null>(null);
  if (!q) return null;
  const answered = pick !== null;
  const right = pick === q.correct;
  const correctOpt = q.options.find((o) => o.id === q.correct)!;
  const visual = (o: Opt) => (o.tiles ? <TileRow tiles={o.tiles} /> : o.wall ? <WallMini {...o.wall} /> : null);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal aria-label="Test My Knowledge">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-[430px] max-h-[90dvh] overflow-y-auto bg-bg rounded-t-[20px] shadow-sheet px-4 pt-4 pb-safe flex flex-col gap-4">
        <div className="flex items-start gap-2">
          <h2 className="t-page text-green-text flex-1">{q.q}</h2>
          <button onClick={onClose} aria-label="Close" className="h-10 w-10 -mr-2 rounded-full flex items-center justify-center hover:bg-surface"><X size={20} /></button>
        </div>
        <div className="grid grid-cols-1 gap-2" role="radiogroup">
          {q.options.map((o) => {
            const chosen = pick === o.id;
            return (
              <button key={o.id} type="button" role="radio" aria-checked={chosen} disabled={answered && right}
                onClick={() => setPick(o.id)}
                className={cx("w-full rounded-[16px] border p-3 flex items-center gap-3 text-left bg-card",
                  answered && chosen ? (right ? "border-green border-[1.5px] bg-green-soft" : "border-[#D92D20] border-[1.5px]") : "border-line")}>
                <span className="shrink-0 min-w-[110px] flex justify-center">{visual(o)}</span>
                <span className="t-sub font-medium flex-1">{o.label}</span>
              </button>
            );
          })}
        </div>
        {answered && right && (
          <div className="rounded-[14px] bg-green-soft p-3 flex items-center gap-2" role="status">
            <Check size={18} className="text-green-text" strokeWidth={2.5} /><span className="t-section text-green-text">Correct! Nice work.</span>
          </div>
        )}
        {answered && !right && (
          <div className="rounded-[14px] bg-surface p-3 flex flex-col gap-2" role="status">
            <span className="t-section">Not quite. Here&apos;s why.</span>
            <p className="t-sub">{q.why}</p>
            <div className="flex items-center gap-3 pt-1"><span className="t-meta text-muted">Correct:</span>{visual(correctOpt)}<span className="t-meta text-muted">{correctOpt.label}</span></div>
          </div>
        )}
        <div className="flex flex-col gap-2 mb-3">
          {answered && right && <Btn onClick={() => onDone("correct")}>Continue</Btn>}
          {answered && !right && <>
            <Btn onClick={() => setPick(null)}>Try Again</Btn>
            <Btn variant="secondary" onClick={() => onDone("skipped")}>Skip for Now</Btn>
          </>}
          {!answered && <p className="t-meta text-muted text-center">Choose one answer. Only you can see your result.</p>}
        </div>
      </div>
    </div>
  );
}
