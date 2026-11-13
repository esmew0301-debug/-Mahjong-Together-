"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Check, ChevronLeft, CircleHelp, MessageCircleQuestion, Share2, QrCode } from "lucide-react";
import { useReducedMotion } from "motion/react";
import type { useRoom } from "@/lib/client";
import type { GameEvent, PublicPlayer, PublicRoom } from "@/lib/types";
import { winCalc } from "@/lib/scoring/sichuan";
import type { WinClaim } from "@/lib/scoring";
import { entryById } from "@/lib/mahjong/intent-matcher";
import { Btn, Header, IconBtn, Prose, Sheet, cx } from "@/components/ui";
import { Confetti, type ConfettiRef } from "@/components/ui/confetti";
import { ArtVisual } from "@/components/tutorial/ArtVisual";
import { DIR_TEXT, tileArt } from "@/lib/tutorial/sichuan-art";
import { EventCard, HandReviewPanel, ReconcilePanel, RecordEventSheet, ScoresSheet, describeEvent, useScores } from "@/components/Game";
import { gentleConfetti, markKey, seenKey, smallConfetti } from "@/lib/celebrate";
import { FourPlayerStatus } from "./FourPlayerStatus";
import { WaitingProgressRing } from "@/components/ui/loader-15";

type Actions = ReturnType<typeof useRoom>;
type Act = (a: Record<string, unknown>) => Promise<void>;
const ERR = "t-sub text-[#B42318] dark:text-[#FF6961]";
const isAI = (p?: PublicPlayer) => p?.kind === "virtual";
const pname = (r: PublicRoom, id?: string | null) => r.players.find((p) => p.id === id)?.name || "A player";
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

