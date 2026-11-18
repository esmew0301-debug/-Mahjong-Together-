"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CircleHelp, Flag, History, Lightbulb, MessageCircle, Moon, MoreHorizontal, Smile, Sun, X } from "lucide-react";
import type { PublicPlayer, PublicRoom, SocialItem } from "@/lib/types";
import { Btn, Sheet, cx } from "@/components/ui";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { tileArt } from "@/lib/tutorial/sichuan-art";
import { type Meld, type Suit, SUITS, SUIT_NAME, concealedKongKeys, keyName, legalDiscards, numOf, suggestDiscard, suitOf, tileName, winInfo } from "@/lib/mj/rules";
import { EMOJI_FONT, emojiFor } from "./avatar";
import { Danmaku } from "./Danmaku";
import { Confetti, type ConfettiRef } from "@/components/ui/confetti";
import { smallConfetti } from "@/lib/celebrate";
import { useReducedMotion } from "motion/react";

/**
 * Online game table — two intentional layouts from the same pieces:
 *  - Mobile (< lg): compact header · compact portrait board · hand · contextual Coach · primary action · collapsible chat/log.
 *  - Desktop (≥ lg): centred board + hand on the left, Coach / Table Chat / Log side panel on the right.
 * All gameplay text is ≥ 14px (t-meta is raised to 14px inside [data-mj-table], see globals.css).
 */
type Act = (a: Record<string, unknown>) => Promise<void>;
const EMOJIS = ["❤️", "👍", "😂", "👏", "😊"];
const QUICK = ["Nice Move!", "Good Game!", "Can You Explain?", "Thanks!", "Let's Play Again!"];
const DIR_WORD: Record<string, string> = { clockwise: "to the player on your left", counterclockwise: "to the player on your right", across: "to the player across from you" };
const SHORT: Record<Suit, string> = { c: "Char", b: "Bam", d: "Dots" }; // compact board label; full names everywhere else
const RECENT = { side: 6, row: 7 }; // discards shown per pile on mobile (full history in "All discards")

/** One Mahjong tile. `fluid` = fills its wrapper's width (responsive sizes are set on the wrapper). */
function Tile({ id, size = 40, fluid, back, selected, hint, dim, onClick, label }: { id?: number; size?: number; fluid?: boolean; back?: boolean; selected?: boolean; hint?: boolean; dim?: boolean; onClick?: () => void; label?: string }) {
  const face = back || id === undefined ? "back" : { s: suitOf(id), n: numOf(id) };
  const svg = <svg viewBox="-17 -22 34 50" style={fluid ? { width: "100%", height: "auto", display: "block" } : { width: size, height: size * 1.47 }} aria-hidden><g dangerouslySetInnerHTML={{ __html: tileArt(face as never) }} /></svg>;
  if (!onClick) return <span className={cx(fluid ? "block" : "inline-block", dim && "opacity-45")} title={label}>{svg}</span>;
  return (
    <button type="button" onClick={onClick} aria-label={label} aria-pressed={selected}
      className={cx("relative block w-full rounded-[8px] transition-transform duration-150 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:outline-2 motion-reduce:transition-none", selected ? "-translate-y-2.5" : "lg:hover:-translate-y-1", dim && "opacity-55")}>
      {svg}
      {selected && <span className="absolute inset-[-3px] rounded-[9px] ring-[3px] ring-green-strong pointer-events-none" aria-hidden />}
      {hint && !selected && <span className="absolute inset-[-4px] rounded-[10px] border-2 border-dashed border-green pointer-events-none ring-green" aria-hidden />}
    </button>
  );
}
const Mini = ({ id, cls }: { id: number; cls: string }) => <span className={cx("shrink-0", cls)}><Tile id={id} fluid label={tileName(id)} /></span>;

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
    <div className="w-full lg:max-w-[560px] rounded-[18px] border-[1.5px] border-green bg-green-soft p-3 flex flex-col gap-3 mt-pop" role="alertdialog" aria-label={c.title}>
      <div className="flex items-center gap-2">
        <p className="t-page text-green-text">{c.title}</p>
        <button onClick={() => setHelp(!help)} aria-label={c.whatT} aria-expanded={help} className="h-11 w-11 -my-1 rounded-full flex items-center justify-center hover:bg-white/60 dark:hover:bg-white/10"><CircleHelp size={20} /></button>
        <span className="ml-auto t-sub font-semibold text-green-text tabular-nums rounded-full bg-card px-2.5 py-1" aria-label={`${left} seconds left`}>{left}s</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="flex gap-0.5 shrink-0">{Array.from({ length: c.n }).map((_, k) => <span key={k} className="w-7 sm:w-8"><Tile id={tile} fluid /></span>)}</span>
        <div className="min-w-0">
          <p className="t-sub">{c.sub}</p>
          <p className="t-meta text-muted">{from} discarded {tileName(tile)}.</p>
        </div>
      </div>
      {help && <div className="rounded-[12px] bg-card p-3 flex flex-col gap-1"><p className="t-sub font-semibold">{c.whatT}</p><p className="t-sub">{c.what}</p></div>}
      <div className="grid grid-cols-2 sm:flex sm:justify-end gap-2">
        {opts.includes("hu") && <Btn className="min-h-12 text-[17px]" disabled={busy} onClick={() => onChoose("hu")}>Hu</Btn>}
        {opts.includes("kong") && <Btn className={cx("min-h-12 text-[17px]", top !== "kong" && "bg-card")} variant={top === "kong" ? "primary" : "secondary"} disabled={busy} onClick={() => onChoose("kong")}>Kong</Btn>}
        {opts.includes("pung") && <Btn className={cx("min-h-12 text-[17px]", top !== "pung" && "bg-card")} variant={top === "pung" ? "primary" : "secondary"} disabled={busy} onClick={() => onChoose("pung")}>Pung</Btn>}
        <Btn className="min-h-12 text-[17px] bg-card" variant="secondary" disabled={busy} onClick={() => onChoose("pass")}>Pass</Btn>
      </div>
    </div>
  );
}

