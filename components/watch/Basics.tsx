"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Eye, X } from "lucide-react";
import { winInfo } from "@/lib/mj/rules";
import { RULES, SUITS_INFO } from "@/lib/watch/basics";
import { T } from "@/lib/watch/scenarios";
import { Btn, cx } from "@/components/ui";
import { EMOJI_FONT } from "@/components/s3/avatar";
import { WTile } from "./SpecTable";

const tiles = (s: string) => { const seen: Record<string, number> = {}; return s.split(" ").map((k) => T(k, (seen[k] = (seen[k] ?? -1) + 1))); };
const Row = ({ ids, w = 40, cls }: { ids: number[]; w?: number; cls?: (i: number) => string | undefined }) => (
  <span className="flex gap-[3px]">{ids.map((t, i) => <span key={t} className={cls?.(i)} style={{ width: w }}><WTile id={t} w={`${w}px`} /></span>)}</span>
);
const Felt = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cx("spec-table rounded-[24px] p-6 flex flex-col items-center justify-center gap-4 min-h-[380px] text-white", className)} style={{ ["--t" as string]: "30px" }}>{children}</div>
);

// ---------------------------------------------------------------- visuals (reused by the intro and the guide)
function SuitsVisual({ w = 36 }: { w?: number }) {
  return (
    <div className="flex flex-col gap-3 w-full items-center">
      {SUITS_INFO.map((s, k) => (
        <div key={s.s} className="flex items-center gap-3 intro-in" style={{ animationDelay: `${k * 180}ms` }}>
          <span className="w-[120px] text-right text-[15px] leading-[20px] font-semibold">{s.name} <span className="text-white/75">{s.zh}</span></span>
          <Row ids={Array.from({ length: 9 }, (_, i) => T(`${s.s}${i + 1}`))} w={w} />
        </div>
      ))}
    </div>
  );
}
function TurnVisual() {
  const hand = tiles("c2 c3 c4 b5 b6 b7 d3 d3 d6 d7 d8 c9 b1");
  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <span className="text-[14px] text-white/80">Concealed hand (only this player sees it)</span>
      <div className="flex items-end gap-2">
        <Row ids={hand} w={34} cls={(i) => (i === 12 ? "intro-discard" : undefined)} />
        <span className="intro-draw" style={{ width: 34 }}><WTile id={T("d9")} w="34px" /></span>
      </div>
      <span className="text-[14px] text-white/80">Draw one → discard one</span>
      <div className="rounded-[14px] border border-white/25 bg-black/15 px-6 py-3 min-w-[260px] text-center mt-6">
        <span className="text-[14px] text-white/80">Discards: face up, everyone sees them</span>
      </div>
    </div>
  );
}
function GoalVisual() {
  const groups = [tiles("b3 b4 b5"), tiles("d6 d6 d6"), tiles("c1 c2 c3"), tiles("d7 d8 d9"), tiles("c9 c9")];
  const labels = ["Sequence", "Triplet", "Sequence", "Sequence", "Pair"];
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-end">
        {groups.map((g, k) => (
          <span key={k} className={cx("flex flex-col items-center gap-1.5", k < 4 && "intro-gap")}>
            <Row ids={g} w={32} />
            <span className="text-[14px] text-white/85">{labels[k]}</span>
          </span>
        ))}
      </div>
      <span className="text-[15px] font-semibold">4 sets of three + 1 pair = Hu 胡</span>
    </div>
  );
}
function DingQueVisual() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-6">
        {SUITS_INFO.map((s) => (
          <div key={s.s} className="flex flex-col items-center gap-2">
            <span className={cx(s.s === "b" && "intro-fade")}><Row ids={[T(`${s.s}2`), T(`${s.s}5`), T(`${s.s}8`)]} w={34} /></span>
            <span className={cx("text-[15px] font-semibold", s.s === "b" && "text-[#ffd166]")}>{s.name}{s.s === "b" ? " · missing suit" : ""}</span>
          </div>
        ))}
      </div>
      <span className="text-[14px] text-white/85">Example: Bamboo chosen. Every Bamboo tile must be discarded before winning.</span>
    </div>
  );
}
function SpectatorVisual() {
  const seats = [["❤️", "Xinyi"], ["🐶", "Xintong"], ["😊", "Esme"], ["🐻", "Frank"]];
  const hand = tiles("c2 c3 c4 b5 b6 d7 d8");
  return (
    <div className="grid gap-2 items-center justify-items-center" style={{ gridTemplateColumns: "auto auto auto", gridTemplateRows: "auto auto auto" }}>
      {[[1, 2], [2, 1], [2, 3], [3, 2]].map(([r, c], k) => (
        <div key={k} className="flex flex-col items-center gap-1" style={{ gridRow: r, gridColumn: c }}>
          <span className="text-[14px] font-semibold"><span style={EMOJI_FONT}>{seats[k][0]}</span> {seats[k][1]}</span>
          <Row ids={hand.map((t) => t + ((k + 1) % 4))} w={22} />
        </div>
      ))}
      <div style={{ gridRow: 2, gridColumn: 2 }} className="rounded-[12px] bg-black/25 px-3 py-2 flex items-center gap-2">
        <span className="intro-in" style={{ width: 26 }}><WTile id={T("b3")} w="26px" /></span><span className="text-[14px]">Discard</span>
      </div>
    </div>
  );
}

