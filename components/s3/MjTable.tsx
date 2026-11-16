"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, CircleHelp, Flag, MessageCircle, Smile } from "lucide-react";
import type { PublicPlayer, PublicRoom, SocialItem } from "@/lib/types";
import { Btn, cx } from "@/components/ui";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { tileArt } from "@/lib/tutorial/sichuan-art";
import { type Meld, type Suit, SUITS, SUIT_NAME, canPung, concealedKongKeys, keyName, keyOf, legalDiscards, numOf, suggestDiscard, suitOf, tileName, winInfo } from "@/lib/mj/rules";
import { EMOJI_FONT, emojiFor } from "./avatar";
import { Danmaku } from "./Danmaku";
import { Confetti, type ConfettiRef } from "@/components/ui/confetti";
import { smallConfetti } from "@/lib/celebrate";
import { useReducedMotion } from "motion/react";

type Act = (a: Record<string, unknown>) => Promise<void>;
const EMOJIS = ["❤️", "👍", "😂", "👏", "😊"];
const QUICK = ["Nice Move!", "Good Game!", "Can You Explain?", "Thanks!", "Let's Play Again!"];
const DIR_WORD: Record<string, string> = { clockwise: "to the player on your left", counterclockwise: "to the player on your right", across: "to the player across from you" };

function Tile({ id, size = 40, back, selected, hint, dim, onClick, label }: { id?: number; size?: number; back?: boolean; selected?: boolean; hint?: boolean; dim?: boolean; onClick?: () => void; label?: string }) {
  const face = back || id === undefined ? "back" : { s: suitOf(id), n: numOf(id) };
  const svg = <svg viewBox="-17 -22 34 50" style={{ width: size, height: size * 1.47 }} aria-hidden><g dangerouslySetInnerHTML={{ __html: tileArt(face as never) }} /></svg>;
  if (!onClick) return <span className={cx("inline-block", dim && "opacity-45")} title={label}>{svg}</span>;
  return (
    <button type="button" onClick={onClick} aria-label={label} aria-pressed={selected}
      className={cx("relative rounded-[8px] transition-transform duration-150 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:outline-2", selected ? "-translate-y-3" : "hover:-translate-y-1", dim && "opacity-55")}>
      {svg}
      {hint && <span className="absolute inset-[-3px] rounded-[9px] ring-2 ring-green pointer-events-none" aria-hidden />}
    </button>
  );
}