/** Opponent / own seat. Mobile: compact avatar + short labels. Desktop: larger avatar, full labels, tile backs. */
function Seat({ p, me, turn, count, melds, dq, won, pos }: { p: PublicPlayer; me: boolean; turn: boolean; count: number; melds: Meld[]; dq?: Suit; won?: boolean; pos: "top" | "left" | "right" | "bottom" }) {
  const vertical = pos === "left" || pos === "right";
  const full = `${won ? "Won 🏆" : `${count} tiles`}${dq ? ` · missing ${SUIT_NAME[dq]}` : ""}`;
  return (
    <div className={cx("flex items-center gap-1.5 lg:gap-2 min-w-0", vertical ? "flex-col text-center" : "flex-row")} aria-label={`${p.name}${me ? " (you)" : ""}: ${full}`}>
      <span className={cx("shrink-0 h-10 w-10 lg:h-12 lg:w-12 rounded-full bg-card border-2 flex items-center justify-center transition-colors", turn ? "border-[#FFD60A] shadow-[0_0_0_3px_rgba(255,214,10,0.45)]" : "border-white/40")}>
        <span style={{ ...EMOJI_FONT, lineHeight: 1 }} className="text-[22px] lg:text-[26px]">{emojiFor(p)}</span>
      </span>
      <div className="text-white min-w-0 max-w-full">
        <div className="text-[14px] lg:text-[15px] leading-5 font-semibold truncate lg:max-w-[140px]" title={p.name}>{p.name}{me ? " (you)" : ""}</div>
        {/* mobile: short, stacked on the sides */}
        <div className="lg:hidden text-[14px] leading-5 text-white/85">
          {won ? "Won 🏆" : `${count} tiles`}{dq && (vertical ? <><br />No {SHORT[dq]}</> : ` · No ${SHORT[dq]}`)}
        </div>
        <div className="hidden lg:block text-[14px] leading-5 text-white/80">{full}</div>
        {!me && !won && count > 0 && (
          <div className={cx("hidden lg:flex mt-1", vertical ? "flex-col items-center -space-y-3" : "-space-x-1.5")} aria-hidden>
            {Array.from({ length: Math.min(count, vertical ? 7 : 14) }).map((_, i) => <Tile key={i} back size={vertical ? 14 : 13} />)}
          </div>
        )}
        {melds.length > 0 && <div className={cx("flex flex-wrap gap-1 mt-1", vertical && "justify-center")}>{melds.map((m, i) => <span key={i} className="flex mt-pop">{m.tiles.map((t, j) => <span key={j} className="w-4 lg:w-[18px]"><Tile id={m.kind === "ckong" && (j === 0 || j === 3) ? undefined : t} back={m.kind === "ckong" && (j === 0 || j === 3)} fluid /></span>)}</span>)}</div>}
      </div>
    </div>
  );
}

const iconBtn = "h-11 w-11 shrink-0 rounded-full border border-line bg-card flex items-center justify-center";