function useAct(actions: Actions) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const act: Act = async (a) => {
    setBusy(true); setError(null);
    try { await actions.act(a); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return { act, busy, error };
}

// =====================================================================================================
/** If `r` completed a group confirmation that `p` was showing, return `p` with every seat confirmed. */
function completedView(p: PublicRoom, r: PublicRoom): PublicRoom | null {
  const all = <T,>(v: T) => Object.fromEntries(p.players.map((x) => [x.id, v]));
  if (p.status === "lobby" && r.status === "setup") return { ...p, lobbyReady: all(true) };
  if (p.status === "setup" && p.stepId && (r.status !== "setup" || r.stepId !== p.stepId) && r.status !== "lobby") return { ...p, resp: all("ready"), viewing: {} };
  // Ended by unanimous agreement (also when AI demo votes completed it in the same update as the request).
  if (!p.endedEarly && r.endedEarly && !r.endProposal)
    return { ...p, endProposal: { id: p.endProposal?.id || "agreed", by: p.endProposal?.by || r.players[0].id, votes: all("agree" as const), createdAt: p.endProposal?.createdAt || Date.now(), fromStatus: p.status } };
  return null;
}

export function S3Room({ data, actions, openCoach }: { data: NonNullable<Actions["data"]>; actions: Actions; openCoach: () => void }) {
  const { room: live, me } = data;
  const reduce = useReducedMotion();
  // Group completion: briefly hold the full "4 of 4" state before the next screen appears (display only —
  // the server has already advanced; polling cannot cancel the hold).
  const prev = useRef<PublicRoom | null>(null);
  const [held, setHeld] = useState<PublicRoom | null>(null);
  useEffect(() => {
    const p = prev.current;
    prev.current = live;
    if (!p) return;
    const v = completedView(p, live);
    if (v) setHeld(v);
  }, [live]);
  useEffect(() => {
    if (!held) return;
    const t = window.setTimeout(() => setHeld(null), reduce ? 350 : 650);
    return () => window.clearTimeout(t);
  }, [held, reduce]);
  const r = held || live;
  if (r.status === "lobby") return <Lobby r={r} me={me} actions={actions} />;
  if (r.status === "setup") return <Prep r={r} me={me} actions={actions} />;
  return <GameHome r={r} me={me} actions={actions} openCoach={openCoach} conn={actions.conn} />;
}

// ----------------------------------------------------------------------------------------- lobby
function Lobby({ r, me, actions }: { r: PublicRoom; me: string; actions: Actions }) {
  const router = useRouter();
  const { act, busy, error } = useAct(actions);
  const [qrOpen, setQrOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const origin = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const u = `${origin.replace(/\/$/, "")}/join/${r.code}`;
    setUrl(u);
    QRCode.toDataURL(u, { width: 440, margin: 1, color: { dark: "#171717", light: "#ffffff" } }).then(setQr).catch(() => setQr(null));
  }, [r.code]);
  const n = r.players.length;
  const ready = r.lobbyReady || {};
  const mine = !!ready[me];
  const all = n === 4 && r.players.every((p) => ready[p.id]);
  const share = async () => {
    const text = `Join my Mahjong Together table: room ${r.code}`;
    try {
      if (navigator.share) await navigator.share({ title: "Mahjong Together", text, url });
      else { await navigator.clipboard?.writeText(`${text} ${url}`); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    } catch {}
  };
  const anyAI = r.players.some(isAI);
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Header title="Mahjong Together" onBack={() => router.push("/")} />
      <main className="flex-1 px-4 pt-6 pb-5 flex flex-col gap-7">
        <div>
          <h1 className="t-app text-green-text">Your Table</h1>
          <p className="t-sub text-muted mt-0.5">Room {r.code} · Sichuan Mahjong</p>
        </div>
        <FourPlayerStatus players={r.players} me={me} showOpenSeats countLabel="Ready" doneLabel="Ready"
          state={(p) => (ready[p.id] ? "done" : "waiting")} />
        <p className="t-sub text-muted text-center -mt-3" aria-live="polite">{all ? "Everyone's ready." : n < 4 ? `${n} of 4 seats filled · ${4 - n} more to join` : mine ? "Waiting for the group…" : "Tap I'm Ready when you're at the table."}</p>
        {anyAI && <p className="t-meta text-muted text-center">This demo includes simulated participants.</p>}
        {!r.matched && (
          <div className="grid grid-cols-2 gap-2">
            <Btn variant="secondary" className="px-2 text-[14px] bg-card" onClick={share}><Share2 size={16} strokeWidth={1.75} /> {copied ? "Copied" : "Share Room Code"}</Btn>
            <Btn variant="secondary" className="px-2 text-[14px] bg-card" onClick={() => setQrOpen(true)}><QrCode size={16} strokeWidth={1.75} /> Show QR Code</Btn>
          </div>
        )}
      </main>
      <div className="sticky bottom-0 bg-page px-4 pt-3 pb-safe border-t border-line flex flex-col gap-2">
        {error && <p className={ERR + " text-center"} role="alert">{error}</p>}
        <Btn className="w-full mb-3" variant={mine ? "ok" : "primary"} disabled={busy || mine} onClick={() => act({ type: "lobby-ready" })}>
          {mine ? <><Check size={16} /> I'm Ready</> : "I'm Ready"}
        </Btn>
      </div>
      <Sheet open={qrOpen} onClose={() => setQrOpen(false)} title="Show QR Code">
        <div className="flex flex-col items-center gap-3 pb-2">
          <div className="h-[232px] w-[232px] rounded-xl border border-line p-2 bg-white flex items-center justify-center">
            {qr ? <img src={qr} alt={`QR code to join room ${r.code}`} width={212} height={212} /> : <span className="t-meta text-muted">Generating…</span>}
          </div>
          <p className="t-section tracking-wide">{r.code}</p>
          {/localhost|127\.0\.0\.1/.test(url) && <p className="t-meta text-muted text-center">Other phones can't open localhost. Open the site from this computer's network address to share the QR code.</p>}
        </div>
      </Sheet>
    </div>
  );
}

// ----------------------------------------------------------------------------------------- preparation
const STEP_COPY: Record<string, { n: number; helpLabel: string }> = {
  "sc-tiles": { n: 1, helpLabel: "How to prepare the tiles" },
  "sc-wall": { n: 2, helpLabel: "How to build the wall" },
  "sc-exchange": { n: 3, helpLabel: "How to exchange three tiles" },
  "sc-dingque": { n: 4, helpLabel: "Need Explanation" },
};
const SUITS = [{ id: "c", name: "Characters", face: { s: "c", n: 5 } }, { id: "b", name: "Bamboo", face: { s: "b", n: 5 } }, { id: "d", name: "Dots", face: { s: "d", n: 5 } }] as const;
const SUIT_NAME: Record<string, string> = { c: "Characters", b: "Bamboo", d: "Dots" };
function MiniTile({ face }: { face: { s: "c" | "b" | "d"; n: number } }) {
  return <svg viewBox="-17 -22 34 50" className="h-9 w-auto" aria-hidden><g dangerouslySetInnerHTML={{ __html: tileArt(face) }} /></svg>;
}
const STEP_TEXT: Record<string, { title: string; line: string }> = {
  "sc-tiles": { title: "Prepare 108 Tiles", line: "Keep only Characters, Bamboo, and Dots." },
  "sc-wall": { title: "Build Your Wall", line: "Arrange your tiles into the four table walls." },
  "sc-exchange": { title: "Exchange 3 Tiles", line: "Choose 3 tiles of the same suit and pass them together." },
  "sc-dingque": { title: "Choose Your Missing Suit", line: "Pick one suit to discard before you can win." },
};

function Prep({ r, me, actions }: { r: PublicRoom; me: string; actions: Actions }) {
  const router = useRouter();
  const { act, busy, error } = useAct(actions);
  const [help, setHelp] = useState(false);
  const stepId = r.stepId || "sc-tiles";
  const copy = STEP_COPY[stepId] || STEP_COPY["sc-tiles"];
  const text = STEP_TEXT[stepId] || STEP_TEXT["sc-tiles"];
  const dir = r.decisions.exchangeDir;
  const mine = r.resp[me] === "ready";
  const readyCount = r.players.filter((p) => r.resp[p.id] === "ready").length;
  const anyAI = r.players.some(isAI);
  const myPick = r.dingQue?.[me];
  const needsPick = stepId === "sc-dingque" && !myPick;

  // Help is per player; it only toggles an informational "viewing" flag and never touches confirmations.
  const helpFor = useRef<string | null>(null);
  useEffect(() => {
    if (help) { helpFor.current = stepId; actions.act({ type: "step-help", stepId, open: true }).catch(() => {}); }
    else if (helpFor.current) { const id = helpFor.current; helpFor.current = null; actions.act({ type: "step-help", stepId: id, open: false }).catch(() => {}); }
  }, [help]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (help && helpFor.current && helpFor.current !== stepId) setHelp(false); }, [stepId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { window.scrollTo(0, 0); }, [stepId, help]);
  // After a refresh the help view is closed, so clear a stale "viewing help" flag (confirmations untouched).
  useEffect(() => { if (r.viewing?.[me] && !helpFor.current) actions.act({ type: "step-help", stepId, open: false }).catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (help) return <HelpView stepId={stepId} dir={dir} onBack={() => setHelp(false)} />;

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Header title="Your Table" titleClassName="text-green-text" subtitle={`Sichuan Mahjong${anyAI ? " · Demo AI seats" : ""}`} onBack={() => router.push("/")} />
      <main className="flex-1 px-4 pt-5 pb-4 flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="t-meta text-muted font-medium">Step {copy.n} of 4</span>
            <span className="flex-1 flex gap-1 max-w-[120px]" aria-hidden>{[1, 2, 3, 4].map((i) => <span key={i} className={cx("h-1 flex-1 rounded-full", i <= copy.n ? "bg-green" : "bg-line")} />)}</span>
          </div>
          <h1 className="t-app text-green-text">{text.title}</h1>
          <p className="t-body text-ink/80">{text.line}</p>
          {stepId === "sc-exchange" && (
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="t-meta font-medium px-2.5 py-1 rounded-full border border-green text-green-text bg-green-soft">Same suit only</span>
              {dir && <span className="t-meta font-medium px-2.5 py-1 rounded-full border border-line bg-bubble">Direction: {DIR_TEXT[dir]?.short}</span>}
            </div>
          )}
        </div>
        <div className="rounded-[16px] border border-green bg-card p-3 flex flex-col gap-2 w-full max-w-[400px] self-center">
          {stepId === "sc-tiles" && <>
            <ArtVisual id="step-1-prepare-tiles" />
            <div className="grid grid-cols-3 text-center t-meta text-muted -mt-1"><span>Characters</span><span>Bamboo</span><span>Dots</span></div>
          </>}
          {stepId === "sc-wall" && <>
            <ArtVisual id="step-2-build-wall" />
            <p className="t-meta text-muted text-center -mt-1">Stacks of 2 · walls of 14, 13, 14, 13 stacks · 108 tiles</p>
          </>}
          {stepId === "sc-exchange" && <>
            <ArtVisual id="step-3-exchange-tiles" dir={dir} />
            {dir && <p className="t-meta text-muted text-center -mt-1">Pass all three to {DIR_TEXT[dir]?.who}.</p>}
          </>}
          {stepId === "sc-dingque" && <>
            <ArtVisual id="step-4-ding-que" />
            <div className="grid grid-cols-3 text-center t-meta text-muted -mt-1"><span>Characters</span><span>Bamboo<br /><span className="text-green-text">example</span></span><span>Dots</span></div>
          </>}
        </div>
        {stepId === "sc-dingque" && (
          <fieldset className="flex flex-col gap-2">
            <legend className="t-section mb-2">{mine ? `Your missing suit: ${SUIT_NAME[myPick || ""] || ""}` : "Your missing suit"}</legend>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Your missing suit">
              {SUITS.map((x) => (
                <button key={x.id} type="button" role="radio" aria-checked={myPick === x.id} disabled={mine || busy}
                  onClick={() => act({ type: "dingque-pick", stepId, suit: x.id })}
                  className={cx("min-h-[76px] rounded-[14px] border flex flex-col items-center justify-center gap-1 px-1", myPick === x.id ? "border-green bg-green-soft border-[1.5px]" : "border-line bg-card", mine && myPick !== x.id && "opacity-40")}>
                  <MiniTile face={x.face} />
                  <span className="t-meta font-medium">{x.name}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {anyAI && <p className="t-meta text-muted">This demo includes simulated participants. People at the table handle the physical tiles.</p>}
        <FourPlayerStatus players={r.players} me={me} countLabel="Ready" doneLabel="Ready" className="pt-1"
          state={(p) => (r.resp[p.id] === "ready" ? "done" : r.viewing?.[p.id] ? "help" : "waiting")} />
      </main>
      <div className="sticky bottom-0 bg-page px-4 pt-3 pb-safe border-t border-line flex flex-col gap-2">
        {error && <p className={ERR + " text-center"} role="alert">{error}</p>}
        <div className="flex gap-2 items-stretch">
          <button type="button" onClick={() => setHelp(true)} aria-label={copy.helpLabel} title={copy.helpLabel}
            className="h-12 w-12 shrink-0 rounded-[14px] border border-line bg-card flex items-center justify-center text-ink hover:bg-hover">
            <CircleHelp size={22} strokeWidth={1.75} />
          </button>
          <Btn className="flex-1" variant={mine ? "ok" : "primary"} disabled={busy || mine || needsPick} aria-label={stepId === "sc-dingque" ? "I've Chosen" : "I've done this"}
            onClick={() => act({ type: "respond", stepId, value: "ready", ...(stepId === "sc-dingque" ? { suit: myPick } : {}) })}>
            <Check size={18} strokeWidth={2.5} /> {mine ? "Done" : stepId === "sc-dingque" ? "I've Chosen" : "I've done this"}
          </Btn>
        </div>
        <p className="t-meta text-muted text-center mb-1 min-h-4" aria-live="polite">{mine && readyCount < 4 ? "Waiting for the group…" : ""}</p>
      </div>
    </div>
  );
}

// Stable (module-level) building blocks: defining these inside a render made React remount the
// animations on every room poll, restarting them mid-motion.
/** Help section: a pure-white card with a green section label and charcoal text. */
function Sec({ h, t, children }: { h: string; t: string; children?: React.ReactNode }) {
  return (
    <section className="rounded-[18px] bg-card border border-line p-4 flex flex-col gap-2">
      <h2 className="t-section text-green-text">{h}</h2>
      <p className="t-body text-ink/80">{t}</p>
      {children}
    </section>
  );
}
/** Illustration area inside a help card: pale sage, so ivory tile faces stay clearly visible. */
function Frame({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[14px] bg-sage p-3 flex flex-col gap-2 w-full max-w-[400px] self-center mt-1">{children}</div>;
}
function Opt({ id, label, sub, value, set }: { id: string; label: string; sub?: string; value: string; set: (v: string) => void }) {
  return (
    <button type="button" onClick={() => set(id)} aria-pressed={value === id}
      className={cx("w-full text-left min-h-14 px-3 py-2.5 rounded-[14px] border flex items-center gap-3", value === id ? "border-green bg-green-soft border-[1.5px]" : "border-line bg-card")}>
      <span className={cx("h-5 w-5 rounded-full border shrink-0 flex items-center justify-center", value === id ? "bg-green border-green text-white" : "border-dash")}>{value === id && <Check size={12} strokeWidth={3} />}</span>
      <span className="flex-1 min-w-0"><span className="block t-body font-medium">{label}</span>{sub && <span className="block t-meta text-muted">{sub}</span>}</span>
    </button>
  );
}

/** Dedicated help screen for ONE step: How to · Check/Next/Set Aside · Why. Back returns to the same step. */
function HelpView({ stepId, dir, onBack }: { stepId: string; dir?: string; onBack: () => void }) {
  const title = stepId === "sc-dingque" ? "What Is Ding Que?" : STEP_TEXT[stepId]?.title || "Help";
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Header title={title} titleClassName="text-green-text" onBack={onBack} backLabel="Back" />
      <main className="flex-1 px-4 pt-5 pb-4 flex flex-col gap-4">
        <h1 className="t-app text-green-text">{title}</h1>
        {stepId === "sc-tiles" && <>
          <Sec h="How to" t="Keep four copies of each numbered tile, 1–9, in all three suits.">
            <Frame><ArtVisual id="step-1-help-27-types" /><p className="t-meta text-muted text-center -mt-1">Characters · Bamboo · Dots, 1–9, ×4 each = 108</p></Frame>
          </Sec>
          <Sec h="Set Aside" t="Remove Winds, Dragons, Flowers, and any extra tiles.">
            <Frame><ArtVisual id="step-1-help-tile-selection" /><div className="grid grid-cols-[2fr_1fr] text-center t-meta text-muted -mt-1"><span>Keep</span><span>Set aside</span></div></Frame>
          </Sec>
          <Sec h="Why" t="This version of Sichuan Mahjong uses 108 suited tiles." />
        </>}
        {stepId === "sc-wall" && <>
          <Sec h="How to" t="Divide all 108 tiles into four walls around the table.">
            <Frame><ArtVisual id="step-2-help-wall-stacking" /><p className="t-meta text-muted text-center -mt-1">Stack tiles two high · top and bottom walls 14 stacks, left and right 13</p></Frame>
          </Sec>
          <Sec h="Check" t="Make sure no tiles are left out.">
            <Frame><ArtVisual id="step-2-build-wall" /><p className="t-meta text-muted text-center -mt-1">(14 + 14 + 13 + 13) stacks × 2 = 108 tiles</p></Frame>
          </Sec>
          <Sec h="Why" t="The walls hold the tiles for drawing during play." />
          <p className="t-meta text-muted px-1">Then pick a dealer and deal as your table usually does: the dealer takes 14 tiles, everyone else 13.</p>
        </>}
        {stepId === "sc-exchange" && <>
          <Sec h="How to" t="Pick any three tiles from ONE suit: Characters, Bamboo, or Dots.">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-[14px] bg-sage p-2 flex flex-col gap-1"><ArtVisual id="step-3-help-same-suit" /><span className="t-meta font-semibold text-green-text text-center">SAME SUIT ✓</span></div>
              <div className="rounded-[14px] bg-surface p-2 flex flex-col gap-1"><ArtVisual id="step-3-help-mixed-suits" /><span className="t-meta font-semibold text-muted text-center">MIXED SUITS ✕</span></div>
            </div>
          </Sec>
          <Sec h="Next" t="Pass all three together in the direction shown.">
            <Frame><ArtVisual id="step-3-help-exchange" dir={dir} />{dir && <p className="t-meta text-muted text-center -mt-1">{DIR_TEXT[dir]?.short}: everyone passes to {DIR_TEXT[dir]?.who.replace("your", "their").replace("you", "them")} at the same time.</p>}</Frame>
          </Sec>
          <Sec h="Why" t="The exchange adds variety to starting hands." />
        </>}
        {stepId === "sc-dingque" && <>
          <Sec h="How to" t="Choose one suit as your missing suit. You must discard all tiles of that suit before winning.">
            <Frame><ArtVisual id="step-4-ding-que" /><div className="grid grid-cols-3 text-center t-meta text-muted -mt-1"><span>Characters</span><span className="text-green-text">Missing suit</span><span>Dots</span></div></Frame>
          </Sec>
          <Sec h="Example" t="If you choose Bamboo, discard all Bamboo tiles before declaring a win.">
            <Frame><ArtVisual id="step-4-help-ding-que" /><p className="t-meta text-muted text-center -mt-1">One Bamboo tile per turn, until none are left in your hand.</p></Frame>
          </Sec>
          <Sec h="Why?" t="Ding Que is a key Sichuan Mahjong rule that shapes how you play your hand." />
        </>}
      </main>
      <div className="sticky bottom-0 bg-page px-4 pt-3 pb-safe border-t border-line">
        <Btn className="w-full mb-3" onClick={onBack}>Back to Step</Btn>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------------------- gameplay home
function GameHome({ r, me, actions, openCoach, conn }: { r: PublicRoom; me: string; actions: Actions; openCoach: () => void; conn: string }) {
  const router = useRouter();
  const { act, busy, error } = useAct(actions);
  const reduce = useReducedMotion();
  const { totals } = useScores(r);
  const [win, setWin] = useState<null | { revise?: GameEvent }>(null);
  const [endAsk, setEndAsk] = useState(false);
  const [scores, setScores] = useState(false);
  const [record, setRecord] = useState(false);
  const [declined, setDeclined] = useState(false);
  const confettiRef = useRef<ConfettiRef>(null);
  const confettiOpts = useMemo(() => ({ resize: true, useWorker: true }), []);
  const pendingWins = (r.events || []).filter((e) => e.status === "pending" && e.type === "win");
  const pendingOther = (r.events || []).filter((e) => e.status === "pending" && e.type !== "win");
  const lastVerified = [...(r.events || [])].filter((e) => e.status === "committed" && e.type === "win").sort((a, b) => (b.committedAt || 0) - (a.committedAt || 0))[0];
  const playing = r.status === "playing";

  // Confetti once when this player enters Ready to Play after preparation (not on polling, rerenders or later
  // visits). The "seen" mark is written only when the first burst really fires (safe under React Strict Mode).
  useEffect(() => {
    if (r.status !== "playing" || reduce) return;
    const key = `mt.readyConfetti.${r.code}`;
    if (seenKey("local", key)) return;
    return gentleConfetti(confettiRef, { delay: 300, onStart: () => markKey("local", key) });
  }, [r.status, r.code, reduce]);

  // The existing small declaration accent when a player DECLARES a win (not a verified win), once per event.
  const declIds = pendingWins.map((e) => e.id).join(",");
  useEffect(() => {
    if (reduce) return;
    const fresh = pendingWins.find((e) => Date.now() - e.createdAt < 60000 && !seenKey("local", `mt.seenDecl.${e.id}`));
    if (!fresh) return;
    return smallConfetti(confettiRef, () => markKey("local", `mt.seenDecl.${fresh.id}`));
  }, [declIds, reduce]); // eslint-disable-line react-hooks/exhaustive-deps

  // "The game will continue." once on every phone after someone declines ending.
  useEffect(() => {
    const d = r.endDeclined;
    if (!d || Date.now() - d.at > 20000 || seenKey("session", `mt.endDeclined.${d.id}`)) return;
    markKey("session", `mt.endDeclined.${d.id}`);
    setDeclined(true);
  }, [r.endDeclined]);
  useEffect(() => {
    if (!declined) return;
    const t = window.setTimeout(() => setDeclined(false), 4000);
    return () => window.clearTimeout(t);
  }, [declined]);

  const myPts = totals[me] || 0;
  const iWon = !!r.hand?.winners.includes(me);
  const myPending = pendingWins.some((e) => e.actor === me);

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Confetti ref={confettiRef} manualstart globalOptions={confettiOpts} className="pointer-events-none fixed inset-0 z-30 w-full h-full" aria-hidden />
      <Header title="Your Table" titleClassName="text-green-text" subtitle={`Sichuan Mahjong${r.players.some(isAI) ? " · Demo AI seats" : ""}`} onBack={() => router.push("/")}
        right={<IconBtn label="Private Assistant" onClick={openCoach}><MessageCircleQuestion size={20} strokeWidth={1.75} /></IconBtn>}>
        {conn === "retrying" && <div className="px-4 py-1.5 t-meta text-muted border-t border-line">Reconnecting…</div>}
      </Header>
      <main className="flex-1 px-4 py-6 flex flex-col gap-6">
        {playing && pendingWins.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 min-h-[38dvh]">
            <h1 className="text-[26px] leading-[34px] font-semibold text-green-text">You&apos;re Ready to Play!</h1>
            <p className="t-body text-muted">Have fun!</p>
            <button onClick={openCoach} className="t-sub text-muted mt-4 min-h-11 underline-offset-4 hover:underline">Need help? Open your Private Assistant.</button>
          </div>
        )}
        {declined && (
          <div className="text-center bg-card border border-line rounded-[16px] px-4 py-3" role="status">
            <p className="t-section text-green-text">Game Continues</p>
            <p className="t-sub text-muted">Not everyone agreed to end the session.</p>
          </div>
        )}
        {(playing || r.status === "hand_review") && (
          <button onClick={() => setScores(true)} className="self-center flex items-center gap-2 h-9 px-3 rounded-full border border-line bg-card t-sub">
            <span className="text-muted">Your points</span><span className="font-semibold tabular-nums">{signed(myPts)} pts</span>
            <span className="text-muted">· Hand {r.hand?.n ?? 1}</span>
          </button>
        )}
        {r.hand?.dingQue?.[me] && (playing || r.status === "hand_review") && pendingWins.length === 0 && (
          <p className="t-meta text-muted text-center -mt-3">Your missing suit: {SUIT_NAME[r.hand.dingQue[me]]}</p>
        )}
        {lastVerified && playing && pendingWins.length === 0 && (
          <p className="t-meta text-muted text-center -mt-3">Verified: {describeEvent(r, lastVerified).title}</p>
        )}
        {r.status !== "reconciling" && pendingWins.map((e) => (
          <WinReview key={e.id} r={r} me={me} e={e} act={act} busy={busy} onEdit={() => setWin({ revise: e })} />
        ))}
        {r.status !== "reconciling" && pendingOther.map((e) => (
          <EventCard key={e.id} r={r} me={me} e={e} act={act} busy={busy} onExplain={() => {}} onCorrect={() => setRecord(true)} />
        ))}
        {r.status === "hand_review" && r.hand && <HandReviewPanel r={r} me={me} act={act} busy={busy} openRecord={() => setRecord(true)} openScores={() => setScores(true)} />}
        {r.status === "reconciling" && <>
          <ReconcilePanel r={r} act={act} busy={busy} openRecord={() => setRecord(true)} />
          {(r.events || []).filter((e) => e.status === "pending").map((e) => <EventCard key={e.id} r={r} me={me} e={e} act={act} busy={busy} onExplain={() => {}} onCorrect={() => setRecord(true)} />)}
        </>}
        {r.status === "session_review" && r.finalReview && <FinalReview r={r} me={me} act={act} busy={busy} />}
        {error && <p className={ERR} role="alert">{error}</p>}
      </main>
      {playing && (
        <div className="sticky bottom-0 bg-page px-4 pt-3 pb-safe border-t border-line">
          <div className="grid grid-cols-2 gap-2 mb-3">
            <Btn disabled={busy || iWon || myPending} onClick={() => setWin({})}>Win</Btn>
            <Btn variant="secondary" className="bg-card" disabled={busy || !!r.endProposal} onClick={() => setEndAsk(true)}>End Game</Btn>
          </div>
        </div>
      )}

      {win && <WinFlow r={r} me={me} act={act} busy={busy} revise={win.revise} onClose={() => setWin(null)} openCoach={openCoach} />}
      {r.endProposal && <EndVote r={r} me={me} act={act} busy={busy} />}
      <Sheet open={endAsk} onClose={() => setEndAsk(false)} title="End the Game?">
        <p className="t-body">Everyone must agree to finish this session.</p>
        <div className="grid grid-cols-1 gap-2 mt-5">
          <Btn disabled={busy} onClick={() => { setEndAsk(false); act({ type: "end-propose" }); }}>Yes, End Game</Btn>
          <Btn variant="secondary" onClick={() => setEndAsk(false)}>Keep Playing</Btn>
        </div>
      </Sheet>
      <ScoresSheet r={r} me={me} open={scores} onClose={() => setScores(false)} />
      <RecordEventSheet r={r} me={me} open={record} onClose={() => setRecord(false)} act={act} busy={busy} />
    </div>
  );
}

// ----------------------------------------------------------------------------------------- final review
/** Brief ledger check after play has stopped (distinct from the decision to end — no second end vote). */
function FinalReview({ r, me, act, busy }: { r: PublicRoom; me: string; act: Act; busy: boolean }) {
  const { totals } = useScores(r);
  const f = r.finalReview!;
  const mine = f.resp[me];
  return (
    <section className="flex flex-col gap-5" aria-label="Review Final Scores">
      <div>
        <h1 className="t-app text-green-text">Review Final Scores</h1>
        <p className="t-body text-muted mt-1">Only verified points count.</p>
      </div>
      <ul className="border border-line rounded-2xl divide-y divide-line bg-card">
        {[...r.players].sort((a, b) => (totals[b.id] || 0) - (totals[a.id] || 0)).map((p) => (
          <li key={p.id} className="min-h-12 px-3 flex items-center justify-between t-body">
            <span className="truncate">{p.name}{isAI(p) && <span className="text-muted"> · AI Player</span>}</span>
            <span className="font-semibold tabular-nums">{signed(totals[p.id] || 0)} pts</span>
          </li>
        ))}
      </ul>
      <FourPlayerStatus players={r.players} me={me} countLabel="Confirmed" doneLabel="Confirmed" aiDoneLabel="Simulated"
        state={(p) => (f.resp[p.id] === "confirm" ? "done" : "waiting")} />
      <div className="flex flex-col gap-2">
        <Btn variant={mine === "confirm" ? "ok" : "primary"} disabled={busy || mine === "confirm"} onClick={() => act({ type: "final-respond", ledgerVersion: r.ledgerVersion || 0, value: "confirm" })}>
          {mine === "confirm" ? <><Check size={16} /> Confirmed</> : "Confirm Final Scores"}
        </Btn>
        <Btn variant="secondary" disabled={busy} onClick={() => act({ type: "final-respond", ledgerVersion: r.ledgerVersion || 0, value: "correct" })}>Request Correction</Btn>
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------------------- end vote
function EndVote({ r, me, act, busy }: { r: PublicRoom; me: string; act: Act; busy: boolean }) {
  const pr = r.endProposal!;
  const mine = pr.votes[me];
  const agreed = r.players.filter((p) => pr.votes[p.id] === "agree").length;
  return (
    <div className="fixed inset-0 z-40 bg-page flex flex-col" role="dialog" aria-modal aria-label="End the Game?">
      <div className="flex-1 overflow-y-auto px-4 pt-[max(32px,env(safe-area-inset-top))] pb-4 flex flex-col gap-8 max-w-[430px] w-full mx-auto">
        <div className="text-center">
          <h1 className="t-app text-green-text">End the Game?</h1>
          <p className="t-body text-muted mt-1">Waiting for everyone&apos;s decision.</p>
        </div>
        {/* Same waiting ring as Random Match: motion = still waiting; the number = real "agree" votes (4 required). */}
        <div className="self-center"><WaitingProgressRing current={agreed} total={4} label="agreed" active={agreed < 4} /></div>
        <FourPlayerStatus players={r.players} me={me} doneLabel="Agreed" aiDoneLabel="Demo vote"
          state={(p) => (pr.votes[p.id] === "agree" ? "done" : "waiting")} />
        {r.players.some(isAI) && <p className="t-meta text-muted text-center -mt-4">This demo includes simulated participants.</p>}
      </div>
      <div className="px-4 pt-3 pb-safe border-t border-line max-w-[430px] w-full mx-auto">
        <div className="grid grid-cols-1 gap-2 mb-3">
          {mine !== "agree" && <Btn disabled={busy} onClick={() => act({ type: "end-vote", proposalId: pr.id, value: "agree" })}>Yes, End Game</Btn>}
          <Btn variant="secondary" className="bg-card" disabled={busy} onClick={() => act({ type: "end-vote", proposalId: pr.id, value: "keep" })}>Keep Playing</Btn>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------------------- shared win review
const METHOD_LABEL: Record<string, string> = { self_draw: "Self-Draw (Zi Mo)", discard: "From a Discard (Dian Pao)", kong_replacement: "After a Kong", robbing_kong: "Robbing a Kong" };
const PATTERN_LABEL: Record<string, string> = { standard: "Standard Hand", seven_pairs: "Seven Pairs", all_pungs: "All Pungs", other: "Not Sure" };
function patternText(c: Partial<WinClaim>) {
  const bits = [PATTERN_LABEL[c.structure || "standard"]];
  if (c.pureSuit) bits.push("Full Flush");
  if (c.roots) bits.push(`Roots ×${c.roots}`);
  return bits.join(" · ");
}
function Transfers({ r, transfers, to }: { r: PublicRoom; transfers: { from: string; to: string; amount: number }[]; to: string }) {
  const total = transfers.filter((t) => t.to === to).reduce((s, t) => s + t.amount, 0);
  return (
    <div className="flex flex-col gap-0.5">
      <span className="t-body font-semibold tabular-nums">{signed(total)} pts to {pname(r, to)}</span>
      {transfers.map((t, i) => <span key={i} className="t-meta text-muted">{pname(r, t.from)} pays {t.amount}</span>)}
    </div>
  );
}

function WinReview({ r, me, e, act, busy, onEdit }: { r: PublicRoom; me: string; e: GameEvent; act: Act; busy: boolean; onEdit: () => void }) {
  const [correcting, setCorrecting] = useState(false);
  const [note, setNote] = useState("");
  const [rule, setRule] = useState(false);
  const c = e.claim as Partial<WinClaim>;
  const mine = e.approvals[me];
  const disputed = Object.values(e.approvals).includes("dispute");
  const declarer = e.actor === me;
  const ruleEntry = entryById("sc-scoring");
  return (
    <section id={`event-${e.id}`} aria-label={`${pname(r, e.actor)} Declared a Win`} className={cx("border rounded-2xl bg-card p-4 shadow-card flex flex-col gap-4", disputed ? "border-[#FF9F0A]" : "border-line")}>
      <div className="flex flex-col gap-1">
        <span className="self-start t-meta font-medium px-2 py-0.5 rounded-full bg-surface text-muted">Pending Verification</span>
        <h2 className="t-page text-green-text">{pname(r, e.actor)} Declared a Win</h2>
        <p className="t-sub text-muted">Check the revealed tiles together.</p>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 t-sub">
        <dt className="text-muted">Winning Method</dt><dd>{METHOD_LABEL[String(c.method)] || "—"}{c.fromId ? ` · from ${pname(r, c.fromId)}` : ""}</dd>
        <dt className="text-muted">Hand Pattern</dt><dd>{patternText(c)}</dd>
        <dt className="text-muted">Proposed Points</dt><dd><Transfers r={r} transfers={e.transfers} to={e.actor || ""} /></dd>
      </dl>
      {disputed && <p className="t-sub font-medium text-[#B25000] dark:text-[#FFB340]">Correction requested — talk it through, then {declarer ? "edit your win" : "the declarer can edit it"}.</p>}
      <div className="flex flex-col gap-2">
        <FourPlayerStatus players={r.players} me={me} countLabel="Confirmed" doneLabel="Confirmed" aiDoneLabel="Simulated"
          state={(p) => (e.approvals[p.id] === "confirm" ? "done" : "waiting")}
          labelFor={(p) => (e.approvals[p.id] === "dispute" ? "Correction" : undefined)} />
        {r.players.some(isAI) && <p className="t-meta text-muted">AI Players can't see physical tiles. Their confirmations are simulated for this demo.</p>}
      </div>
      <div className="flex flex-col gap-2">
        <Btn variant={mine === "confirm" ? "ok" : "primary"} disabled={busy || mine === "confirm"} onClick={() => act({ type: "event-respond", eventId: e.id, rev: e.rev, value: "confirm" })}>
          {mine === "confirm" ? <><Check size={16} /> Confirmed</> : "Confirm Score"}
        </Btn>
        <div className="grid grid-cols-2 gap-2">
          {declarer
            ? <Btn variant="secondary" className="px-2 text-[14px]" disabled={busy} onClick={onEdit}>Edit</Btn>
            : <Btn variant={mine === "dispute" ? "chosen" : "secondary"} className="px-2 text-[14px]" disabled={busy} onClick={() => setCorrecting(!correcting)}>Request Correction</Btn>}
          <Btn variant="secondary" className="px-2 text-[14px]" onClick={() => setRule(true)}>View Rule</Btn>
        </div>
        {declarer && <button className="t-sub text-muted min-h-10" disabled={busy} onClick={() => act({ type: "event-revise", eventId: e.id, rev: e.rev, void: true })}>{e.voidProposed ? "Withdrawal requested" : "Withdraw Win"}</button>}
      </div>
      {correcting && (
        <div className="rounded-[12px] bg-surface p-3 flex flex-col gap-2">
          <input value={note} onChange={(ev) => setNote(ev.target.value)} maxLength={200} placeholder="What should change? (optional)" className="h-11 px-3 rounded-xl border border-line bg-bg outline-none focus:border-green" />
          <Btn variant="secondary" disabled={busy} onClick={() => { act({ type: "event-respond", eventId: e.id, rev: e.rev, value: "dispute", note }); setCorrecting(false); }}>Request Correction</Btn>
        </div>
      )}
      <Sheet open={rule} onClose={() => setRule(false)} title={ruleEntry?.topic || "Scoring"}>
        <Prose text={ruleEntry?.detail || e.lines.join("\n")} />
        <ul className="t-meta text-muted mt-3 flex flex-col gap-0.5">{e.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
        <p className="t-meta text-muted mt-3 pt-3 border-t border-line">Rule: {e.ruleVersion}</p>
      </Sheet>
    </section>
  );
}

// ----------------------------------------------------------------------------------------- win flow
type Stage = "intro" | "method" | "pattern" | "review";
function WinFlow({ r, me, act, busy, revise, onClose, openCoach }: { r: PublicRoom; me: string; act: Act; busy: boolean; revise?: GameEvent; onClose: () => void; openCoach: () => void }) {
  const init = (revise?.claim || {}) as Partial<WinClaim>;
  const [stage, setStage] = useState<Stage>(revise ? "method" : "intro");
  const [method, setMethod] = useState<string>(init.method || "");
  const [fromId, setFromId] = useState<string>(init.fromId || "");
  const [structure, setStructure] = useState<string>(init.structure || "");
  const [pure, setPure] = useState(!!init.pureSuit);
  const [roots, setRoots] = useState(init.roots || 0);
  const [twoSuits, setTwoSuits] = useState(!!revise);
  const [examples, setExamples] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const idem = useRef(`win-${me}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const myDQ = r.hand?.dingQue?.[me];
  const winners = r.hand?.winners || [];
  const active = r.players.map((p) => p.id).filter((id) => !winners.includes(id));
  const others = r.players.filter((p) => p.id !== me && active.includes(p.id));
  const claim: WinClaim = { method: (method === "unsure" ? "self_draw" : method || "self_draw") as WinClaim["method"], fromId: method === "discard" ? fromId : undefined, structure: (structure === "unsure" ? "other" : structure || "standard") as WinClaim["structure"], pureSuit: pure, roots, missingSuitCleared: twoSuits ? "yes" : undefined };
  const calc = useMemo(() => winCalc(me, claim, active, (id) => pname(r, id)), [JSON.stringify(claim), active.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const possible = calc.transfers.filter((t) => t.to === me).reduce((s, t) => s + t.amount, 0);
  const methodOk = method && method !== "unsure" && (method !== "discard" || !!fromId);
  const patternOk = structure && structure !== "unsure" && twoSuits;

  const declare = async () => {
    setErr(null);
    try {
      if (revise) await act({ type: "event-revise", eventId: revise.id, rev: revise.rev, claim });
      else await act({ type: "event-submit", eventType: "win", idem: idem.current, claim });
      onClose();
    } catch (e) { setErr((e as Error).message); }
  };

  const back = () => (stage === "review" ? setStage("pattern") : stage === "pattern" ? setStage("method") : stage === "method" && !revise ? setStage("intro") : onClose());

  let body: React.ReactNode; let footer: React.ReactNode;
  if (stage === "intro") {
    body = (<div className="flex-1 flex flex-col justify-center gap-2 text-center min-h-[40dvh]">
      <h1 className="t-app text-green-text">Think You Won?</h1>
      <p className="t-body text-muted">Check your win before sharing it.</p>
    </div>);
    footer = <><Btn onClick={() => setStage("method")}>Yes, Check My Win</Btn><Btn variant="secondary" onClick={onClose}>Not Yet</Btn></>;
  } else if (stage === "method") {
    body = (<>
      <div><h1 className="t-app text-green-text">How Did You Win?</h1><p className="t-body text-muted mt-1">Choose how you got your winning tile.</p></div>
      <div className="flex flex-col gap-2">
        <Opt id="self_draw" label="Self-Draw (Zi Mo)" sub="Self-Draw — You drew the winning tile." value={method} set={setMethod} />
        <Opt id="discard" label="From a Discard (Dian Pao)" sub="From a Discard — Another player discarded it." value={method} set={setMethod} />
        <Opt id="kong_replacement" label="After a Kong" sub="You drew the winning tile right after your own kong." value={method} set={setMethod} />
        <Opt id="unsure" label="I'm Not Sure" value={method} set={setMethod} />
      </div>
      {method === "discard" && (
        <fieldset className="flex flex-col gap-2">
          <legend className="t-section mb-2">Who discarded the tile?</legend>
          <div className="grid grid-cols-1 gap-2">
            {others.map((p) => <Opt key={p.id} id={p.id} label={p.name} sub={isAI(p) ? "AI Player" : undefined} value={fromId} set={setFromId} />)}
          </div>
        </fieldset>
      )}
      {method === "unsure" && (
        <div className="rounded-[12px] bg-surface p-3 flex flex-col gap-2">
          <p className="t-sub">Possible win — check your physical tiles with the group.</p>
          <Btn variant="secondary" onClick={openCoach}>Open Private Assistant</Btn>
        </div>
      )}
    </>);
    footer = <><Btn disabled={!methodOk} onClick={() => setStage("pattern")}>Continue</Btn></>;
  } else if (stage === "pattern") {
    body = (<>
      <div><h1 className="t-app text-green-text">Which Hand Do You Have?</h1><p className="t-body text-muted mt-1">Select the closest pattern.</p></div>
      <div className="flex flex-col gap-2">
        {(["standard", "seven_pairs", "all_pungs"] as const).map((k) => (
          <div key={k} className="flex flex-col gap-1">
            <Opt id={k} label={PATTERN_LABEL[k]} value={structure} set={setStructure} />
            {structure === k && <img src={`/mahjong-tutorial/win-${k.replace("_", "-")}.svg`} alt={`${PATTERN_LABEL[k]} example`} className="w-full max-w-[380px] self-center h-auto" />}
          </div>
        ))}
        <Opt id="unsure" label="Not Sure" value={structure} set={setStructure} />
        <button type="button" onClick={() => setExamples(true)} className="self-start t-sub text-green-text font-medium min-h-10">See Examples</button>
      </div>
      <fieldset className="flex flex-col gap-2 border-t border-line pt-4">
        <legend className="sr-only">Bonuses and checks</legend>
        <label className="flex items-center gap-3 min-h-11"><input type="checkbox" checked={pure} onChange={(e) => setPure(e.target.checked)} className="h-5 w-5 accent-[var(--brand)]" /><span className="t-body">Full Flush <span className="t-meta text-muted">— every tile is one suit</span></span></label>
        <div className="flex items-center gap-3 min-h-11">
          <span className="t-body flex-1">Roots <span className="t-meta text-muted">— sets of four identical tiles</span></span>
          <div className="flex items-center gap-1" role="group" aria-label="Roots">
            {[0, 1, 2, 3, 4].map((n) => <button key={n} type="button" onClick={() => setRoots(n)} aria-pressed={roots === n} className={cx("h-10 w-10 rounded-lg border t-sub", roots === n ? "bg-green-strong text-white border-green-strong" : "border-line bg-bg")}>{n}</button>)}
          </div>
        </div>
        <label className="flex items-center gap-3 min-h-11"><input type="checkbox" checked={twoSuits} onChange={(e) => setTwoSuits(e.target.checked)} className="h-5 w-5 accent-[var(--brand)]" /><span className="t-body">{myDQ ? <>I hold no {SUIT_NAME[myDQ]} tiles <span className="t-meta text-muted">— my missing suit</span></> : "My tiles use no more than two suits."}</span></label>
      </fieldset>
      {(structure === "unsure" || (structure && !twoSuits)) && <p className="t-sub rounded-[12px] bg-surface p-3">Possible win — check your physical tiles with the group.</p>}
    </>);
    footer = <Btn disabled={!patternOk} onClick={() => setStage("review")}>Review My Win</Btn>;
  } else {
    body = (<>
      <div><h1 className="t-app text-green-text">Review Your Win</h1><span className="inline-block mt-2 t-meta font-medium px-2 py-0.5 rounded-full bg-surface text-muted">Needs table verification</span></div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 t-body">
        <dt className="text-muted">Method</dt><dd>{METHOD_LABEL[claim.method]}{claim.fromId ? ` · from ${pname(r, claim.fromId)}` : ""}</dd>
        <dt className="text-muted">Hand Pattern</dt><dd>{patternText(claim)}</dd>
        <dt className="text-muted">Possible Points</dt><dd>{calc.problems.length ? "—" : <Transfers r={r} transfers={calc.transfers} to={me} />}</dd>
      </dl>
      {calc.problems.length > 0 && <p className={ERR}>{calc.problems.join(" ")}</p>}
      <p className="t-meta text-muted">Scored with {`Sichuan Blood Battle (planet-blood-battle-v1)`}. Nothing changes until the table confirms.</p>
      {err && <p className={ERR} role="alert">{err}</p>}
    </>);
    footer = <>
      <Btn disabled={busy || calc.problems.length > 0 || possible <= 0} onClick={declare}>{revise ? "Update Win" : "Declare Win"}</Btn>
      <div className="grid grid-cols-2 gap-2"><Btn variant="secondary" onClick={() => setStage("method")}>Edit</Btn><Btn variant="secondary" onClick={onClose}>Cancel</Btn></div>
    </>;
  }

  return (
    <div className="fixed inset-0 z-40 bg-page flex flex-col" role="dialog" aria-modal aria-label="Win">
      <div className="pt-safe border-b border-line"><div className="h-14 px-2 flex items-center max-w-[430px] mx-auto">
        <button onClick={back} aria-label="Back" className="h-11 min-w-11 px-2 flex items-center gap-0.5 rounded-full hover:bg-surface"><ChevronLeft size={22} strokeWidth={1.75} /><span className="t-sub font-medium">Back</span></button>
      </div></div>
      <div className="flex-1 overflow-y-auto"><div className="px-4 py-5 flex flex-col gap-5 max-w-[430px] mx-auto min-h-full">{body}</div></div>
      <div className="px-4 pt-3 pb-safe border-t border-line"><div className="flex flex-col gap-2 mb-3 max-w-[430px] mx-auto">{footer}</div></div>
      <Sheet open={examples} onClose={() => setExamples(false)} title="See Examples">
        <div className="flex flex-col gap-4">
          {(["standard", "seven_pairs", "all_pungs"] as const).map((k) => (
            <div key={k} className="flex flex-col gap-1">
              <span className="t-section">{PATTERN_LABEL[k]}</span>
              <img src={`/mahjong-tutorial/win-${k.replace("_", "-")}.svg`} alt={`${PATTERN_LABEL[k]} example`} className="w-full h-auto" />
              <span className="t-meta text-muted">{k === "standard" ? "Four sets and a pair." : k === "seven_pairs" ? "Seven different pairs." : "Four sets of three identical tiles and a pair."}</span>
            </div>
          ))}
          <p className="t-meta text-muted">Examples only. Bonuses like Full Flush add to a pattern; the table checks the real tiles.</p>
        </div>
      </Sheet>
    </div>
  );
}

export { patternText, METHOD_LABEL };
export type { PublicPlayer };