/** "You Can Pung!" style claim prompt: server-offered options only, with a tile example and a short explanation. */
const CLAIM_COPY: Record<string, { title: string; sub: string; whatT: string; what: string; n: number }> = {
  hu: { title: "You Can Win!", sub: "This discard completes your winning hand.", whatT: "What is Hu?", what: "Hu means you win: your tiles form four sets and a pair (or seven pairs) and you have no missing-suit tiles.", n: 1 },
  kong: { title: "You Can Kong!", sub: "You have three matching tiles. Claim this discard to make four of a kind.", whatT: "What is Kong?", what: "A Kong is a set of four identical tiles. After a Kong you draw a replacement tile, then discard.", n: 4 },
  pung: { title: "You Can Pung!", sub: "You have two matching tiles. Claim this discard to make a set of three.", whatT: "What is Pung?", what: "A Pung is a set of three identical tiles. You can claim another player's discard when you already have two matching tiles.", n: 3 },
};
function ClaimPanel({ opts, tile, from, left, busy, onChoose }: { opts: string[]; tile: number; from: string; left: number; busy: boolean; onChoose: (c: string) => void }) {
  const [help, setHelp] = useState(false);
  const top = opts.includes("hu") ? "hu" : opts.includes("kong") ? "kong" : "pung";
  const c = CLAIM_COPY[top];
  return (
    <div className="w-full max-w-[520px] rounded-[18px] border-[1.5px] border-green bg-green-soft p-3 flex flex-col gap-2 mt-pop" role="alertdialog" aria-label={c.title}>
      <div className="flex items-start gap-3">
        <span className="flex shrink-0">{Array.from({ length: c.n }).map((_, k) => <Tile key={k} id={tile} size={28} />)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="t-section text-green-text">{c.title}</p>
            <button onClick={() => setHelp(!help)} aria-label={c.whatT} aria-expanded={help} className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-white/60"><CircleHelp size={16} /></button>
            <span className="ml-auto t-meta text-muted tabular-nums">{left}s</span>
          </div>
          <p className="t-sub">{c.sub}</p>
          <p className="t-meta text-muted">{from} discarded {tileName(tile)}.</p>
        </div>
      </div>
      {help && <div className="rounded-[12px] bg-card p-2.5 flex items-center gap-2"><span className="flex shrink-0">{Array.from({ length: Math.max(3, c.n) }).map((_, k) => <Tile key={k} id={tile} size={18} />)}</span><div><p className="t-sub font-semibold">{c.whatT}</p><p className="t-meta">{c.what}</p></div></div>}
      <div className="flex gap-2 flex-wrap justify-end">
        {opts.includes("hu") && <Btn className="min-h-11" disabled={busy} onClick={() => onChoose("hu")}>Hu</Btn>}
        {opts.includes("kong") && <Btn className="min-h-11" variant={top === "kong" ? "primary" : "secondary"} disabled={busy} onClick={() => onChoose("kong")}>Kong</Btn>}
        {opts.includes("pung") && <Btn className="min-h-11" variant={top === "pung" ? "primary" : "secondary"} disabled={busy} onClick={() => onChoose("pung")}>Pung</Btn>}
        <Btn className="min-h-11 bg-card" variant="secondary" disabled={busy} onClick={() => onChoose("pass")}>Pass</Btn>
      </div>
    </div>
  );
}

function Seat({ p, me, turn, count, melds, discards, dq, won, bubble, pos }: { p: PublicPlayer; me: boolean; turn: boolean; count: number; melds: Meld[]; discards: number[]; dq?: Suit; won?: boolean; bubble?: string; pos: "top" | "left" | "right" | "bottom" }) {
  const vertical = pos === "left" || pos === "right";
  return (
    <div className={cx("flex items-center gap-2", vertical ? "flex-col" : "flex-row")}>
      <div className="relative">
        <span className={cx("h-12 w-12 rounded-full bg-card border-2 flex items-center justify-center transition-colors", turn ? "border-[#FFD60A] shadow-[0_0_0_4px_rgba(255,214,10,0.35)]" : "border-white/40")}>
          <span style={{ ...EMOJI_FONT, fontSize: 26, lineHeight: 1 }}>{emojiFor(p)}</span>
        </span>
      </div>
      <div className={cx("text-white min-w-0", vertical ? "text-center" : "")}>
        <div className="t-sub font-semibold truncate max-w-[120px]">{p.name}{me ? " (you)" : ""}</div>
        <div className="t-meta text-white/75">{won ? "Won 🏆" : `${count} tiles`}{dq ? ` · missing ${SUIT_NAME[dq]}` : ""}</div>
        {!me && !won && count > 0 && (
          <div className={cx("flex mt-1", vertical ? "flex-col items-center -space-y-3" : "-space-x-1.5")} aria-hidden>
            {Array.from({ length: Math.min(count, vertical ? 7 : 14) }).map((_, i) => <Tile key={i} back size={vertical ? 14 : 13} />)}
          </div>
        )}
        {melds.length > 0 && <div className="flex gap-1 mt-1">{melds.map((m, i) => <span key={i} className="flex mt-pop">{m.tiles.map((t, j) => <Tile key={j} id={m.kind === "ckong" && (j === 0 || j === 3) ? undefined : t} back={m.kind === "ckong" && (j === 0 || j === 3)} size={16} />)}</span>)}</div>}
      </div>
    </div>
  );
}

export function MjTable({ r, me, act, busy, error, openCoach, onEnd, overlays }: { r: PublicRoom; me: string; act: Act; busy: boolean; error: string | null; openCoach: () => void; onEnd: () => void; overlays?: React.ReactNode }) {
  const m = r.mj!;
  const [sel, setSel] = useState<number[]>([]);
  const [coach, setCoach] = useState(true);
  const [why, setWhy] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const reduce = useReducedMotion();
  const confettiRef = useRef<ConfettiRef>(null);
  const confettiOpts = useMemo(() => ({ resize: true, useWorker: true }), []);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [ask, setAsk] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => { try { setCoach(localStorage.getItem("mt.coach") !== "off"); } catch {} }, []);
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 500); return () => window.clearInterval(t); }, []);
  const toggleCoach = () => { const v = !coach; setCoach(v); try { localStorage.setItem("mt.coach", v ? "on" : "off"); } catch {} };

  const players = r.players;
  const byId = (id: string) => players.find((p) => p.id === id)!;
  const i = m.order.indexOf(me);
  const seatOf = { right: m.order[(i + 1) % 4], top: m.order[(i + 2) % 4], left: m.order[(i + 3) % 4] }; // next turn = your right
  const hand = m.myHand;
  const dq = m.dq[me];
  const myMelds = m.melds[me] || [];
  const myTurn = m.phase === "play" && m.turn === me && m.drew;
  const won = m.winners.some((w) => w.pid === me);
  const claim = m.myClaim && !m.myClaim.choice ? m.myClaim : null;
  const legal = useMemo(() => legalDiscards(hand, dq), [hand, dq]);
  const suggestion = useMemo(() => (myTurn ? suggestDiscard(hand, dq) : null), [myTurn, hand, dq]);
  const canHu = myTurn && winInfo(hand, myMelds, dq).ok;
  const kongKeys = myTurn ? concealedKongKeys(hand, dq) : [];
  useEffect(() => { setSel([]); setWhy(false); }, [m.phase, m.turn, hand.length]);
  const win = useMemo(() => (myTurn ? winInfo(hand, myMelds, dq) : null), [myTurn, hand, myMelds, dq]);
  // a small celebration whenever a player wins (the hand continues for the others)
  const winCount = useRef(m.winners.length);
  useEffect(() => {
    if (m.winners.length > winCount.current && !reduce) { winCount.current = m.winners.length; return smallConfetti(confettiRef); }
    winCount.current = m.winners.length;
  }, [m.winners.length, reduce]);

  const social = r.social || [];

  const tap = (t: number) => {
    if (m.phase === "exchange" && !m.myExchange) {
      setSel((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : cur.length < 3 && (cur.length === 0 || suitOf(cur[0]) === suitOf(t)) ? [...cur, t] : cur.length && suitOf(cur[0]) !== suitOf(t) ? [t] : cur));
    } else if (myTurn) setSel([t]);
  };
  const discard = () => sel[0] !== undefined && act({ type: "mj-discard", tile: sel[0] });
  const sendSocial = (kind: string, text: string) => act({ type: "social", kind, text });
  const claimLeft = m.claimUntil ? Math.max(0, Math.ceil((m.claimUntil - now) / 1000)) : 0;
  const turnName = m.turn ? byId(m.turn)?.name : null;
  const anyAI = players.some((p) => p.kind === "virtual");

  // ---- phase-specific prompt + actions
  let prompt = "";
  let actions: React.ReactNode = null;
  if (m.phase === "exchange") {
    prompt = m.myExchange ? "Waiting for everyone to choose their 3 tiles…" : `Choose 3 tiles of one suit to pass ${DIR_WORD[m.exDir]}.`;
    if (!m.myExchange) actions = <Btn disabled={busy || sel.length !== 3} onClick={() => act({ type: "mj-exchange", tiles: sel })}>Exchange These 3</Btn>;
  } else if (m.phase === "dingque") {
    prompt = dq ? "Waiting for everyone to choose a missing suit…" : "Choose your missing suit. You must discard it before you can win.";
    if (!dq) actions = <div className="flex gap-2 flex-wrap">{SUITS.map((s) => <Btn key={s} variant="secondary" className="bg-card" disabled={busy} onClick={() => act({ type: "mj-dingque", suit: s })}>{SUIT_NAME[s]}</Btn>)}</div>;
  } else if (claim) {
    prompt = `${byId(m.last!.from)?.name} discarded ${tileName(m.last!.tile)}.`;
    actions = <ClaimPanel opts={claim.opts} tile={m.last!.tile} from={byId(m.last!.from)?.name || "A player"} left={claimLeft} busy={busy} onChoose={(c) => act({ type: "mj-claim", choice: c })} />;
  } else if (myTurn) {
    prompt = dq && hand.some((t) => suitOf(t) === dq) ? `Your turn. Discard a ${SUIT_NAME[dq]} tile (your missing suit).` : "Your turn. Select a tile to discard.";
    actions = <div className="flex gap-2 flex-wrap">
      {canHu && <Btn onClick={() => act({ type: "mj-hu" })} disabled={busy}>Declare Hu</Btn>}
      {kongKeys.map((k) => <Btn key={k} variant="secondary" className="bg-card" disabled={busy} onClick={() => act({ type: "mj-kong", key: k })}>Kong {keyName(k)}</Btn>)}
      <Btn variant={canHu ? "secondary" : "primary"} className={canHu ? "bg-card" : ""} disabled={busy || sel.length !== 1} onClick={discard}>Discard{sel[0] !== undefined ? ` ${tileName(sel[0])}` : ""}</Btn>
    </div>;
  } else if (m.phase === "ended") {
    prompt = m.endReason === "wall" ? "The wall is empty. Hand over." : "Hand over.";
  } else if (won) {
    prompt = "You won this hand! Watch the others finish.";
  } else {
    prompt = m.phase === "claim" ? "Other players are deciding on the discard…" : turnName ? `${turnName}'s turn…` : "";
  }

  // ---- Coach (free, deterministic; never forces a move)
  let coachCard: React.ReactNode = <p className="t-sub text-muted">Watch the table or send an emoji while you wait.</p>;
  if (!coach) coachCard = <p className="t-sub text-muted">Coach is off. Rules are still checked for you.</p>;
  else if (m.phase === "exchange" && !m.myExchange) coachCard = <p className="t-sub">Pick three tiles from the suit you hold the fewest of — those are easiest to give away.</p>;
  else if (m.phase === "dingque" && !dq) {
    const fewest = [...SUITS].sort((a, b) => hand.filter((t) => suitOf(t) === a).length - hand.filter((t) => suitOf(t) === b).length)[0];
    coachCard = <p className="t-sub">Tip: <b>{SUIT_NAME[fewest]}</b> is the suit you hold the fewest of, so it's the easiest to clear.</p>;
  } else if (canHu) coachCard = <div className="flex flex-col gap-2"><p className="t-section text-green-text">You Can Win!</p><p className="t-sub">Your hand satisfies the selected winning pattern.</p><Btn onClick={() => act({ type: "mj-hu" })} disabled={busy}>Declare Hu</Btn></div>;
  else if (claim) coachCard = <div className="flex flex-col gap-1">
    {claim.opts.includes("hu") && <p className="t-sub"><b>Hu</b>: this tile completes your winning hand.</p>}
    {claim.opts.includes("kong") && <p className="t-sub"><b>Kong</b>: take it to make four of a kind; you then draw a replacement tile.</p>}
    {claim.opts.includes("pung") && <p className="t-sub"><b>Pung</b>: take it to make three of a kind; then you discard.</p>}
    <p className="t-meta text-muted">Pass if you'd rather keep your hand as it is.</p></div>;
  else if (suggestion) coachCard = <p className="t-sub">Your suggestion is shown above your hand — tap <b>?</b> to see why.</p>;

  const pos: Record<string, "top" | "left" | "right"> = { [seatOf.top]: "top", [seatOf.left]: "left", [seatOf.right]: "right" };
  const seat = (id: string, where: "top" | "left" | "right" | "bottom") => (
    <Seat p={byId(id)} me={id === me} turn={m.turn === id} count={id === me ? hand.length : m.handCounts[id] || 0} melds={m.melds[id] || []} discards={m.discards[id] || []}
      dq={m.phase !== "exchange" ? m.dq[id] : undefined} won={m.winners.some((w) => w.pid === id)} pos={where} />
  );
  const pile = (id: string) => (
    <div className="flex flex-wrap gap-0.5 content-start justify-center max-w-[210px]">
      {(m.discards[id] || []).map((t, k) => <Tile key={k} id={t} size={20} label={tileName(t)} />)}
    </div>
  );

  return (
    <div className="fixed inset-0 z-30 bg-page overflow-y-auto" data-mj-table>
      <div className="min-h-full flex flex-col max-w-[1400px] mx-auto px-3 lg:px-6 pb-safe">
        <header className="h-14 shrink-0 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="t-section text-green-text truncate">Mahjong Together</div>
            <div className="t-meta text-muted truncate">Hand {m.hand} · {m.wallCount} tiles left in the wall{anyAI ? " · includes simulated players" : ""}</div>
          </div>
          <button onClick={toggleCoach} role="switch" aria-checked={coach} className={cx("h-9 px-3 rounded-full border t-sub font-medium flex items-center gap-2", coach ? "bg-green-soft border-green text-green-text" : "bg-card border-line text-muted")}>
            Private Coach <span className="t-meta">{coach ? "On" : "Off"}</span>
          </button>
          <button onClick={openCoach} aria-label="Rule Questions" title="Rule Questions" className="h-9 w-9 rounded-full border border-line bg-card flex items-center justify-center"><BookOpen size={17} /></button>
          <button onClick={onEnd} aria-label="End Game" title="End Game" className="h-9 w-9 rounded-full border border-line bg-card flex items-center justify-center"><Flag size={17} /></button>
          <ThemeToggle />
        </header>

        <div className="flex-1 flex flex-col lg:flex-row gap-4 pb-3">
          {/* ---------- table ---------- */}
          <section aria-label="Mahjong table" className="flex-1 min-w-0 flex flex-col gap-3">
            <div className="relative rounded-[28px] bg-[#1f5a2a] dark:bg-[#17401f] shadow-[inset_0_0_0_6px_rgba(0,0,0,0.12),0_10px_30px_rgba(0,0,0,0.12)] p-3 lg:p-5 min-h-[440px] grid grid-cols-[minmax(80px,1fr)_minmax(0,2.4fr)_minmax(80px,1fr)] grid-rows-[auto_1fr_auto] gap-2">
              <div className="col-start-2 row-start-1 flex justify-center">{seat(seatOf.top, "top")}</div>
              <div className="col-start-1 row-start-2 flex items-center justify-center">{seat(seatOf.left, "left")}</div>
              <div className="col-start-3 row-start-2 flex items-center justify-center">{seat(seatOf.right, "right")}</div>
              <div className="col-start-2 row-start-2 grid grid-cols-3 grid-rows-3 gap-1 items-center justify-items-center min-h-[240px]">
                <div className="col-start-2 row-start-1">{pile(seatOf.top)}</div>
                <div className="col-start-1 row-start-2">{pile(seatOf.left)}</div>
                <div className="col-start-3 row-start-2">{pile(seatOf.right)}</div>
                <div className="col-start-2 row-start-3">{pile(me)}</div>
                <div className="col-start-2 row-start-2 rounded-[16px] bg-black/20 text-white text-center px-3 py-2 min-w-[120px]">
                  <div className="t-meta text-white/70">Wall</div>
                  <div className="text-[22px] font-semibold tabular-nums">{m.wallCount}</div>
                  <div className="t-meta text-white/80">{m.phase === "exchange" ? "Exchange 3" : m.phase === "dingque" ? "Ding Que" : m.phase === "ended" ? "Hand over" : turnName ? `${turnName}'s turn` : ""}</div>
                </div>
              </div>
              <div className="col-start-2 row-start-3 flex justify-center">{seat(me, "bottom")}</div>
              <Danmaku items={social} players={players} />
              {m.last && m.phase === "claim" && <div className="absolute top-3 right-3 rounded-[12px] bg-white/90 px-2 py-1 flex items-center gap-1 t-meta text-[#1c1c1e]">Last discard <Tile id={m.last.tile} size={20} /></div>}
            </div>

            {/* ---------- my hand ---------- */}
            <div className="rounded-[20px] bg-card border border-line p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap min-h-6">
                <p className="t-sub font-medium flex-1" aria-live="polite">{prompt}</p>
                {m.myReceived && m.phase !== "exchange" && m.phase === "dingque" && <span className="t-meta text-muted">You received: {m.myReceived.map(tileName).join(", ")}</span>}
              </div>
              {coach && myTurn && (suggestion || canHu) && (
                <div className="rounded-[14px] bg-green-soft border border-green/40 px-3 py-2 flex flex-col gap-2" aria-label="Private Coach suggestion">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="t-meta font-semibold text-green-text">PRIVATE COACH</span>
                    <span className="t-sub font-medium flex-1 min-w-0">{canHu ? `You can win: ${(win?.structure || "standard").replace("_", " ")} hand` : `Suggested: ${suggestion!.title}`}</span>
                    <button onClick={() => setWhy(!why)} aria-expanded={why} aria-label="Why this tile?" className="h-8 px-2 rounded-full t-meta font-medium text-green-text flex items-center gap-1 hover:bg-white/60">{canHu ? "Why?" : "Why this tile?"} <CircleHelp size={16} /></button>
                    {!canHu && suggestion && <button onClick={() => setSel([suggestion.tile])} className="h-8 px-3 rounded-full border border-green/50 bg-card t-meta font-medium">Select It</button>}
                  </div>
                  {why && (
                    <div className="rounded-[12px] bg-card p-3 flex gap-3 items-start" role="dialog" aria-label="Why This Tile?">
                      {!canHu && suggestion && <Tile id={suggestion.tile} size={30} />}
                      <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <p className="t-sub font-semibold">{canHu ? "Why Can I Win?" : "Why This Tile?"}</p>
                        <p className="t-sub">{canHu ? `You can win with this hand because it meets the current rules: ${(win?.structure || "standard").replace("_", " ")} hand${win?.pureSuit ? ", one suit" : ""}, no missing-suit tiles.` : suggestion!.reason}</p>
                        {!canHu && suggestion?.note && <p className="t-meta text-muted">{suggestion.note}</p>}
                        {!canHu && suggestion?.keepPair && suggestion.category !== "pair" && suggestion.category !== "missing" && <p className="t-meta text-muted">Keeping your pair of {suggestion.keepPair} may help you build a winning hand.</p>}
                        {!canHu && suggestion?.alternatives && suggestion.category !== "alternative" && <p className="t-meta text-muted">You have more than one legal option. This is one simple choice, not the only correct move.</p>}
                        <div className="flex gap-2 pt-1">
                          <Btn variant="secondary" className="min-h-9 px-3 bg-card" onClick={() => setWhy(false)}>Got It</Btn>
                          <Btn variant="ghost" className="min-h-9 px-3" onClick={openCoach}>Learn More</Btn>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-1 items-end justify-center min-h-[72px] pt-3">
                {hand.map((t) => {
                  const isDq = !!dq && suitOf(t) === dq;
                  const selectable = (m.phase === "exchange" && !m.myExchange) || myTurn;
                  return <Tile key={t} id={t} size={42} label={tileName(t)} selected={sel.includes(t) || (!!m.myExchange && m.myExchange.includes(t))}
                    hint={coach && !!suggestion && suggestion.tile === t} dim={myTurn && !legal.includes(t) && !isDq}
                    onClick={selectable ? () => tap(t) : undefined} />;
                })}
                {myMelds.length > 0 && <span className="ml-3 flex gap-1.5 items-end">{myMelds.map((mm, k) => <span key={k} className="flex">{mm.tiles.map((t, j) => <Tile key={j} id={t} size={30} />)}</span>)}</span>}
              </div>
              {error && <p className="t-sub text-[#B42318] dark:text-[#FF6961] text-center" role="alert">{error}</p>}
              {actions && <div className="flex justify-center">{actions}</div>}
            </div>
          </section>

          {/* ---------- side panel: Coach + social ---------- */}
          <aside className="lg:w-[320px] shrink-0 flex flex-col gap-3">
            <div className="rounded-[20px] bg-card border border-line p-4 flex flex-col gap-2" aria-label="Private Coach">
              <div className="t-meta text-muted font-medium">PRIVATE COACH</div>
              {coachCard}
            </div>
            <div className="rounded-[20px] bg-card border border-line p-4 flex flex-col gap-3" aria-label="Table chat">
              <div className="flex items-center gap-2">
                <span className="t-meta text-muted font-medium flex-1">TABLE CHAT</span>
                <div className="relative">
                  <button onClick={() => setEmojiOpen(!emojiOpen)} aria-label="Send an emoji" aria-expanded={emojiOpen} className="h-9 w-9 rounded-full border border-line flex items-center justify-center"><Smile size={18} /></button>
                  {emojiOpen && <div className="absolute right-0 top-11 z-20 rounded-full bg-card border border-line shadow-card px-2 py-1 flex gap-1">
                    {EMOJIS.map((e) => <button key={e} onClick={() => { setEmojiOpen(false); sendSocial("emoji", e); }} className="h-9 w-9 rounded-full hover:bg-surface" style={{ ...EMOJI_FONT, fontSize: 20 }} aria-label={`Send ${e}`}>{e}</button>)}
                  </div>}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">{QUICK.map((q) => <button key={q} onClick={() => sendSocial("quick", q)} className="h-8 px-3 rounded-full border border-line bg-bubble t-meta">{q}</button>)}</div>
              <form className="flex gap-2" onSubmit={(e) => {
                e.preventDefault(); if (!ask.trim()) return;
                // answering someone else's recent question → a reply; otherwise a new question for the table
                const lastAsk = [...social].reverse().find((x) => x.kind === "ask");
                sendSocial(lastAsk && lastAsk.pid !== me && Date.now() - lastAsk.ts < 120000 ? "reply" : "ask", ask.trim()); setAsk("");
              }}>
                <input value={ask} onChange={(e) => setAsk(e.target.value)} maxLength={140} placeholder="Ask or answer a rule question…" className="flex-1 min-w-0 h-10 px-3 rounded-xl border border-line bg-bg outline-none focus:border-green t-sub" />
                <Btn type="submit" variant="secondary" className="min-h-10 px-3" disabled={!ask.trim()}><MessageCircle size={16} /></Btn>
              </form>
              <button onClick={() => setChatOpen(!chatOpen)} aria-expanded={chatOpen} className="self-start t-sub font-medium text-green-text min-h-9">{chatOpen ? "Hide Table Chat" : `Table Chat (${social.length})`}</button>
              {chatOpen && <ul className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto" aria-label="Table Chat history">
                {[...social].reverse().map((s: SocialItem) => (
                  <li key={s.id} className="t-sub flex gap-2"><span style={EMOJI_FONT}>{emojiFor(byId(s.pid) || {})}</span>
                    <span className="min-w-0"><b className="font-medium">{byId(s.pid)?.name}</b>{s.kind === "ask" ? <span className="text-green-text"> asks: </span> : s.kind === "reply" ? <span className="text-muted"> answers: </span> : ": "}{s.text}</span></li>
                ))}
                {!social.length && <li className="t-meta text-muted">No messages yet. Messages float across the table as they arrive. Your hand is never shared.</li>}
              </ul>}
            </div>
            <div className="rounded-[20px] bg-card border border-line p-3 flex flex-col gap-1 max-h-[160px] overflow-y-auto" aria-label="Game log">
              <div className="t-meta text-muted font-medium">LOG</div>
              {[...m.log].reverse().slice(0, 8).map((l, k) => <p key={k} className="t-meta">{l.text}</p>)}
            </div>
          </aside>
        </div>
      </div>

      {m.phase === "ended" && (() => {
        const delta = (id: string) => (r.ledger || []).filter((l) => l.hand === m.hand).reduce((a, l) => a + (l.to === id ? l.amount : 0) - (l.from === id ? l.amount : 0), 0);
        const total = (id: string) => (r.ledger || []).reduce((a, l) => a + (l.to === id ? l.amount : 0) - (l.from === id ? l.amount : 0), 0);
        const sgn = (n: number) => (n > 0 ? `+${n}` : String(n));
        return (
          <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-4" role="dialog" aria-modal aria-label="Hand Complete!">
            <div className="w-full max-w-[480px] rounded-[24px] bg-bg p-5 flex flex-col gap-4 shadow-sheet">
              <div>
                <h2 className="t-app text-green-text">Hand Complete!</h2>
                <p className="t-sub text-muted">{m.endReason === "wall" ? "The wall ran out." : "Three players have won."} {m.winners.length ? m.winners.map((w) => `${byId(w.pid)?.name} won ${w.method === "self_draw" ? "by self-draw" : `on ${byId(w.from!)?.name}'s discard`}`).join(" · ") : "Nobody won this hand."}</p>
              </div>
              <ul className="grid grid-cols-4 gap-2" aria-label="Scores">
                {m.order.map((id) => (
                  <li key={id} className="flex flex-col items-center text-center min-w-0">
                    <span className={cx("relative h-12 w-12 rounded-full bg-card border-2 flex items-center justify-center", m.nextReady?.[id] ? "border-green" : "border-line")}>
                      <span style={{ ...EMOJI_FONT, fontSize: 26 }}>{emojiFor(byId(id))}</span>
                    </span>
                    <span className="t-sub font-medium truncate max-w-full mt-1">{byId(id)?.name}</span>
                    <span className={cx("t-sub font-semibold tabular-nums", delta(id) > 0 ? "text-green-text" : delta(id) < 0 ? "text-[#B42318] dark:text-[#FF6961]" : "text-muted")}>{sgn(delta(id))} this hand</span>
                    <span className="t-meta text-muted tabular-nums">Total {sgn(total(id))}</span>
                    <span className="t-meta text-muted">{m.nextReady?.[id] ? "Ready ✓" : "Deciding…"}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-2">
                <Btn disabled={busy || !!m.nextReady?.[me]} onClick={() => act({ type: "mj-next" })}>{m.nextReady?.[me] ? `Waiting for everyone… (${m.order.filter((id) => m.nextReady?.[id]).length}/4)` : "Play Another Hand"}</Btn>
                <Btn variant="secondary" className="bg-card" onClick={onEnd}>End Game</Btn>
              </div>
            </div>
          </div>
        );
      })()}
      <Confetti ref={confettiRef} manualstart globalOptions={confettiOpts} className="pointer-events-none fixed inset-0 z-50 w-full h-full" aria-hidden />
      {overlays}
    </div>
  );
}