const STEPS = [
  { title: "Three Suits", body: [`${SUITS_INFO.map((s) => `${s.name} (${s.zh})`).join(", ")}: each numbered 1 to 9.`, "There are four copies of every tile."], visual: <SuitsVisual /> },
  { title: "Draw, Discard, Win", body: [RULES.hand, RULES.discard, RULES.goal, RULES.hu], visual: <div className="flex flex-col gap-8 items-center"><TurnVisual /><GoalVisual /></div> },
  { title: "Ding Que: Drop One Suit", body: ["Each player chooses one suit to eliminate.", "Those tiles must be discarded before you can win, and the winning hand can't contain that suit."], visual: <DingQueVisual /> },
  { title: "You're Watching From a Special Learning Perspective", body: ["You can see all four players' hands. The players only see their own hand and the public tiles.", "Click any discard or move to inspect it and ask about it."], visual: <SpectatorVisual /> },
];

/** Short pre-watch introduction (once per spectator; never mandatory to answer the check correctly). */
export function Intro({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<"a" | "b" | null>(null);
  const handA = tiles("b1 b2 b3 b4 b5 b6 d2 d3 d4 d7 d7 d7 d6 d6"), handB = tiles("b1 b2 b4 b5 b6 b7 c7 c8 c9 c2 c3 c4 c6 c6");
  const okA = winInfo(handA, [], "c").ok, okB = winInfo(handB, [], "d").ok;
  const right = pick && ((pick === "a" && okA) || (pick === "b" && okB));
  const last = i === STEPS.length;
  return (
    <div className="h-full overflow-y-auto" data-intro>
      <div className="max-w-[1240px] mx-auto px-6 py-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <p className="t-sub font-semibold text-green-text">Mahjong Basics · before you watch</p>
          <span className="flex gap-1.5 ml-auto" aria-hidden>{[...STEPS, 0].map((_, k) => <span key={k} className={cx("h-2 w-10 rounded-full", k <= i ? "bg-green" : "bg-line")} />)}</span>
          <button onClick={onDone} className="t-sub text-muted min-h-11 px-2 hover:underline">Skip to the game</button>
        </div>
        {!last ? (
          <div key={i} className="grid grid-cols-[minmax(0,1.35fr)_minmax(320px,1fr)] gap-8 items-center intro-in">
            <Felt>{STEPS[i].visual}</Felt>
            <div className="flex flex-col gap-4">
              <span className="t-sub text-muted">{i + 1} of {STEPS.length}</span>
              <h1 className="text-[30px] leading-[38px] font-semibold text-green-text">{STEPS[i].title}</h1>
              <ul className="flex flex-col gap-2">{STEPS[i].body.map((b) => <li key={b} className="text-[17px] leading-[26px]">{b}</li>)}</ul>
              {i === 1 && <p className="t-sub text-muted">{RULES.huRule}</p>}
              {i === 3 && <ul className="grid grid-cols-1 gap-1">{RULES.spectatorDo.map((d) => <li key={d} className="t-sub inline-flex items-center gap-2"><Check size={14} className="text-green-text" />{d}</li>)}</ul>}
              <div className="flex gap-3 mt-2">
                {i > 0 && <Btn variant="secondary" className="bg-card" onClick={() => setI(i - 1)}><ArrowLeft size={16} /> Back</Btn>}
                <Btn className="min-w-[160px]" onClick={() => setI(i + 1)}>Next <ArrowRight size={16} /></Btn>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(320px,1fr)] gap-8 items-start intro-in" data-intro-check>
            <section className="rounded-[24px] border border-line bg-card p-6 flex flex-col gap-4">
              <p className="t-sub text-muted">Optional quick check</p>
              <h2 className="text-[22px] leading-[30px] font-semibold">Which hand follows four sets and a pair?</h2>
              {([["a", handA, "Missing suit: Characters"], ["b", handB, "Missing suit: Dots"]] as const).map(([id, h, note]) => (
                <button key={id} onClick={() => setPick(id)} disabled={!!pick} aria-pressed={pick === id}
                  className={cx("rounded-[16px] border-[1.5px] p-3 flex flex-col gap-2 items-start text-left", pick === id ? (right ? "border-green bg-green-soft" : "border-[#D92D20] bg-[#FEF3F2] dark:bg-[#3a1512]") : "border-line hover:bg-hover")}>
                  <span className="t-section">Hand {id.toUpperCase()} <span className="t-sub text-muted font-normal">· {note}</span></span>
                  <Row ids={[...h]} w={34} />
                </button>
              ))}
              {pick && <div className={cx("rounded-[14px] p-3 mt-pop", right ? "bg-green-soft" : "bg-surface border border-line")} role="status">
                <p className="t-section">{right ? "Correct!" : "Not quite."}</p>
                <p className="t-body">Hand A is Bamboo 1-2-3, Bamboo 4-5-6, Dots 2-3-4, Dots 7-7-7 and the pair Dots 6-6. In Hand B, Bamboo 1, 2 and 7 don&apos;t form a set yet.</p>
              </div>}
            </section>
            <section className="rounded-[24px] border border-green bg-card p-8 flex flex-col gap-4 items-start">
              <Eye size={30} className="text-green-text" />
              <h1 className="text-[30px] leading-[38px] font-semibold text-green-text">Ready to Watch?</h1>
              <p className="t-body">You&apos;ll see a real game with every hand visible. Click any move to ask about it. The <b>?</b> button opens the full guide anytime.</p>
              <div className="flex gap-3">
                <Btn variant="secondary" className="bg-card" onClick={() => setI(i - 1)}><ArrowLeft size={16} /> Back</Btn>
                <Btn className="min-w-[260px]" onClick={onDone}><Check size={18} /> I Understand — Start Watching</Btn>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

/** Detailed reference ("?"): an overlay, so the live game keeps running underneath. */
export function Guide({ onClose }: { onClose: () => void }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const Sec = ({ h, children }: { h: string; children: React.ReactNode }) => <section className="flex flex-col gap-2"><h3 className="t-section text-green-text">{h}</h3>{children}</section>;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" role="dialog" aria-modal aria-label="Mahjong Guide" data-guide>
      <div className="absolute inset-0 bg-black/35" onClick={onClose} />
      <div className="relative w-full max-w-[980px] max-h-[88dvh] overflow-y-auto rounded-[24px] bg-card shadow-sheet p-7 flex flex-col gap-6 mt-pop">
        <div className="flex items-center"><h2 className="text-[24px] leading-[32px] font-semibold flex-1">Mahjong Guide</h2>
          <button onClick={onClose} aria-label="Close" className="h-11 w-11 -mr-2 rounded-full flex items-center justify-center hover:bg-hover"><X size={20} /></button></div>
        <Felt className="min-h-0 py-5"><SuitsVisual w={32} /></Felt>
        <div className="grid grid-cols-2 gap-x-8 gap-y-5">
          <Sec h="Tiles"><p className="t-body">{RULES.tiles}</p></Sec>
          <Sec h="Draw and discard"><p className="t-body">{RULES.hand} {RULES.discard}</p></Sec>
          <Sec h="Sets and pairs"><p className="t-body">{RULES.sequence}<br />{RULES.triplet}<br />{RULES.pair}</p>
            <span className="flex gap-4 flex-wrap"><Row ids={tiles("b3 b4 b5")} w={30} /><Row ids={tiles("d6 d6 d6")} w={30} /><Row ids={tiles("c9 c9")} w={30} /></span></Sec>
          <Sec h="Winning (Hu)"><p className="t-body">{RULES.goal} {RULES.hu} {RULES.huRule}</p></Sec>
          <Sec h="Exchange Three Tiles"><p className="t-body">{RULES.exchange}</p><Row ids={tiles("d1 d4 d9")} w={30} /></Sec>
          <Sec h="Ding Que (missing suit)"><p className="t-body">{RULES.dingque}</p></Sec>
          <Sec h="Pung, Kong, Hu"><p className="t-body">{RULES.pung} {RULES.kong} {RULES.hu}</p></Sec>
          <Sec h="Concealed vs public"><p className="t-body">{RULES.concealed} {RULES.meld} {RULES.discard}</p></Sec>
          <Sec h="Your spectator view"><p className="t-body">{RULES.spectator}</p></Sec>
          <Sec h="Asking questions"><p className="t-body">{RULES.ask} Players never see spectator questions.</p></Sec>
        </div>
        <Btn className="self-end min-w-[160px]" onClick={onClose}>Back to the Game</Btn>
      </div>
    </div>
  );
}