export function MjTable({ r, me, act, busy, error, openCoach, onEnd, overlays }: { r: PublicRoom; me: string; act: Act; busy: boolean; error: string | null; openCoach: () => void; onEnd: () => void; overlays?: React.ReactNode }) {
  const m = r.mj!;
  const [sel, setSel] = useState<number[]>([]);
  const [coach, setCoach] = useState(true);
  const [why, setWhy] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [menu, setMenu] = useState<"" | "coach" | "more">("");
  const [allDiscards, setAllDiscards] = useState(false);
  const [dark, setDark] = useState(false);
  const reduce = useReducedMotion();
  const confettiRef = useRef<ConfettiRef>(null);
  const confettiOpts = useMemo(() => ({ resize: true, useWorker: true }), []);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [ask, setAsk] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => { try { setCoach(localStorage.getItem("mt.coach") !== "off"); } catch {} setDark(document.documentElement.classList.contains("dark")); }, []);
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 500); return () => window.clearInterval(t); }, []);
  const toggleCoach = () => { const v = !coach; setCoach(v); try { localStorage.setItem("mt.coach", v ? "on" : "off"); } catch {} };
  const toggleDark = () => { const v = !dark; setDark(v); document.documentElement.classList.toggle("dark", v); try { localStorage.setItem("mt.theme", v ? "dark" : "light"); } catch {} };

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

  // ---- phase-specific prompt + actions (only what matters right now)
  let prompt = "";
  let actions: React.ReactNode = null;
  if (m.phase === "exchange") {
    prompt = m.myExchange ? "Waiting for everyone to choose their 3 tiles…" : `Choose 3 tiles of one suit to pass ${DIR_WORD[m.exDir]}.`;
    if (!m.myExchange) actions = <Btn className="w-full sm:w-auto sm:min-w-[240px] text-[17px]" disabled={busy || sel.length !== 3} onClick={() => act({ type: "mj-exchange", tiles: sel })}>Exchange These 3</Btn>;
  } else if (m.phase === "dingque") {
    prompt = dq ? "Waiting for everyone to choose a missing suit…" : "Choose your missing suit. You must discard it before you can win.";
    if (!dq) actions = <div className="grid grid-cols-3 gap-2 w-full sm:w-auto">{SUITS.map((s) => <Btn key={s} variant="secondary" className="bg-card px-2" disabled={busy} onClick={() => act({ type: "mj-dingque", suit: s })}>{SUIT_NAME[s]}</Btn>)}</div>;
  } else if (claim) {
    prompt = `${byId(m.last!.from)?.name} discarded ${tileName(m.last!.tile)}.`;
    actions = <ClaimPanel opts={claim.opts} tile={m.last!.tile} from={byId(m.last!.from)?.name || "A player"} left={claimLeft} busy={busy} onChoose={(c) => act({ type: "mj-claim", choice: c })} />;
  } else if (myTurn) {
    prompt = dq && hand.some((t) => suitOf(t) === dq) ? `Your turn. Discard a ${SUIT_NAME[dq]} tile (your missing suit).` : "Your turn. Select a tile to discard.";
    actions = <div className="flex flex-col sm:flex-row sm:justify-center gap-2 w-full">
      {canHu && <Btn className="w-full sm:w-auto text-[17px]" onClick={() => act({ type: "mj-hu" })} disabled={busy}>Declare Hu</Btn>}
      {kongKeys.map((k) => <Btn key={k} variant="secondary" className="w-full sm:w-auto bg-card" disabled={busy} onClick={() => act({ type: "mj-kong", key: k })}>Kong {keyName(k)}</Btn>)}
      <Btn variant={canHu ? "secondary" : "primary"} className={cx("w-full sm:w-auto sm:min-w-[240px] text-[17px]", canHu && "bg-card")} disabled={busy || sel.length !== 1} onClick={discard}>
        {sel[0] !== undefined ? `Discard ${tileName(sel[0])}` : "Select a tile to discard"}
      </Btn>
    </div>;
  } else if (m.phase === "ended") {
    prompt = m.endReason === "wall" ? "The wall is empty. Hand over." : "Hand over.";
  } else if (won) {
    prompt = "You won this hand! Watch the others finish.";
  } else {
    prompt = m.phase === "claim" ? "Other players are deciding on the discard…" : turnName ? `${turnName}'s turn…` : "";
  }

  // ---- Coach tips for states without a tile suggestion (free, deterministic; never forces a move)
  let coachTip: React.ReactNode = null;
  if (coach && m.phase === "exchange" && !m.myExchange) coachTip = "Pick three tiles from the suit you hold the fewest of. Those are easiest to give away.";
  else if (coach && m.phase === "dingque" && !dq) {
    const fewest = [...SUITS].sort((a, b) => hand.filter((t) => suitOf(t) === a).length - hand.filter((t) => suitOf(t) === b).length)[0];
    coachTip = <>Tip: <b>{SUIT_NAME[fewest]}</b> is the suit you hold the fewest of, so it&apos;s the easiest to clear.</>;
  } else if (coach && claim) coachTip = claim.opts.includes("hu") ? "Hu wins the hand now. Pass keeps playing." : "Claiming makes an exposed set and it becomes your turn to discard. Pass keeps your hand as it is.";
  const showSuggest = coach && myTurn && (!!suggestion || canHu);
  const structure = (win?.structure || "standard").replace("_", " ");

  // Coach suggestion card: one card, three clear rows (label · suggestion · actions). Never a fixed height.
  const whyBody = (
    <div className="flex gap-3 items-start">
      {!canHu && suggestion && <Mini id={suggestion.tile} cls="w-9" />}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <p className="t-section">{canHu ? "Why Can I Win?" : "Why This Tile?"}</p>
        <p className="t-body">{canHu ? `You can win with this hand because it meets the current rules: ${structure} hand${win?.pureSuit ? ", one suit" : ""}, no missing-suit tiles.` : suggestion?.reason}</p>
        {!canHu && suggestion?.note && <p className="t-sub text-muted">{suggestion.note}</p>}
        {!canHu && suggestion?.keepPair && suggestion.category !== "pair" && suggestion.category !== "missing" && <p className="t-sub text-muted">Keeping your pair of {suggestion.keepPair} may help you build a winning hand.</p>}
        {!canHu && suggestion?.alternatives && suggestion.category !== "alternative" && <p className="t-sub text-muted">You have more than one legal option. This is one simple choice, not the only correct move.</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          <Btn variant="secondary" className="min-h-11 px-4 bg-card" onClick={() => setWhy(false)}>Got It</Btn>
          <Btn variant="ghost" className="min-h-11 px-4" onClick={openCoach}>Learn More</Btn>
        </div>
      </div>
    </div>
  );
  const suggestCard = (variant: "mobile" | "desktop") => (
    <div className="rounded-[16px] bg-green-soft border border-green/40 p-3 flex flex-col gap-2.5" aria-label="Private Coach suggestion">
      <div className="flex items-center gap-1.5 text-green-text"><Lightbulb size={16} aria-hidden /><span className="t-sub font-semibold">Private Coach</span><span className="t-sub text-muted">· On</span></div>
      <div className="flex items-center gap-3 min-w-0">
        {!canHu && suggestion && <Mini id={suggestion.tile} cls="w-7" />}
        <p className="t-section min-w-0">{canHu ? `You can win: ${structure} hand` : `Suggested: ${suggestion!.title}`}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setWhy(!why)} aria-expanded={why} aria-label="Why this tile?" className="min-h-11 px-3.5 rounded-full bg-card border border-green/40 t-sub font-medium text-green-text inline-flex items-center gap-1.5">
          {canHu ? "Why?" : "Why this tile?"} <CircleHelp size={18} aria-hidden />
        </button>
        {!canHu && suggestion && <button onClick={() => setSel([suggestion.tile])} className="min-h-11 px-4 rounded-full bg-card border border-line t-sub font-medium">Select Tile</button>}
      </div>
      {why && (variant === "desktop"
        ? <div className="rounded-[12px] bg-card p-3" role="dialog" aria-label="Why This Tile?">{whyBody}</div>
        : <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal aria-label="Why This Tile?">
            <div className="absolute inset-0 bg-black/30" onClick={() => setWhy(false)} />
            <div className="relative w-full bg-bg rounded-t-[20px] shadow-sheet px-4 pt-4 pb-safe max-h-[80dvh] overflow-y-auto">
              <button onClick={() => setWhy(false)} aria-label="Close" className="absolute right-2 top-2 h-11 w-11 rounded-full flex items-center justify-center"><X size={20} /></button>
              <div className="pr-10 pb-3">{whyBody}</div>
            </div>
          </div>)}
    </div>
  );

  // ---- board pieces
  const seat = (id: string, where: "top" | "left" | "right" | "bottom") => (
    <Seat p={byId(id)} me={id === me} turn={m.turn === id} count={id === me ? hand.length : m.handCounts[id] || 0} melds={m.melds[id] || []}
      dq={m.phase !== "exchange" ? m.dq[id] : undefined} won={m.winners.some((w) => w.pid === id)} pos={where} />
  );
  const hiddenCount = (id: string, side: boolean) => Math.max(0, (m.discards[id] || []).length - (side ? RECENT.side : RECENT.row));
  const anyHidden = [seatOf.top, me].some((id) => hiddenCount(id, false) > 0) || [seatOf.left, seatOf.right].some((id) => hiddenCount(id, true) > 0);
  const pile = (id: string, side: boolean) => {
    const ds = m.discards[id] || [];
    const cut = ds.length - (side ? RECENT.side : RECENT.row);
    return (
      <div className={cx("flex flex-wrap gap-0.5 content-start justify-center", side ? "max-w-[68px] lg:max-w-[150px]" : "max-w-full lg:max-w-[260px]")} aria-label={`${byId(id)?.name}'s discards`}>
        {ds.map((t, k) => <span key={k} className={cx("w-[21px] lg:w-[22px]", k < cut && "max-lg:hidden")} data-pile-tile><Tile id={t} fluid label={tileName(t)} /></span>)}
      </div>
    );
  };
  const status = m.phase === "exchange" ? "Exchange 3" : m.phase === "dingque" ? "Missing Suit" : m.phase === "ended" ? "Hand over" : m.phase === "claim" ? "Deciding…" : myTurn ? "Your Turn" : turnName ? `${turnName}'s turn` : "";

  const chatControls = (
    <>
      <div className="flex flex-wrap gap-2">{QUICK.map((q) => <button key={q} onClick={() => sendSocial("quick", q)} className="min-h-11 px-3.5 rounded-full border border-line bg-bubble t-sub">{q}</button>)}</div>
      <form className="flex gap-2" onSubmit={(e) => {
        e.preventDefault(); if (!ask.trim()) return;
        // answering someone else's recent question → a reply; otherwise a new question for the table
        const lastAsk = [...social].reverse().find((x) => x.kind === "ask");
        sendSocial(lastAsk && lastAsk.pid !== me && Date.now() - lastAsk.ts < 120000 ? "reply" : "ask", ask.trim()); setAsk("");
      }}>
        <input value={ask} onChange={(e) => setAsk(e.target.value)} maxLength={140} placeholder="Ask or answer a rule question…" aria-label="Message the table" className="flex-1 min-w-0 h-11 px-3 rounded-xl border border-line bg-bg outline-none focus:border-green text-[16px]" />
        <Btn type="submit" variant="secondary" className="min-h-11 w-11 px-0" disabled={!ask.trim()} aria-label="Send"><MessageCircle size={18} /></Btn>
      </form>
    </>
  );

  return (
    <div className="fixed inset-0 z-30 bg-page overflow-y-auto overflow-x-hidden" data-mj-table>
      <div className="min-h-full flex flex-col max-w-[1280px] mx-auto px-3 sm:px-4 lg:px-6 pb-safe">
        {/* ---------- header ---------- */}
        <header className="pt-safe shrink-0">
          <div className="h-14 lg:h-16 flex items-center gap-1.5 lg:gap-2">
            <div className="flex-1 min-w-0">
              <div className="t-section lg:t-page text-green-text whitespace-nowrap">Mahjong Together</div>
              <div className="t-meta text-muted truncate">
                <span className="lg:hidden">Hand {m.hand} · {m.wallCount} left</span>
                <span className="hidden lg:inline">Hand {m.hand} · {m.wallCount} tiles left in the wall{anyAI ? " · includes simulated players" : ""}</span>
              </div>
            </div>
            {/* desktop: labelled switch; mobile: icon that opens the switch */}
            <button onClick={toggleCoach} role="switch" aria-checked={coach} className={cx("hidden lg:flex h-11 px-4 rounded-full border t-sub font-medium items-center gap-2", coach ? "bg-green-soft border-green text-green-text" : "bg-card border-line text-muted")}>
              <Lightbulb size={16} aria-hidden /> Private Coach <span className="font-semibold">{coach ? "On" : "Off"}</span>
            </button>
            <div className="relative lg:hidden">
              <button onClick={() => setMenu(menu === "coach" ? "" : "coach")} aria-label={`Private Coach (${coach ? "On" : "Off"})`} aria-expanded={menu === "coach"} className={cx(iconBtn, coach && "bg-green-soft border-green text-green-text")}>
                <Lightbulb size={19} />
                {coach && <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-green-strong border-2 border-green-soft" aria-hidden />}
              </button>
            </div>
            <button onClick={onEnd} aria-label="End Game" title="End Game" className={cx(iconBtn, "hidden min-[375px]:flex")}><Flag size={19} /></button>
            <span className="hidden min-[375px]:flex lg:flex"><ThemeToggle /></span>
            <div className="relative min-[375px]:hidden">
              <button onClick={() => setMenu(menu === "more" ? "" : "more")} aria-label="More" aria-expanded={menu === "more"} className={iconBtn}><MoreHorizontal size={19} /></button>
            </div>
          </div>
          {menu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenu("")} aria-hidden />
              <div className="absolute right-3 top-[calc(env(safe-area-inset-top)+60px)] z-50 w-[min(300px,calc(100vw-24px))] rounded-[16px] bg-card border border-line shadow-sheet p-3 flex flex-col gap-2" role="menu">
                {menu === "coach" ? (
                  <>
                    <button onClick={toggleCoach} role="switch" aria-checked={coach} className="min-h-11 flex items-center gap-3 text-left">
                      <span className="flex-1"><span className="t-section block">Private Coach</span><span className="t-sub text-muted">Suggestions only you can see.</span></span>
                      <span className={cx("h-7 w-12 rounded-full p-0.5 transition-colors", coach ? "bg-green-strong" : "bg-line")}><span className={cx("block h-6 w-6 rounded-full bg-white shadow transition-transform", coach && "translate-x-5")} /></span>
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setMenu(""); onEnd(); }} className="min-h-11 flex items-center gap-3 t-body" role="menuitem"><Flag size={18} /> End Game</button>
                    <button onClick={toggleDark} className="min-h-11 flex items-center gap-3 t-body" role="menuitem">{dark ? <Sun size={18} /> : <Moon size={18} />} {dark ? "Light Mode" : "Dark Mode"}</button>
                  </>
                )}
              </div>
            </>
          )}
        </header>

        <div className="flex-1 flex flex-col lg:flex-row gap-3 lg:gap-5 pb-3">
          {/* ---------- board + hand ---------- */}
          <section aria-label="Mahjong table" className="lg:flex-1 min-w-0 flex flex-col gap-3">
            <div className="relative rounded-[22px] lg:rounded-[28px] bg-[#1f5a2a] dark:bg-[#17401f] shadow-[inset_0_0_0_5px_rgba(0,0,0,0.12),0_8px_24px_rgba(0,0,0,0.10)] p-2.5 lg:p-5 lg:min-h-[min(420px,50vh)] grid grid-cols-[76px_minmax(0,1fr)_76px] lg:grid-cols-[minmax(120px,1fr)_minmax(0,2.4fr)_minmax(120px,1fr)] grid-rows-[auto_1fr] lg:grid-rows-[auto_1fr_auto] gap-x-1.5 gap-y-2 lg:gap-2">
              <div className="col-span-3 lg:col-span-1 lg:col-start-2 row-start-1 flex justify-center px-11 lg:px-0">{seat(seatOf.top, "top")}</div>
              <div className="col-start-1 row-start-2 flex flex-col items-center justify-center gap-1.5">{seat(seatOf.left, "left")}<div className="lg:hidden">{pile(seatOf.left, true)}</div></div>
              <div className="col-start-3 row-start-2 flex flex-col items-center justify-center gap-1.5">{seat(seatOf.right, "right")}<div className="lg:hidden">{pile(seatOf.right, true)}</div></div>
              <div className="col-start-2 row-start-2 grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] grid-rows-[auto_auto_auto] lg:grid-rows-[auto_1fr_auto] gap-1.5 lg:gap-2 items-center justify-items-center lg:min-h-[min(240px,26vh)]">
                <div className="lg:col-span-3 row-start-1">{pile(seatOf.top, false)}</div>
                <div className="hidden lg:block lg:col-start-1 row-start-2">{pile(seatOf.left, true)}</div>
                <div className="hidden lg:block lg:col-start-3 row-start-2">{pile(seatOf.right, true)}</div>
                <div className="lg:col-span-3 row-start-3">{pile(me, false)}</div>
                <div className="lg:col-start-2 row-start-2 rounded-[14px] bg-black/25 text-white text-center px-2.5 py-1.5 lg:px-4 lg:py-2.5 min-w-0 lg:min-w-[130px]" aria-live="polite">
                  {m.phase === "claim" && m.last ? (
                    <div className="flex flex-col items-center gap-1"><span className="text-[14px] leading-5 text-white/85">Last discard</span><span className="w-7 lg:w-8"><Tile id={m.last.tile} fluid label={tileName(m.last.tile)} /></span></div>
                  ) : (
                    <>
                      <div className="text-[14px] leading-5 text-white/80">Wall <b className="text-[18px] lg:text-[22px] font-semibold tabular-nums text-white">{m.wallCount}</b></div>
                      <div className={cx("text-[14px] lg:text-[15px] leading-5 font-semibold", myTurn ? "text-[#FFD60A]" : "text-white/90")}>{status}</div>
                    </>
                  )}
                </div>
              </div>
              <div className="hidden lg:flex col-start-2 row-start-3 justify-center">{seat(me, "bottom")}</div>
              {anyHidden && <button onClick={() => setAllDiscards(true)} aria-label="All discards" className="lg:hidden absolute top-1.5 right-1.5 h-11 w-11 rounded-full bg-black/25 text-white flex items-center justify-center z-[31]"><History size={19} /></button>}
              <Danmaku items={social} players={players} />
            </div>

            {/* ---------- my hand + Coach + actions ---------- */}
            <div className="rounded-[20px] bg-card border border-line p-3 lg:p-4 flex flex-col gap-3">
              <div className="flex items-start gap-2 flex-wrap">
                <p className="t-body font-medium flex-1 min-w-[180px]" aria-live="polite">{prompt}</p>
                {dq && m.phase !== "exchange" && m.phase !== "dingque" && <span className="lg:hidden t-sub text-muted rounded-full border border-line px-2.5 py-0.5">Missing: {SUIT_NAME[dq]}</span>}
              </div>
              {m.myReceived && m.phase === "dingque" && <p className="t-sub text-muted">You received: {m.myReceived.map(tileName).join(", ")}</p>}
              {claim && actions}
              <div className="grid grid-cols-7 gap-1.5 pt-3 sm:flex sm:flex-wrap sm:justify-center sm:gap-1.5 lg:gap-1 xl:gap-1.5 max-w-[440px] w-full mx-auto sm:max-w-none" aria-label="Your hand">
                {hand.map((t) => {
                  const isDq = !!dq && suitOf(t) === dq;
                  const selectable = (m.phase === "exchange" && !m.myExchange) || myTurn;
                  return (
                    <div key={t} className="sm:w-[44px] lg:w-[38px] xl:w-[48px]">
                      <Tile id={t} fluid label={tileName(t)} selected={sel.includes(t) || (m.phase === "exchange" && !!m.myExchange && m.myExchange.includes(t))}
                        hint={coach && !!suggestion && suggestion.tile === t} dim={myTurn && !legal.includes(t) && !isDq}
                        onClick={selectable ? () => tap(t) : undefined} />
                    </div>
                  );
                })}
              </div>
              {myMelds.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <span className="t-sub text-muted">Your sets:</span>
                  {myMelds.map((mm, k) => <span key={k} className="flex mt-pop">{mm.tiles.map((t, j) => <span key={j} className="w-6 lg:w-7"><Tile id={t} fluid label={tileName(t)} /></span>)}</span>)}
                </div>
              )}
              {showSuggest && <div className="lg:hidden">{suggestCard("mobile")}</div>}
              {coachTip && <p className="lg:hidden t-sub rounded-[12px] bg-green-soft px-3 py-2"><b className="text-green-text">Coach: </b>{coachTip}</p>}
              {error && <p className="t-sub text-[#B42318] dark:text-[#FF6961] text-center" role="alert">{error}</p>}
              {actions && !claim && (
                <div className={cx("flex justify-center", myTurn && "max-lg:sticky max-lg:bottom-0 max-lg:z-20 max-lg:-mx-3 max-lg:-mb-3 max-lg:px-3 max-lg:pt-2 max-lg:pb-[max(12px,env(safe-area-inset-bottom))] max-lg:bg-card/95 max-lg:backdrop-blur max-lg:rounded-b-[20px] max-lg:border-t max-lg:border-line")}>{actions}</div>
              )}
            </div>
          </section>

          {/* ---------- side panel (desktop) / secondary tools (mobile) ---------- */}
          <aside className="lg:w-[340px] shrink-0 flex flex-col gap-3">
            <div className="hidden lg:flex rounded-[20px] bg-card border border-line p-4 flex-col gap-2" aria-label="Private Coach">
              {showSuggest ? suggestCard("desktop") : (
                <>
                  <div className="t-sub font-semibold text-green-text flex items-center gap-1.5"><Lightbulb size={16} aria-hidden /> Private Coach</div>
                  <p className="t-sub text-muted">{!coach ? "Coach is off. Rules are still checked for you." : coachTip || "Watch the table or send an emoji while you wait."}</p>
                </>
              )}
            </div>
            <div className="rounded-[20px] bg-card border border-line p-3 lg:p-4 flex flex-col gap-3" aria-label="Table chat">
              <div className="flex items-center gap-2">
                <button onClick={() => setChatOpen(!chatOpen)} aria-expanded={chatOpen} className="flex-1 min-h-11 text-left t-section">
                  {chatOpen ? "Hide Table Chat" : `Table Chat (${social.length})`}
                </button>
                <div className="relative">
                  <button onClick={() => setEmojiOpen(!emojiOpen)} aria-label="Send an emoji" aria-expanded={emojiOpen} className={iconBtn}><Smile size={20} /></button>
                  {emojiOpen && <div className="absolute right-0 bottom-12 lg:bottom-auto lg:top-12 z-20 rounded-full bg-card border border-line shadow-card px-1.5 py-1 flex gap-0.5">
                    {EMOJIS.map((e) => <button key={e} onClick={() => { setEmojiOpen(false); sendSocial("emoji", e); }} className="h-11 w-11 rounded-full hover:bg-surface" style={{ ...EMOJI_FONT, fontSize: 22 }} aria-label={`Send ${e}`}>{e}</button>)}
                  </div>}
                </div>
              </div>
              <div className={cx("flex-col gap-3", chatOpen ? "flex" : "hidden lg:flex")}>{chatControls}</div>
              {chatOpen && <ul className="flex flex-col gap-2 max-h-[260px] overflow-y-auto" aria-label="Table Chat history">
                {[...social].reverse().map((s: SocialItem) => (
                  <li key={s.id} className="t-sub flex gap-2"><span style={EMOJI_FONT}>{emojiFor(byId(s.pid) || {})}</span>
                    <span className="min-w-0 break-words"><b className="font-medium">{byId(s.pid)?.name}</b>{s.kind === "ask" ? <span className="text-green-text"> asks: </span> : s.kind === "reply" ? <span className="text-muted"> answers: </span> : ": "}{s.text}</span></li>
                ))}
                {!social.length && <li className="t-sub text-muted">No messages yet. Messages float across the table as they arrive. Your hand is never shared.</li>}
              </ul>}
            </div>
            <div className="rounded-[20px] bg-card border border-line p-3 lg:p-4 flex flex-col gap-1" aria-label="Game log">
              <button onClick={() => setLogOpen(!logOpen)} aria-expanded={logOpen} className="lg:hidden min-h-11 text-left t-section">{logOpen ? "Hide Game Log" : "Game Log"}</button>
              <div className="hidden lg:block t-sub font-semibold text-muted">Game Log</div>
              <div className={cx("flex-col gap-1 max-h-[180px] overflow-y-auto", logOpen ? "flex" : "hidden lg:flex")}>
                {[...m.log].reverse().slice(0, 8).map((l, k) => <p key={k} className="t-sub">{l.text}</p>)}
              </div>
            </div>
          </aside>
        </div>
      </div>

      <Sheet open={allDiscards} onClose={() => setAllDiscards(false)} title="All Discards">
        <div className="flex flex-col gap-4">
          {[seatOf.top, seatOf.left, seatOf.right, me].map((id) => (
            <div key={id} className="flex flex-col gap-1.5">
              <p className="t-sub font-semibold">{byId(id)?.name}{id === me ? " (you)" : ""} · {(m.discards[id] || []).length}</p>
              <div className="flex flex-wrap gap-1">{(m.discards[id] || []).map((t, k) => <span key={k} className="w-7"><Tile id={t} fluid label={tileName(t)} /></span>)}{!(m.discards[id] || []).length && <span className="t-sub text-muted">No discards yet.</span>}</div>
            </div>
          ))}
        </div>
      </Sheet>

      {m.phase === "ended" && (() => {
        const delta = (id: string) => (r.ledger || []).filter((l) => l.hand === m.hand).reduce((a, l) => a + (l.to === id ? l.amount : 0) - (l.from === id ? l.amount : 0), 0);
        const total = (id: string) => (r.ledger || []).reduce((a, l) => a + (l.to === id ? l.amount : 0) - (l.from === id ? l.amount : 0), 0);
        const sgn = (n: number) => (n > 0 ? `+${n}` : String(n));
        return (
          <div className="fixed inset-0 z-40 bg-black/30 flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal aria-label="Hand Complete!">
            <div className="w-full sm:max-w-[520px] max-h-[92dvh] overflow-y-auto rounded-t-[24px] sm:rounded-[24px] bg-bg p-4 sm:p-5 pb-safe flex flex-col gap-4 shadow-sheet">
              <div>
                <h2 className="t-app text-green-text">Hand Complete!</h2>
                <p className="t-sub text-muted">{m.endReason === "wall" ? "The wall ran out." : "Three players have won."} {m.winners.length ? m.winners.map((w) => `${byId(w.pid)?.name} won ${w.method === "self_draw" ? "by self-draw" : `on ${byId(w.from!)?.name}'s discard`}`).join(" · ") : "Nobody won this hand."}</p>
              </div>
              <ul className="flex flex-col sm:grid sm:grid-cols-4 gap-2" aria-label="Scores">
                {m.order.map((id) => (
                  <li key={id} className="flex sm:flex-col items-center gap-3 sm:gap-0 sm:text-center min-w-0 rounded-[14px] bg-card border border-line sm:border-0 sm:bg-transparent px-3 py-2 sm:p-0">
                    <span className={cx("shrink-0 h-11 w-11 sm:h-12 sm:w-12 rounded-full bg-card border-2 flex items-center justify-center", m.nextReady?.[id] ? "border-green" : "border-line")}>
                      <span style={{ ...EMOJI_FONT, fontSize: 24 }}>{emojiFor(byId(id))}</span>
                    </span>
                    <span className="flex-1 sm:flex-none min-w-0 flex flex-col sm:items-center">
                      <span className="t-sub font-semibold truncate max-w-full sm:mt-1">{byId(id)?.name}</span>
                      <span className="t-sub text-muted">{m.nextReady?.[id] ? "Ready ✓" : "Deciding…"}</span>
                    </span>
                    <span className="flex flex-col items-end sm:items-center">
                      <span className={cx("t-sub font-semibold tabular-nums", delta(id) > 0 ? "text-green-text" : delta(id) < 0 ? "text-[#B42318] dark:text-[#FF6961]" : "text-muted")}>{sgn(delta(id))} this hand</span>
                      <span className="t-sub text-muted tabular-nums">Total {sgn(total(id))}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-2">
                <Btn className="text-[17px]" disabled={busy || !!m.nextReady?.[me]} onClick={() => act({ type: "mj-next" })}>{m.nextReady?.[me] ? `Waiting for everyone… (${m.order.filter((id) => m.nextReady?.[id]).length}/4)` : "Play Another Hand"}</Btn>
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
