"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { BookOpen, Camera, Check, ChevronRight, Copy, Flag, HelpCircle, ImagePlus, ListChecks, Lock, MoreHorizontal, Sparkles, Users, X } from "lucide-react";
import { api, forgetRoom, openQuestionCount, rememberRoom, useRoom } from "@/lib/client";
import type { GameEvent, Msg, MsgAction, PublicPlayer, PublicRoom } from "@/lib/types";
import { EndProposalPanel, EventCard, FinalResults, GameBar, HandReviewPanel, ReconcilePanel, RecordEventSheet, ScoresSheet, SessionReviewPanel, describeEvent, topicForEvent } from "./Game";
import { CheckMyHand } from "./CheckMyHand";
import { S3Room } from "./s3/S3Room";
import { topicsForBrowse } from "@/lib/mahjong/assistant";
import { entryById } from "@/lib/mahjong/intent-matcher";
import { VARIANTS, breakInstruction, fill, stepById, variantById, visibleSteps, type Step, type Variant } from "@/lib/variants";
import { STEP_UI } from "@/lib/tutorial/step-ui";
import { TutorialVisual } from "./tutorial/TutorialVisual";
import { Avatar, Btn, Composer, Count, Header, IconBtn, MessageList, NewMessagesPill, Panel, Prose, Sheet, Statuses, Typing, cx, useChatScroll } from "./ui";
import { Confetti, type ConfettiRef } from "./ui/confetti";
import { useReducedMotion } from "motion/react";

const END_GAME_COMMAND = /^\s*end\s*game\s*[.!]*\s*$/i;
import { BRAND_GREEN } from "@/lib/brand";

type Detail = { title: string; body: string; source?: string } | null;
type Actions = ReturnType<typeof useRoom>;

function useBusy() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run, setError };
}

// ---------------- root ----------------
export function RoomApp({ code }: { code: string }) {
  const router = useRouter();
  const room = useRoom(code);
  const [view, setView] = useState<"table" | "coach">("table");
  useEffect(() => {
    if (room.notMember) router.replace(`/join/${code}`);
  }, [room.notMember, code, router]);
  const status = room.data?.room.status;
  useEffect(() => {
    if (!status) return;
    if (status === "complete") forgetRoom(code); // a finished session is not resumable
    else rememberRoom(code);
  }, [status, code]);

  if (room.fatal)
    return (
      <div className="min-h-[100dvh] flex flex-col">
        <Header title="Mahjong Together" onBack={() => router.push("/")} />
        <div className="px-4 py-6 t-body">
          {room.fatal.config ? "Live rooms aren't set up on this deployment yet. The site owner needs to connect Upstash Redis (see README)." : "This room no longer exists. Rooms expire 24 hours after they're created."}
        </div>
      </div>
    );
  if (!room.data)
    return <div className="min-h-[100dvh] flex items-center justify-center t-sub text-muted">Connecting to the room…</div>;

  const { room: r, me } = room.data;
  if (r.flow === "s3") {
    // Final Sichuan product flow. The Private AI Assistant (Coach) is reused exactly as before.
    if (r.status === "complete") return <FinalResults r={r} me={me} onHome={() => { forgetRoom(r.code); router.push("/"); }} reflection={null} />;
    if (view === "coach") return <div className="coach-classic"><Coach r={r} me={me} onBack={() => setView("table")} act={room.act} /></div>;
    return <S3Room data={room.data} actions={room} openCoach={() => setView("coach")} />;
  }
  if (r.status === "lobby") return <Lobby r={r} me={me} actions={room} />;
  if (r.status === "complete") return <Complete r={r} me={me} actions={room} />;
  if (view === "coach") return <Coach r={r} me={me} onBack={() => setView("table")} act={room.act} />;
  return <Table data={room.data} actions={room} openCoach={() => setView("coach")} />;
}

// ---------------- lobby ----------------
function Lobby({ r, me, actions }: { r: PublicRoom; me: string; actions: Actions }) {
  const router = useRouter();
  const [qr, setQr] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const { busy, error, run } = useBusy();
  const isHost = r.hostId === me;
  useEffect(() => {
    const origin = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const u = `${origin.replace(/\/$/, "")}/join/${r.code}`;
    setUrl(u);
    QRCode.toDataURL(u, { width: 440, margin: 1, color: { dark: "#171717", light: "#ffffff" } }).then(setQr).catch(() => setQr(null));
  }, [r.code]);
  const isLocal = /localhost|127\.0\.0\.1/.test(url);
  const joinedMsgs = r.messages.filter((m) => m.sender === "system").slice(-3);
  const n = r.players.length;
  const presenceText = (p: PublicPlayer) => (p.presence === "online" ? "Connected" : p.presence === "reconnecting" ? "Reconnecting…" : "Offline");

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Header title={r.name} subtitle="Room Lobby" onBack={() => router.push("/")} />
      <main className="flex-1 px-4 py-5 flex flex-col gap-6">
        <section className="flex items-center justify-between gap-3">
          <div>
            <div className="t-meta text-muted">Room code</div>
            <div className="text-[22px] leading-[30px] font-semibold tracking-wide">{r.code}</div>
          </div>
          <Btn variant="secondary" onClick={() => { navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}>
            {copied ? <><Check size={16} /> Copied</> : <><Copy size={16} strokeWidth={1.75} /> Copy link</>}
          </Btn>
        </section>

        <section className="flex flex-col items-center gap-2">
          <div className="h-[220px] w-[220px] rounded-xl border border-line p-2 bg-white flex items-center justify-center">
            {qr ? <img src={qr} alt={`QR code to join room ${r.code}`} width={204} height={204} /> : <span className="t-meta text-muted">Generating…</span>}
          </div>
          <p className="t-sub text-muted text-center">Scan with a phone camera to join</p>
          {isLocal && (
            <p className="t-meta text-muted text-center bg-surface rounded-xl px-3 py-2">
              This link uses localhost, which other phones can't open. Open the site from your computer's network address or the deployed URL, then the QR code will work.
            </p>
          )}
        </section>

        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="t-section">{n}/4 Players Joined</h2>
          </div>
          <ul className="mt-3 border border-line rounded-2xl bg-bg shadow-card divide-y divide-line overflow-hidden">
            {[0, 1, 2, 3].map((seat) => {
              const p = r.players.find((x) => x.seat === seat);
              if (!p)
                return (
                  <li key={seat} className="min-h-14 px-3 flex items-center gap-3 text-muted">
                    <span className="h-8 w-8 rounded-full border-[1.5px] border-dashed border-dash" aria-hidden />
                    <span className="t-sub">Waiting for Player {seat + 1}</span>
                  </li>
                );
              return (
                <li key={p.id} className="min-h-14 px-3 flex items-center gap-3">
                  <Avatar name={p.name} />
                  <div className="flex-1 min-w-0">
                    <div className="t-body font-medium truncate">{p.name}{p.id === me && <span className="text-muted font-normal"> (you)</span>}</div>
                    <div className="t-meta text-muted flex items-center gap-1.5">
                      <span className={cx("h-1.5 w-1.5 rounded-full", p.presence === "online" ? "bg-green" : "bg-dash")} />
                      {p.id === r.hostId ? "Host · " : ""}{presenceText(p)}
                    </div>
                  </div>
                  {isHost && p.id !== me && (
                    <IconBtn label={`Remove ${p.name}`} onClick={() => run(() => actions.act({ type: "remove", target: p.id }))}><X size={18} strokeWidth={1.75} /></IconBtn>
                  )}
                </li>
              );
            })}
          </ul>
          {joinedMsgs.length > 0 && (
            <div className="mt-3 flex flex-col gap-1" aria-live="polite">
              {joinedMsgs.map((m) => <div key={m.id} className="t-meta text-muted">{m.text}</div>)}
            </div>
          )}
        </section>
      </main>
      <div className="sticky bottom-0 bg-bg px-4 pt-3 pb-safe border-t border-line flex flex-col gap-2">
        {error && <p className="t-sub text-[#B42318] dark:text-[#FF6961] text-center">{error}</p>}
        {isHost ? (
          <>
            <Btn className="w-full" disabled={n < 4 || busy} onClick={() => run(() => actions.act({ type: "start" }))}>Start Learning Session</Btn>
            <p className="t-meta text-muted text-center">{n < 4 ? `Four players are needed to start. ${4 - n} more to join.` : "Everyone's here. Start when your table is ready."}</p>
          </>
        ) : (
          <>
            <Btn className="w-full" disabled>Start Learning Session</Btn>
            <p className="t-meta text-muted text-center">{n < 4 ? "Waiting for four players to join." : "Waiting for the host to start."}</p>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------- table ----------------
function Table({ data, actions, openCoach }: { data: NonNullable<Actions["data"]>; actions: Actions; openCoach: () => void }) {
  const router = useRouter();
  const { room: r, me } = data;
  const [detail, setDetail] = useState<Detail>(null);
  const [people, setPeople] = useState(false);
  const [menu, setMenu] = useState(false);
  const [thinking, setThinking] = useState(false);
  const { error, run, busy } = useBusy();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const variant = variantById(r.variant);
  const step = stepById(r.stepId);
  const isHost = r.hostId === me;
  const needsHelp = !!r.check?.needs.includes(me);
  const openQs = openQuestionCount(r.messages, r.lastSummaryTs);
  const mainRef = useRef<HTMLElement>(null);
  const visibleMsgs = useMemo(() => r.messages.filter((m) => !(m.sender === "system" && /created the room|joined the room/.test(m.text))), [r.messages]);
  const chatScroll = useChatScroll(visibleMsgs, me, mainRef);
  const [endConfirm, setEndConfirm] = useState(false);
  const reduceMotion = useReducedMotion();

  // Small, one-time confetti when a player DECLARES a win (not a verified win). Keyed by event id so polling,
  // refresh and re-renders never replay it; declarations older than a minute are marked seen silently.
  const declConfetti = useRef<ConfettiRef>(null);
  const declOptions = useMemo(() => ({ resize: true, useWorker: true }), []);
  useEffect(() => {
    const decls = r.messages.filter((m) => m.kind === "declaration" && m.eventId);
    if (!decls.length) return;
    const key = `mt.seenDecl.${r.code}`;
    let seen: string[] = [];
    try { seen = JSON.parse(localStorage.getItem(key) || "[]"); } catch {}
    const unseen = decls.filter((m) => !seen.includes(m.eventId!));
    if (!unseen.length) return;
    try { localStorage.setItem(key, JSON.stringify([...seen, ...unseen.map((m) => m.eventId!)].slice(-50))); } catch {}
    const fresh = unseen.some((m) => Date.now() - m.ts < 60000);
    if (!fresh || reduceMotion) return;
    const burst = (x: number) => declConfetti.current?.fire({ particleCount: 18, angle: 270, spread: 70, startVelocity: 5, gravity: 0.8, ticks: 140, scalar: 0.8, origin: { x, y: -0.05 }, colors: ["#FFD60A", "#FF9F0A", "#FF2D55", "#0A84FF", "#AF52DE", BRAND_GREEN] });
    burst(0.35);
    const t = window.setTimeout(() => burst(0.65), 250);
    return () => window.clearTimeout(t);
  }, [r.messages, r.code, reduceMotion]);

  const ask = (q: string) => run(async () => { setThinking(true); try { await actions.ask(q); } finally { setThinking(false); } });
  const summarize = () => run(async () => { setThinking(true); try { await actions.summarize(); } finally { setThinking(false); } });
  const act = (a: Record<string, unknown>) => run(() => actions.act(a));
  const [browse, setBrowse] = useState(false);
  const [help, setHelp] = useState(false);
  const helpStep = useRef<string | null>(null);
  useEffect(() => {
    // informational status only; never touches confirmations
    if (help && step) { helpStep.current = step.id; actions.act({ type: "step-help", stepId: step.id, open: true }).catch(() => {}); }
    else if (!help && helpStep.current) { const id = helpStep.current; helpStep.current = null; actions.act({ type: "step-help", stepId: id, open: false }).catch(() => {}); }
  }, [help]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (help && step && helpStep.current && helpStep.current !== step.id) setHelp(false); }, [step?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [recordOpen, setRecordOpen] = useState(false);
  const [revise, setRevise] = useState<GameEvent | null>(null);
  const [scoresOpen, setScoresOpen] = useState(false);
  const withThinking = (fn: () => Promise<unknown>) => run(async () => { setThinking(true); try { await fn(); } finally { setThinking(false); } });
  const onAction = (a: MsgAction) => {
    if (a.type === "followup" && a.topicId) withThinking(() => actions.followup(a.topicId!, a.facet || "short"));
    else if (a.type === "current") withThinking(() => actions.current());
    else if (a.type === "browse") setBrowse(true);
    else if (a.topicId?.startsWith("event:")) document.getElementById(`event-${a.topicId.slice(6)}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    else inputRef.current?.focus();
  };
  const viewRule = (topicId?: string) => {
    const e = entryById(topicId);
    if (e) setDetail({ title: e.topic, body: e.detail, source: e.source });
    else if (step) setDetail({ title: step.title, body: fill(step.detail, r.decisions), source: step.source });
  };
  const showMsg = (m: Msg) => setDetail({ title: m.title || "Details", body: m.detail || m.text, source: m.source });
  const showVariant = (v: Variant) => setDetail({ title: v.name, body: `${v.region}\n\n${v.background}\n\nKey rules (${v.rulesetName})\n${v.rules.map((x) => "• " + x).join("\n")}`, source: v.source });
  const reviewRules = () => {
    if (!variant) return;
    const steps = visibleSteps(variant.id, r.decisions);
    setDetail({ title: "Rule guide", body: `${variant.rulesetName}\n\n${variant.rules.map((x) => "• " + x).join("\n")}\n\n${steps.filter((s) => s.kind !== "begin").map((s) => `${s.title} (${s.ruleType})\n${fill(s.detail, r.decisions)}`).join("\n\n")}`, source: variant.source });
  };
  const online = r.players.filter((p) => p.presence === "online").length;

  const pendingEvents = (r.events || []).filter((e) => e.status === "pending");
  let panel: React.ReactNode = null;
  if (r.status === "variant") panel = <VariantPanel r={r} me={me} act={act} showVariant={showVariant} busy={busy} />;
  else if (r.check) panel = <CheckPanel r={r} me={me} act={act} onAction={onAction} viewRule={viewRule} busy={busy || thinking} />;
  else if (r.status === "setup" && step) panel = <StepPanel r={r} me={me} step={step} act={act} busy={busy || thinking} onHelp={() => setHelp(true)} />;
  const gamePanels = (
    <>
      {pendingEvents.map((e) => (
        <EventCard key={e.id} r={r} me={me} e={e} act={act} busy={busy}
          onExplain={(ev) => { const t = topicForEvent(r, ev); if (t) onAction({ label: "", type: "followup", topicId: t, facet: "short" }); else setDetail({ title: describeEvent(r, ev).title, body: ev.lines.join("\n"), source: ev.source }); }}
          onCorrect={(ev) => { setRevise(ev); setRecordOpen(true); }} />
      ))}
      {r.status === "playing" && <GameBar r={r} me={me} act={act} busy={busy} openRecord={() => { setRevise(null); setRecordOpen(true); }} openScores={() => setScoresOpen(true)} reviewRules={reviewRules} openCoach={openCoach} />}
      {r.status === "hand_review" && r.hand && <HandReviewPanel r={r} me={me} act={act} busy={busy} openRecord={() => { setRevise(null); setRecordOpen(true); }} openScores={() => setScoresOpen(true)} />}
      {r.status === "reconciling" && <ReconcilePanel r={r} act={act} busy={busy} openRecord={() => { setRevise(null); setRecordOpen(true); }} />}
      {r.status === "session_review" && r.finalReview && <SessionReviewPanel r={r} me={me} act={act} busy={busy} />}
    </>
  );

  const canFacilitate = r.status === "setup" || r.status === "playing" || r.status === "hand_review";
  const canEnd = !["lobby", "complete", "reconciling"].includes(r.status) && !(r.status === "session_review" && r.endedEarly);
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Header
        title={r.name}
        subtitle={`Shared Table · ${variant ? variant.name : "Choosing a variant"}`}
        onBack={() => router.push("/")}
        right={
          <>
            <IconBtn label="My Private Coach" onClick={openCoach}><Lock size={19} strokeWidth={1.75} /></IconBtn>
            <IconBtn label="Menu" onClick={() => setMenu(true)}>
              <span className="relative"><MoreHorizontal size={20} strokeWidth={1.75} />{online < r.players.length && <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-dash ring-2 ring-bg" aria-label="A player is offline" />}</span>
            </IconBtn>
          </>
        }
      >
        {actions.conn === "retrying" && <div className="px-4 py-1.5 t-meta text-muted border-t border-line">Reconnecting…</div>}
      </Header>

      <Confetti ref={declConfetti} manualstart globalOptions={declOptions} className="pointer-events-none fixed inset-x-0 top-0 z-30 w-full h-[45vh]" aria-hidden />
      <main ref={mainRef} className="flex-1 px-4 py-6 flex flex-col gap-6">
        <MessageList messages={visibleMsgs} me={me} players={r.players} onDetail={showMsg} onAction={onAction} onReact={(msgId, reaction) => act({ type: "react", msgId, reaction })} busy={thinking} />
        {thinking && <Typing />}
        {panel}
        {["playing", "hand_review", "reconciling", "session_review"].includes(r.status) && gamePanels}
        {r.endProposal && <EndProposalPanel r={r} me={me} act={act} busy={busy} />}
        {error && <p className="t-sub text-[#B42318] dark:text-[#FF6961]" role="alert">{error}</p>}
      </main>

      <Composer
        inputRef={inputRef}
        placeholder={needsHelp ? "Which part should we review?" : "Message the table or ask a question..."}
        onSend={(t) => (END_GAME_COMMAND.test(t) ? setEndConfirm(true) : act({ type: "message", text: t }))}
        floating={<NewMessagesPill count={chatScroll.unread} onClick={chatScroll.jump} />}
        onAsk={ask}
        preferAsk={needsHelp}
        busy={thinking}
        above={
          canFacilitate ? (
            <div className="flex gap-2 pb-2 overflow-x-auto no-scrollbar">
              <button onClick={summarize} disabled={thinking} className={cx("h-9 px-3 rounded-full border t-sub shrink-0 flex items-center gap-1.5", openQs >= 2 ? "border-green bg-green-soft text-green-text font-medium" : "border-line bg-bg text-ink")}>
                <ListChecks size={15} strokeWidth={1.75} /> Summarize Questions{openQs ? ` (${openQs})` : ""}
              </button>
              {!r.check && r.status !== "setup" && (
                <button onClick={() => act({ type: "check-start" })} className="h-9 px-3 rounded-full border border-line bg-bg t-sub text-ink shrink-0 flex items-center gap-1.5 hover:bg-surface">
                  <HelpCircle size={15} strokeWidth={1.75} /> Check Understanding
                </button>
              )}
            </div>
          ) : null
        }
      />

      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail?.title || ""}>
        {detail && (
          <>
            <Prose text={detail.body} />
            {detail.source && <p className="t-meta text-muted mt-4 pt-3 border-t border-line">Source: {detail.source}</p>}
          </>
        )}
      </Sheet>

      <Sheet open={browse} onClose={() => setBrowse(false)} title="Rule topics">
        <TopicList variant={r.variant} onPick={(id) => { setBrowse(false); onAction({ label: "", type: "followup", topicId: id, facet: "short" }); }} />
      </Sheet>
      <Sheet open={endConfirm} onClose={() => setEndConfirm(false)} title="End This Game?">
        <p className="t-body">Ask everyone to stop this session and review the scores?</p>
        <p className="t-sub text-muted mt-2">All four players must agree. Nothing changes if anyone wants to keep playing.</p>
        <div className="grid grid-cols-2 gap-2 mt-5">
          <Btn variant="secondary" onClick={() => setEndConfirm(false)}>Cancel</Btn>
          <Btn disabled={busy || !canEnd} onClick={() => { setEndConfirm(false); act({ type: "end-propose" }); }}>Request to End Game</Btn>
        </div>
      </Sheet>
      <StepHelpSheet r={r} step={step} open={help} onClose={() => setHelp(false)} />
      <RecordEventSheet r={r} me={me} open={recordOpen} onClose={() => { setRecordOpen(false); setRevise(null); }} act={act} busy={busy} revise={revise} />
      <ScoresSheet r={r} me={me} open={scoresOpen} onClose={() => setScoresOpen(false)} />

      <Sheet open={people} onClose={() => setPeople(false)} title="Participants">
        <ul className="flex flex-col gap-3">
          {r.players.map((p) => (
            <li key={p.id} className="flex items-center gap-3">
              <Avatar name={p.name} />
              <div className="flex-1 min-w-0">
                <div className="t-body truncate">{p.name}{p.id === me ? " (you)" : ""}</div>
                <div className="t-meta text-muted">{p.id === r.hostId ? "Host · " : ""}{p.id === r.dealerId ? "Dealer · " : ""}{p.presence === "online" ? "Connected" : p.presence === "reconnecting" ? "Reconnecting…" : "Offline"}</div>
              </div>
              {isHost && p.id !== me && p.presence === "offline" && (
                <Btn variant="secondary" onClick={() => act({ type: "remove", target: p.id })}>Open seat</Btn>
              )}
            </li>
          ))}
          {r.players.length < 4 && <li className="t-sub text-muted">A seat is open. A new player can join with code {r.code}.</li>}
        </ul>
        <p className="t-meta text-muted mt-4">Players keep their progress if they reconnect from the same browser. The host can open the seat of a player who has gone offline; a new player never sees the previous player's private coach.</p>
      </Sheet>

      <Sheet open={menu} onClose={() => setMenu(false)} title="Menu">
        <div className="flex flex-col gap-3">
          <Btn variant="secondary" onClick={() => { setMenu(false); setPeople(true); }}><Users size={16} strokeWidth={1.75} /> Participants · {online}/{r.players.length} connected</Btn>
          {variant && <Btn variant="secondary" onClick={() => { setMenu(false); reviewRules(); }}><BookOpen size={16} strokeWidth={1.75} /> Rule guide</Btn>}
          <p className="t-sub text-muted">
            Room {r.code}. Answers come from the built-in Mahjong Rule Assistant — prepared, sourced rule notes matched to your question. It isn't a generative AI, and no questions are sent to any AI service.
            {data.backend === "dev-file" ? " Using the local development store (this computer only)." : ""}
          </p>
          {canEnd && !r.endProposal && <Btn variant="secondary" onClick={() => { setMenu(false); setEndConfirm(true); }}>End Game</Btn>}
          <Btn variant="secondary" onClick={() => router.push("/")}>Leave to Home</Btn>
          <p className="t-meta text-muted">Leaving keeps your seat. Open the same room link on this device to come back.</p>
        </div>
      </Sheet>
    </div>
  );
}

function VariantPanel({ r, me, act, showVariant, busy }: { r: PublicRoom; me: string; act: (a: Record<string, unknown>) => void; showVariant: (v: Variant) => void; busy: boolean }) {
  const voted = r.players.filter((p) => r.votes[p.id]);
  const all = voted.length === 4;
  const vals = r.players.map((p) => r.votes[p.id]);
  const differ = all && !vals.every((v) => v === vals[0]);
  return (
    <Panel label="Choose a variant">
      <div className="flex items-center justify-between gap-2">
        <div className="t-section">Choose a variant</div>
        <Count n={voted.length} label="Selected" />
      </div>
      <ul className="flex flex-col gap-2">
        {VARIANTS.map((v) => {
          const mine = r.votes[me] === v.id;
          const voters = r.players.filter((p) => r.votes[p.id] === v.id);
          return (
            <li key={v.id} className={cx("p-3 rounded-[14px] border", mine ? "border-green bg-green-soft" : "border-line bg-bg")}>
              <button disabled={busy} onClick={() => act({ type: "vote", variant: v.id })} className="w-full text-left flex gap-3" aria-pressed={mine}>
                <span className={cx("mt-0.5 h-5 w-5 rounded-full border shrink-0 flex items-center justify-center", mine ? "bg-green border-green text-white" : "border-dash bg-bg")}>
                  {mine && <Check size={12} strokeWidth={3} />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block t-body font-medium">{v.name}</span>
                  <span className="block t-meta text-muted">{v.region}</span>
                  <span className="block t-sub mt-0.5">{v.intro}</span>
                </span>
              </button>
              <div className="flex items-center justify-between gap-2 mt-1.5 pl-8">
                <button onClick={() => showVariant(v)} className="t-sub font-medium text-green-text min-h-9 text-left hover:underline underline-offset-4">Rules &amp; Cultural Background</button>
                <span className="t-meta text-muted truncate">{voters.map((p) => p.name).join(", ")}</span>
              </div>
            </li>
          );
        })}
      </ul>
      {differ && (
        <div className="bg-surface rounded-xl p-3">
          <div className="t-section">Agreement Needed</div>
          <p className="t-sub text-muted">Your group hasn't reached a shared decision yet. Discuss in the chat, then change your choice — everyone must pick the same variant.</p>
        </div>
      )}
      {!all && r.votes[me] && <p className="t-meta text-muted">Waiting for {r.players.filter((p) => !r.votes[p.id]).map((p) => p.name).join(", ")}.</p>}
    </Panel>
  );
}

function TopicList({ variant, onPick }: { variant: PublicRoom["variant"]; onPick: (id: string) => void }) {
  const topics = topicsForBrowse(variant);
  return (
    <div className="flex flex-col">
      <p className="t-sub text-muted mb-2">Topics the Rule Assistant has verified notes for{variant ? ` (${variantById(variant)?.name})` : ""}.</p>
      {topics.map((t) => (
        <button key={t.id} onClick={() => onPick(t.id)} className="min-h-12 text-left t-body border-b border-line last:border-0">{t.topic}</button>
      ))}
    </div>
  );
}

function CheckPanel({ r, me, act, onAction, viewRule, busy }: { r: PublicRoom; me: string; act: (a: Record<string, unknown>) => void; onAction: (a: MsgAction) => void; viewRule: (topicId?: string) => void; busy: boolean }) {
  const c = r.check!;
  const mine = c.resp[me];
  const needers = r.players.filter((p) => c.needs.includes(p.id));
  return (
    <Panel label="Understanding check">
      <div className="flex flex-col gap-0.5">
        <Count n={Object.values(c.resp).filter((v) => v === "yes").length} label="Understand" />
        <div className="t-section">{c.round > 1 ? "Does Everyone Understand Now?" : "Does Everyone Understand?"}</div>
      </div>
      <p className="t-sub text-muted -mt-2">{c.topic}. We'll continue only when everyone understands.</p>
      <Statuses players={r.players} value={(p) => c.resp[p.id]} labels={{ yes: { text: "Understands", ok: true }, no: { text: "Needs clarification" } }} />
      <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-2">
        <Btn variant={mine === "yes" ? "ok" : "primary"} disabled={busy || mine === "yes"} onClick={() => act({ type: "check", value: "yes" })}>{mine === "yes" ? <><Check size={16} /> I understand</> : <span className="whitespace-nowrap">I Understand</span>}</Btn>
        <Btn variant={mine === "no" ? "chosen" : "secondary"} className="px-2 text-[14px] whitespace-nowrap" disabled={busy || mine === "no"} onClick={() => act({ type: "check", value: "no" })}>Need Explanation</Btn>
      </div>
      {mine === "no" && (
        <div className="bg-surface rounded-xl p-3 flex flex-col gap-2">
          <div className="t-section">Let&apos;s Clarify This Together</div>
          <p className="t-sub text-muted -mt-1">Which part would you like to review? Everyone will see the new explanation.</p>
          <div className="grid grid-cols-2 gap-2">
            <Btn variant="secondary" className="px-2 text-[14px]" onClick={() => onAction({ label: "", type: "focus" })}>Ask Another Question</Btn>
            <Btn variant="secondary" className="px-2 text-[14px]" disabled={busy} onClick={() => onAction(c.topicId ? { label: "", type: "followup", topicId: c.topicId, facet: "simple" } : { label: "", type: "current" })}>Explain More Simply</Btn>
            <Btn variant="secondary" className="px-2 text-[14px]" disabled={busy} onClick={() => onAction(c.topicId ? { label: "", type: "followup", topicId: c.topicId, facet: "example" } : { label: "", type: "current" })}>Show an Example</Btn>
            <Btn variant="secondary" className="px-2 text-[14px]" onClick={() => viewRule(c.topicId)}>View Full Rule</Btn>
          </div>
        </div>
      )}
      {mine !== "no" && needers.length > 0 && <p className="t-meta text-muted">{needers.map((p) => p.name).join(" and ")} {needers.length > 1 ? "need" : "needs"} clarification. Help in the chat, or wait for the next explanation.</p>}
    </Panel>
  );
}

/**
 * Tutorial UX 2.0 — ONE shared step card per step.
 * Title · one-sentence instruction · visual demonstration · Need Explanation · single confirmation · "n / 4 Ready".
 * Need Explanation opens help for this player only and never changes anyone's confirmation.
 */
function StepPanel({ r, me, step, act, busy, onHelp }: { r: PublicRoom; me: string; step: Step; act: (a: Record<string, unknown>) => void; busy: boolean; onHelp: () => void }) {
  const [total, setTotal] = useState<string>("");
  const [d1, setD1] = useState<number | null>(null);
  const [d2, setD2] = useState<number | null>(null);
  const steps = visibleSteps(step.variant, r.decisions);
  const idx = steps.findIndex((s) => s.id === step.id);
  const ui = STEP_UI[step.id];
  const instruction = ui ? fill(ui.instruction, r.decisions) : fill(step.short, r.decisions);
  const mine = r.resp[me];
  const dealer = r.players.find((p) => p.id === r.dealerId);
  const pad = (n: number) => String(n).padStart(2, "0");
  const readyCount = r.players.filter((p) => r.resp[p.id] === "ready").length;
  const statusOf = (pid: string) => (r.resp[pid] === "ready" ? "ready" : r.viewing?.[pid] ? "viewing" : undefined);
  const confirmLabel = ui?.action === "ready" || step.kind === "review" ? "I'm Ready" : step.kind === "begin" ? "I'm Ready to Play" : "I've Done This";

  const confirmArea = (
    <div className="flex flex-col gap-3 border-t border-line pt-3">
      <div className="grid grid-cols-1 min-[360px]:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-2">
        <Btn variant="secondary" className="order-2 min-[360px]:order-1 px-2 text-[14px] whitespace-nowrap" onClick={onHelp}>Need Explanation</Btn>
        <Btn variant={mine === "ready" ? "ok" : "primary"} className="order-1 min-[360px]:order-2 px-2 whitespace-nowrap" disabled={busy || mine === "ready"}
          onClick={() => act({ type: "respond", stepId: step.id, value: "ready" })}>
          {mine === "ready" ? <><Check size={16} /> Ready</> : confirmLabel}
        </Btn>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className={cx("t-sub font-semibold", readyCount === 4 ? "text-green-text" : "text-ink")} aria-live="polite">{readyCount} / 4 Ready</span>
        <span className="flex gap-1" aria-hidden>{r.players.map((p) => <span key={p.id} className={cx("h-1.5 w-6 rounded-full", r.resp[p.id] === "ready" ? "bg-green" : r.viewing?.[p.id] ? "bg-[#FF9F0A]" : "bg-line")} />)}</span>
      </div>
      <Statuses players={r.players} value={(p) => statusOf(p.id)} labels={{ ready: { text: "Ready", ok: true }, viewing: { text: "Viewing explanation" } }} />
    </div>
  );

  let body: React.ReactNode;
  if (step.kind === "consensus") {
    const votes = r.players.map((p) => r.resp[p.id]);
    const all = votes.every(Boolean);
    const differ = all && !votes.every((v) => v === votes[0]);
    body = (
      <div className="flex flex-col gap-3 border-t border-line pt-3">
        <div className={cx("grid gap-2", step.options!.length === 2 ? "grid-cols-2" : "grid-cols-1")}>
          {step.options!.map((o) => (
            <Btn key={o.id} variant={mine === o.id ? "selected" : "secondary"} disabled={busy} onClick={() => act({ type: "respond", stepId: step.id, value: o.id })}>
              {mine === o.id && <Check size={16} />} {o.label}
            </Btn>
          ))}
        </div>
        <div className="flex items-center justify-between"><Count n={votes.filter(Boolean).length} label="chosen" /><button onClick={onHelp} className="t-sub font-medium text-green-text min-h-10">Need Explanation</button></div>
        <Statuses players={r.players} value={(p) => (r.resp[p.id] ? step.options!.find((o) => o.id === r.resp[p.id])?.label : undefined)} labels={{}} />
        {differ && !step.veto && <p className="t-sub text-muted">Agreement needed — discuss in the chat, then change your choice if you like.</p>}
        {step.veto && <p className="t-meta text-muted">Any one player can say No to stop this.</p>}
      </div>
    );
  } else if (step.kind === "dice-dealer") {
    const contenders = r.decisions.dealerContenders ? r.decisions.dealerContenders.split(",") : r.players.map((p) => p.id);
    const myTurn = contenders.includes(me) && r.dice[me] === undefined;
    body = (
      <div className="flex flex-col gap-3 border-t border-line pt-3">
        {myTurn ? (
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); act({ type: "dice", value: Number(total) }); setTotal(""); }}>
            <input type="number" inputMode="numeric" min={2} max={12} value={total} onChange={(e) => setTotal(e.target.value)} placeholder="Your total (2–12)" aria-label="Your dice total" className="flex-1 min-w-0 h-11 px-4 rounded-full border border-line bg-bg outline-none focus:border-green" />
            <Btn type="submit" disabled={busy || !(Number(total) >= 2 && Number(total) <= 12)}>Submit</Btn>
          </form>
        ) : (
          <p className="t-sub text-muted">{contenders.includes(me) ? "Your roll is in. Waiting for the others." : "Waiting for the tied players to roll again."}</p>
        )}
        <div className="flex items-center justify-between"><Count n={Object.keys(r.dice).length} label="entered" /><button onClick={onHelp} className="t-sub font-medium text-green-text min-h-10">Need Explanation</button></div>
        <Statuses players={r.players} value={(p) => (r.dice[p.id] !== undefined ? String(r.dice[p.id]) : contenders.includes(p.id) ? undefined : "—")} labels={{}} />
      </div>
    );
  } else if (step.kind === "dice-break" && !r.breakRoll) {
    const canEnter = !r.dealerId || r.dealerId === me;
    const die = (val: number | null, set: (n: number) => void, label: string) => (
      <div className="flex flex-col gap-1">
        <span className="t-meta text-muted">{label}</span>
        <div className="grid grid-cols-6 gap-1">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button key={n} type="button" onClick={() => set(n)} aria-pressed={val === n} className={cx("h-11 rounded-lg border t-btn", val === n ? "bg-green-strong text-white border-green-strong shadow-btn" : "border-line bg-bg hover:bg-surface")}>{n}</button>
          ))}
        </div>
      </div>
    );
    body = (
      <div className="flex flex-col gap-3 border-t border-line pt-3">
        {canEnter ? (
          <>
            {die(d1, setD1, "First die")}
            {die(d2, setD2, "Second die")}
            <Btn disabled={busy || !d1 || !d2} onClick={() => act({ type: "break", d1, d2 })}>Submit Dice</Btn>
          </>
        ) : (
          <p className="t-sub text-muted">Waiting for {dealer?.name || "the dealer"} to roll and enter the dice.</p>
        )}
        <button onClick={onHelp} className="self-start t-sub font-medium text-green-text min-h-10">Need Explanation</button>
      </div>
    );
  } else body = confirmArea;

  return (
    <section aria-label={step.title} className="border border-line rounded-2xl bg-bg p-4 shadow-card flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="t-meta text-muted tracking-wide">STEP {pad(idx + 1)} / {pad(steps.length)}{step.ruleType !== "mandatory" ? ` · ${step.ruleType === "optional" ? "Optional rule" : "House rule"}` : ""}</span>
        <h3 className="t-page">{step.title}</h3>
        <p className="t-body">{instruction}</p>
      </div>
      {ui?.scene && (
        <div className="rounded-[14px] bg-surface/60 border border-line p-2">
          <TutorialVisual sceneId={ui.scene} decisions={r.decisions} />
        </div>
      )}
      {r.breakRoll && step.kind === "dice-break" && (
        <p className="t-sub rounded-[12px] bg-green-soft px-3 py-2">{breakInstruction(step.breakMethod!, r.breakRoll.d1, r.breakRoll.d2, dealer?.name || "the dealer")}</p>
      )}
      {body}
    </section>
  );
}

/** Help for ONE player, attached to the same step. Opening/closing only toggles their "viewing" status. */
function StepHelpSheet({ r, step, open, onClose }: { r: PublicRoom; step: Step | undefined; open: boolean; onClose: () => void }) {
  const [more, setMore] = useState(false);
  useEffect(() => { if (open) setMore(false); }, [open]);
  if (!step) return null;
  const ui = STEP_UI[step.id];
  return (
    <Sheet open={open} onClose={onClose} title="Need Help With This Step?">
      <div className="flex flex-col gap-4">
        <div className="t-section">{step.title}</div>
        {ui?.scene && (
          <div className="flex flex-col gap-1">
            <div className="t-meta text-muted">Watch What Happens</div>
            <div className="rounded-[14px] bg-surface/60 border border-line p-2"><TutorialVisual key={`help-${step.id}`} sceneId={ui.scene} decisions={r.decisions} /></div>
          </div>
        )}
        <div className="rounded-[12px] bg-green-soft px-3 py-2">
          <div className="t-meta font-semibold text-green-text">Remember</div>
          <p className="t-body">{ui ? fill(ui.remember, r.decisions) : fill(step.short, r.decisions)}</p>
        </div>
        <button onClick={() => setMore(!more)} aria-expanded={more} className="self-start t-sub font-medium text-green-text min-h-10">{more ? "Show less" : "Explain More"}</button>
        {more && (
          <div className="t-sub whitespace-pre-wrap text-ink">
            {fill(step.detail, r.decisions)}
            {step.example && <><br /><br /><span className="font-semibold">Example: </span>{step.example}</>}
            <p className="t-meta text-muted mt-3">Source: {step.source}</p>
          </div>
        )}
        <Btn onClick={onClose}>Back to Step</Btn>
      </div>
    </Sheet>
  );
}

// ---------------- private coach ----------------
function compress(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode"));
      img.onload = () => {
        const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.8));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function Coach({ r, me, onBack, act }: { r: PublicRoom; me: string; onBack: () => void; act: Actions["act"] }) {
  const [checkOpen, setCheckOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [imgQ, setImgQ] = useState("");
  const [thinking, setThinking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [browse, setBrowse] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [detail, setDetail] = useState<Msg | null>(null);
  const variant = variantById(r.variant);

  useEffect(() => {
    api(`/api/rooms/${r.code}/private`).then((j) => setMsgs(j.messages)).catch((e) => setErr(e.message));
  }, [r.code]);
  const coachMain = useRef<HTMLElement>(null);
  const coachScroll = useChatScroll(msgs || [], me, coachMain);

  const post = async (body: Record<string, unknown>, optimisticText: string, photo = false) => {
    setThinking(true);
    setErr(null);
    setMsgs((m) => [...(m || []), { id: "tmp", ts: Date.now(), sender: me, text: optimisticText, hadPhoto: photo }]);
    try {
      const j = await api(`/api/rooms/${r.code}/private`, body);
      setMsgs(j.messages);
    } catch (e) {
      setErr((e as Error).message);
      setMsgs((m) => (m || []).filter((x) => x.id !== "tmp"));
    } finally {
      setThinking(false);
    }
  };
  const onAction = (a: MsgAction) => {
    if (a.type === "followup" && a.topicId) post({ mode: "followup", topicId: a.topicId, facet: a.facet || "short" }, a.label || "Explain");
    else if (a.type === "current") post({ mode: "current" }, "What should we do now?");
    else if (a.type === "browse") setBrowse(true);
    else inputRef.current?.focus();
  };
  const react = async (msgId: string, reaction: string | null) => {
    try {
      const j = await api(`/api/rooms/${r.code}/private`, { mode: "react", msgId, reaction });
      setMsgs(j.messages);
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) return setErr("Please choose an image.");
    try {
      setImage(await compress(f)); // preview only — the photo never leaves this device
      setErr(null);
    } catch {
      setErr("This image couldn't be loaded.");
    }
  };
  const done = r.status === "complete";
  const tool = (label: string, icon: React.ReactNode, onClick: () => void) => (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="h-10 w-10 rounded-full flex items-center justify-center text-ink hover:bg-surface">{icon}</button>
  );

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Header title="My Private Coach" subtitle="Only you can see this conversation." onBack={onBack} backLabel="Back to Shared Table"
        titleClassName="text-green-text"
        backClassName="pl-2 pr-3 bg-sage text-green-text hover:bg-[color-mix(in_srgb,var(--sage),var(--brand)_14%)] active:bg-[color-mix(in_srgb,var(--sage),var(--brand)_22%)] active:scale-[0.98]" />
      {r.endProposal && (
        <div className="px-4 py-2 bg-surface border-b border-line flex items-center gap-3" role="status">
          <span className="flex-1 t-sub">End Game requested — vote on the Shared Table.</span>
          <Btn variant="secondary" className="min-h-10 px-3" onClick={onBack}>Go Vote</Btn>
        </div>
      )}
      <main ref={coachMain} className="flex-1 px-4 py-6 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="t-section">Ask privately</div>
          <Prose text={`I'm your private Rule Assistant. Ask about ${variant ? variant.name : "Mahjong"} rules or general strategy without sharing it with the table. I can't see your tiles, so describe them in text if you want help thinking a decision through.`} />
          <p className="t-meta text-muted flex items-start gap-1.5"><Lock size={12} strokeWidth={2} className="mt-[3px] shrink-0" /> Your private messages are tied to your seat on this device. The host and other players can't open them.</p>
          {r.status === "playing" && <Btn variant="secondary" className="self-start mt-1" onClick={() => setCheckOpen(true)}>Check My Hand</Btn>}
        </div>
        {msgs === null ? <p className="t-sub text-muted">Loading…</p> : <MessageList messages={msgs} me={me} onDetail={setDetail} onAction={onAction} onReact={react} busy={thinking} />}
        {thinking && <Typing />}
        {err && <p className="t-sub text-[#B42318] dark:text-[#FF6961]" role="alert">{err}</p>}
      </main>
      <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      <Composer
        inputRef={inputRef}
        placeholder="Ask your private coach..."
        onAsk={(t) => post({ question: t }, t)}
        floating={<NewMessagesPill count={coachScroll.unread} onClick={coachScroll.jump} />}
        busy={thinking}
        disabled={done}
        disabledText="This session has ended."
        leading={<>{tool("Upload Photo", <ImagePlus size={19} strokeWidth={1.75} />, () => uploadRef.current?.click())}{tool("Use Camera", <Camera size={19} strokeWidth={1.75} />, () => cameraRef.current?.click())}</>}
        above={image ? (
          <div className="mb-2 p-3 bg-bg border border-line rounded-2xl flex flex-col gap-2">
            <div className="flex gap-3 items-start">
              <img src={image} alt="Your selected photo" className="max-h-28 max-w-[45%] w-auto rounded-lg border border-line object-contain" />
              <p className="flex-1 t-meta text-muted">Photo analysis is not available in this free demo. You can describe your tiles using text instead. The photo stays on your phone.</p>
              <button onClick={() => setImage(null)} aria-label="Remove photo" className="h-9 w-9 -mt-1 -mr-1 rounded-full flex items-center justify-center hover:bg-surface"><X size={18} /></button>
            </div>
            <input value={imgQ} onChange={(e) => setImgQ(e.target.value)} placeholder="Optional question about your tiles" className="h-11 px-3 rounded-xl border border-line outline-none focus:border-green" />
            <Btn disabled={thinking} onClick={() => { setImage(null); post({ photo: true, question: imgQ }, imgQ || "Can you look at my tiles?", true); setImgQ(""); }}><Sparkles size={16} strokeWidth={1.75} /> Ask About This Photo</Btn>
          </div>
        ) : null}
      />
      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail?.title || "Details"}>
        {detail && (<><Prose text={detail.detail || detail.text} />{detail.source && <p className="t-meta text-muted mt-4 pt-3 border-t border-line">Source: {detail.source}</p>}</>)}
      </Sheet>
      <Sheet open={browse} onClose={() => setBrowse(false)} title="Rule topics">
        <TopicList variant={r.variant} onPick={(id) => { setBrowse(false); onAction({ label: entryById(id)?.topic || "Explain", type: "followup", topicId: id, facet: "short" }); }} />
      </Sheet>
      <CheckMyHand r={r} me={me} open={checkOpen} onClose={() => setCheckOpen(false)} onDeclare={async (claim, idem) => {
        try { await act({ type: "event-submit", eventType: "win", idem, claim }); onBack(); } catch (e) { setErr((e as Error).message); }
      }} />
    </div>
  );
}

// ---------------- complete ----------------
function Complete({ r, me, actions }: { r: PublicRoom; me: string; actions: Actions }) {
  const router = useRouter();
  const [text, setText] = useState(r.reflections[me] || "");
  const [saved, setSaved] = useState(false);
  const { busy, run } = useBusy();
  const shared = r.players.filter((p) => r.reflections[p.id]);
  const reflection = (
    <section className="flex flex-col gap-2">
      <label htmlFor="refl" className="t-section">What did you discover today?</label>
      <p className="t-sub text-muted -mt-1">Optional. Shared with your group.</p>
      <textarea id="refl" rows={3} value={text} onChange={(e) => { setText(e.target.value); setSaved(false); }} className="rounded-xl border border-line bg-bg px-3 py-2 outline-none focus:border-green resize-none t-body" placeholder="One rule I learned, something that surprised me…" />
      <Btn variant="secondary" disabled={busy} onClick={() => run(async () => { await actions.act({ type: "reflect", text }); setSaved(true); })}>{saved ? <><Check size={16} className="text-green" /> Saved</> : "Share Reflection"}</Btn>
      {shared.map((p) => (
        <div key={p.id} className="flex flex-col gap-0.5 pt-2"><div className="t-meta text-muted">{p.name}</div><div className="t-body whitespace-pre-wrap">{r.reflections[p.id]}</div></div>
      ))}
    </section>
  );
  return <FinalResults r={r} me={me} onHome={() => { forgetRoom(r.code); router.push("/"); }} reflection={reflection} />;
}
