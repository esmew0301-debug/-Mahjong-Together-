"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { BookOpen, Camera, Check, Copy, Flag, HelpCircle, ImagePlus, ListChecks, Lock, MoreHorizontal, Sparkles, Users, X } from "lucide-react";
import { api, openQuestionCount, rememberRoom, useRoom } from "@/lib/client";
import type { Msg, MsgAction, PublicPlayer, PublicRoom } from "@/lib/types";
import { topicsForBrowse } from "@/lib/mahjong/assistant";
import { entryById } from "@/lib/mahjong/intent-matcher";
import { VARIANTS, fill, stepById, variantById, visibleSteps, type Step, type Variant } from "@/lib/variants";
import { Avatar, Btn, Composer, Header, IconBtn, MessageList, Prose, Sheet, Typing, cx } from "./ui";

type Detail = { title: string; body: string; source?: string } | null;
type Actions = ReturnType<typeof useRoom>;

// ---------------- shared bits ----------------
function Panel({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <section aria-label={label} className="border border-line rounded-xl bg-white p-4 flex flex-col gap-3">
      {children}
    </section>
  );
}

function Statuses({ players, value, labels }: { players: PublicPlayer[]; value: (p: PublicPlayer) => string | undefined; labels: Record<string, { text: string; ok?: boolean }> }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {players.map((p) => {
        const v = value(p);
        const l = v ? labels[v] || { text: v } : null;
        return (
          <li key={p.id} className="flex items-center gap-2 t-sub">
            <Avatar name={p.name} size={24} dim={!v} />
            <span className="flex-1 min-w-0 truncate">{p.name}</span>
            <span className={cx("shrink-0 flex items-center gap-1", l?.ok ? "text-ok font-medium" : l ? "text-ink" : "text-muted")}>
              {l?.ok && <Check size={14} strokeWidth={2.25} />}
              {l ? l.text : "Waiting"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Count({ n, label }: { n: number; label: string }) {
  return (
    <span className={cx("t-meta font-medium", n === 4 ? "text-ok" : "text-muted")} aria-live="polite">
      {n}/4 {label}
    </span>
  );
}

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
  useEffect(() => {
    if (room.data) rememberRoom(code);
  }, [room.data, code]);

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
  if (r.status === "lobby") return <Lobby r={r} me={me} actions={room} />;
  if (r.status === "complete") return <Complete r={r} me={me} actions={room} />;
  if (view === "coach") return <Coach r={r} me={me} onBack={() => setView("table")} />;
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
          <ul className="mt-3 border border-line rounded-xl divide-y divide-line">
            {[0, 1, 2, 3].map((seat) => {
              const p = r.players.find((x) => x.seat === seat);
              if (!p)
                return (
                  <li key={seat} className="min-h-14 px-3 flex items-center gap-3 text-muted">
                    <span className="h-8 w-8 rounded-full border border-dashed border-[#CFCFCF]" aria-hidden />
                    <span className="t-sub">Waiting for Player {seat + 1}</span>
                  </li>
                );
              return (
                <li key={p.id} className="min-h-14 px-3 flex items-center gap-3">
                  <Avatar name={p.name} />
                  <div className="flex-1 min-w-0">
                    <div className="t-body font-medium truncate">{p.name}{p.id === me && <span className="text-muted font-normal"> (you)</span>}</div>
                    <div className="t-meta text-muted flex items-center gap-1.5">
                      <span className={cx("h-1.5 w-1.5 rounded-full", p.presence === "online" ? "bg-ok" : "bg-[#B4B4B4]")} />
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
      <div className="sticky bottom-0 bg-white px-4 pt-3 pb-safe border-t border-line flex flex-col gap-2">
        {error && <p className="t-sub text-[#B42318] text-center">{error}</p>}
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
  const count = r.messages.length;

  useEffect(() => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }, [count, r.status, r.stepId, !!r.check]);

  const ask = (q: string) => run(async () => { setThinking(true); try { await actions.ask(q); } finally { setThinking(false); } });
  const summarize = () => run(async () => { setThinking(true); try { await actions.summarize(); } finally { setThinking(false); } });
  const act = (a: Record<string, unknown>) => run(() => actions.act(a));
  const [browse, setBrowse] = useState(false);
  const withThinking = (fn: () => Promise<unknown>) => run(async () => { setThinking(true); try { await fn(); } finally { setThinking(false); } });
  const onAction = (a: MsgAction) => {
    if (a.type === "followup" && a.topicId) withThinking(() => actions.followup(a.topicId!, a.facet || "short"));
    else if (a.type === "current") withThinking(() => actions.current());
    else if (a.type === "browse") setBrowse(true);
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

  let panel: React.ReactNode = null;
  if (r.status === "variant") panel = <VariantPanel r={r} me={me} act={act} showVariant={showVariant} busy={busy} />;
  else if (r.check) panel = <CheckPanel r={r} me={me} act={act} onAction={onAction} viewRule={viewRule} busy={busy || thinking} />;
  else if (r.status === "setup" && step) panel = <StepPanel r={r} me={me} step={step} act={act} explain={() => onAction({ label: "", type: "current" })} busy={busy || thinking} focus={() => inputRef.current?.focus()} details={() => setDetail({ title: step.title, body: fill(step.detail, r.decisions), source: step.source })} />;
  else if (r.status === "playing")
    panel = (
      <Panel label="Game in progress">
        <div>
          <div className="t-section">Game in Progress</div>
          <p className="t-sub text-muted">Play at your own pace. Ask whenever you need help.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn variant="secondary" className="px-3.5" onClick={() => inputRef.current?.focus()}><Users size={16} strokeWidth={1.75} /> Ask the Group</Btn>
          <Btn variant="secondary" className="px-3.5" onClick={() => inputRef.current?.focus()}><Sparkles size={16} strokeWidth={1.75} /> Ask Rule Assistant</Btn>
          <Btn variant="secondary" className="px-3.5" onClick={openCoach}><Lock size={16} strokeWidth={1.75} /> My Private Coach</Btn>
          <Btn variant="secondary" className="px-3.5" onClick={reviewRules}><BookOpen size={16} strokeWidth={1.75} /> Review Rules</Btn>
        </div>
        {isHost ? (
          <Btn onClick={() => act({ type: "finish-request" })} disabled={busy}><Flag size={16} strokeWidth={1.75} /> Finish Game</Btn>
        ) : (
          <p className="t-meta text-muted">The host can finish the game when your group is done.</p>
        )}
      </Panel>
    );
  else if (r.status === "finishing" && r.finish) {
    const mine = r.finish[me];
    panel = (
      <Panel label="Finish game">
        <div className="flex items-center justify-between gap-2">
          <div className="t-section">Ready to End This Session?</div>
          <Count n={Object.keys(r.finish).length} label="confirmed" />
        </div>
        <Statuses players={r.players} value={(p) => r.finish![p.id]} labels={{ yes: { text: "Yes, finish", ok: true } }} />
        <div className="grid grid-cols-2 gap-2">
          <Btn variant={mine === "yes" ? "ok" : "primary"} disabled={busy || mine === "yes"} onClick={() => act({ type: "finish", value: "yes" })}>{mine === "yes" ? <><Check size={16} /> Confirmed</> : "Yes, Finish"}</Btn>
          <Btn variant="secondary" disabled={busy} onClick={() => act({ type: "finish", value: "no" })}>Keep Playing</Btn>
        </div>
      </Panel>
    );
  }

  const canFacilitate = r.status === "setup" || r.status === "playing";
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Header
        title={r.name}
        subtitle={`Shared Table · ${variant ? variant.name : "Choosing a variant"}`}
        onBack={() => router.push("/")}
        right={
          <>
            <IconBtn label="Participants" onClick={() => setPeople(true)}>
              <span className="relative">
                <Users size={19} strokeWidth={1.75} />
                {online < r.players.length && <span className="absolute -top-0.5 -right-1 h-2 w-2 rounded-full bg-[#B4B4B4] ring-2 ring-white" />}
              </span>
            </IconBtn>
            <IconBtn label="My Private Coach" onClick={openCoach}><Lock size={19} strokeWidth={1.75} /></IconBtn>
            <IconBtn label="Menu" onClick={() => setMenu(true)}><MoreHorizontal size={20} strokeWidth={1.75} /></IconBtn>
          </>
        }
      >
        {actions.conn === "retrying" && <div className="px-4 py-1.5 t-meta text-muted border-t border-line">Reconnecting…</div>}
      </Header>

      <main className="flex-1 px-4 py-6 flex flex-col gap-6">
        <MessageList messages={r.messages.filter((m) => !(m.sender === "system" && /created the room|joined the room/.test(m.text)))} me={me} players={r.players} onDetail={showMsg} onAction={onAction} busy={thinking} />
        {thinking && <Typing />}
        {panel}
        {error && <p className="t-sub text-[#B42318]" role="alert">{error}</p>}
      </main>

      <Composer
        inputRef={inputRef}
        placeholder={needsHelp ? "Which part should we review?" : "Message the table or ask a question..."}
        onSend={(t) => act({ type: "message", text: t })}
        onAsk={ask}
        preferAsk={needsHelp}
        busy={thinking}
        above={
          canFacilitate ? (
            <div className="flex gap-2 pb-2 overflow-x-auto no-scrollbar">
              <button onClick={summarize} disabled={thinking} className={cx("h-9 px-3 rounded-full border t-sub shrink-0 flex items-center gap-1.5", openQs >= 2 ? "border-ink text-ink font-medium" : "border-line text-ink")}>
                <ListChecks size={15} strokeWidth={1.75} /> Summarize Questions{openQs ? ` (${openQs})` : ""}
              </button>
              {!r.check && (
                <button onClick={() => act({ type: "check-start" })} className="h-9 px-3 rounded-full border border-line t-sub shrink-0 flex items-center gap-1.5">
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
          {variant && <Btn variant="secondary" onClick={() => { setMenu(false); reviewRules(); }}><BookOpen size={16} strokeWidth={1.75} /> Rule guide</Btn>}
          <p className="t-sub text-muted">
            Room {r.code}. Answers come from the built-in Mahjong Rule Assistant — prepared, sourced rule notes matched to your question. It isn't a generative AI, and no questions are sent to any AI service.
            {data.backend === "dev-file" ? " Using the local development store (this computer only)." : ""}
          </p>
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
      <ul className="flex flex-col divide-y divide-line -mx-1">
        {VARIANTS.map((v) => {
          const mine = r.votes[me] === v.id;
          const voters = r.players.filter((p) => r.votes[p.id] === v.id);
          return (
            <li key={v.id} className="py-3 px-1">
              <button disabled={busy} onClick={() => act({ type: "vote", variant: v.id })} className="w-full text-left flex gap-3" aria-pressed={mine}>
                <span className={cx("mt-0.5 h-5 w-5 rounded-full border shrink-0 flex items-center justify-center", mine ? "bg-ink border-ink text-white" : "border-[#CFCFCF]")}>
                  {mine && <Check size={12} strokeWidth={3} />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block t-body font-medium">{v.name}</span>
                  <span className="block t-meta text-muted">{v.region}</span>
                  <span className="block t-sub mt-0.5">{v.intro}</span>
                </span>
              </button>
              <div className="flex items-center justify-between gap-2 mt-1.5 pl-8">
                <button onClick={() => showVariant(v)} className="t-sub text-muted underline underline-offset-4 decoration-line min-h-9 text-left">Rules &amp; Cultural Background</button>
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
        <span className={cx("t-meta font-medium", Object.values(c.resp).filter((v) => v === "yes").length === 4 ? "text-ok" : "text-muted")} aria-live="polite">{Object.values(c.resp).filter((v) => v === "yes").length} of 4 Understand</span>
        <div className="t-section">{c.round > 1 ? "Does Everyone Understand Now?" : "Does Everyone Understand?"}</div>
      </div>
      <p className="t-sub text-muted -mt-2">{c.topic}. We'll continue only when everyone understands.</p>
      <Statuses players={r.players} value={(p) => c.resp[p.id]} labels={{ yes: { text: "Understands", ok: true }, no: { text: "Needs clarification" } }} />
      <div className="grid grid-cols-[1.5fr_1fr] gap-2">
        <Btn variant={mine === "yes" ? "ok" : "primary"} disabled={busy || mine === "yes"} onClick={() => act({ type: "check", value: "yes" })}>{mine === "yes" ? <><Check size={16} /> I understand</> : <span className="whitespace-nowrap">Yes, I Understand</span>}</Btn>
        <Btn variant={mine === "no" ? "chosen" : "secondary"} disabled={busy || mine === "no"} onClick={() => act({ type: "check", value: "no" })}>Not Yet</Btn>
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

function StepPanel({ r, me, step, act, explain, busy, focus, details }: { r: PublicRoom; me: string; step: Step; act: (a: Record<string, unknown>) => void; explain: () => void; busy: boolean; focus: () => void; details: () => void }) {
  const [total, setTotal] = useState<string>("");
  const [d1, setD1] = useState<number | null>(null);
  const [d2, setD2] = useState<number | null>(null);
  const steps = visibleSteps(step.variant, r.decisions);
  const idx = steps.findIndex((s) => s.id === step.id);
  const mine = r.resp[me];
  const dealer = r.players.find((p) => p.id === r.dealerId);
  const helpRow = (
    <div className="flex gap-1 flex-wrap border-t border-line pt-2 -mx-2">
      <button disabled={busy} onClick={explain} className="t-sub min-h-10 px-2 rounded-full flex items-center gap-1.5 hover:bg-surface disabled:opacity-40"><HelpCircle size={16} strokeWidth={1.75} /> Need an Explanation?</button>
      <button onClick={focus} className="t-sub min-h-10 px-2 rounded-full flex items-center gap-1.5 hover:bg-surface"><Users size={16} strokeWidth={1.75} /> Ask the Group</button>
    </div>
  );
  const head = (label: string, n?: number, nLabel?: string) => (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between gap-2">
        <span className="t-meta text-muted">Step {idx + 1} of {steps.length}{step.ruleType !== "mandatory" ? ` · ${step.ruleType === "optional" ? "Optional rule" : "House rule"}` : ""}</span>
        {n !== undefined && <Count n={n} label={nLabel || ""} />}
      </div>
      <div className="t-section">{label}</div>
      <div className="flex gap-1 mt-1" aria-hidden>
        {steps.map((s, i) => <span key={s.id} className={cx("h-1 flex-1 rounded-full", i < idx ? "bg-ok" : i === idx ? "bg-ink" : "bg-line")} />)}
      </div>
    </div>
  );
  const doneCount = r.players.filter((p) => r.resp[p.id] === "done").length;
  const completion = (q: string, yes = "Yes, Done") => (
    <>
      {head(q, doneCount, "done")}
      <Statuses players={r.players} value={(p) => r.resp[p.id]} labels={{ done: { text: "Done", ok: true }, notyet: { text: "Not yet" } }} />
      <div className="grid grid-cols-2 gap-2">
        <Btn variant={mine === "done" ? "ok" : "primary"} disabled={busy || mine === "done"} onClick={() => act({ type: "respond", value: "done" })}>{mine === "done" ? <><Check size={16} /> Done</> : yes}</Btn>
        <Btn variant={mine === "notyet" ? "chosen" : "secondary"} disabled={busy || mine === "notyet"} onClick={() => act({ type: "respond", value: "notyet" })}>Not Yet</Btn>
      </div>
      {mine === "notyet" && <p className="t-meta text-muted">Take your time. Ask the Rule Assistant or the group if you're stuck.</p>}
    </>
  );

  let body: React.ReactNode;
  if (step.kind === "consensus") {
    const votes = r.players.map((p) => r.resp[p.id]);
    const all = votes.every(Boolean);
    const differ = all && !votes.every((v) => v === votes[0]);
    body = (
      <>
        {head(step.question || step.title, votes.filter(Boolean).length, "chosen")}
        <div className={cx("grid gap-2", step.options!.length === 2 ? "grid-cols-2" : "grid-cols-1")}>
          {step.options!.map((o) => (
            <Btn key={o.id} variant={mine === o.id ? "selected" : "secondary"} disabled={busy} onClick={() => act({ type: "respond", value: o.id })}>
              {mine === o.id && <Check size={16} />} {o.label}
            </Btn>
          ))}
        </div>
        <Statuses players={r.players} value={(p) => (r.resp[p.id] ? step.options!.find((o) => o.id === r.resp[p.id])?.label : undefined)} labels={{}} />
        {differ && !step.veto && (
          <div className="bg-surface rounded-xl p-3">
            <div className="t-section">Agreement Needed</div>
            <p className="t-sub text-muted">Your group hasn't reached a shared decision yet. Explain your reasoning in the chat and change your choice if you like.</p>
          </div>
        )}
        {step.veto && <p className="t-meta text-muted">Any one player can say No to stop this — no explanation needed.</p>}
      </>
    );
  } else if (step.kind === "dice-dealer") {
    const contenders = r.decisions.dealerContenders ? r.decisions.dealerContenders.split(",") : r.players.map((p) => p.id);
    const myTurn = contenders.includes(me) && r.dice[me] === undefined;
    body = (
      <>
        {head("Roll two dice and enter your total", Object.keys(r.dice).length, "entered")}
        <p className="t-sub text-muted -mt-1">Use your real dice. The highest total becomes the dealer; ties roll again.</p>
        <Statuses players={r.players} value={(p) => (r.dice[p.id] !== undefined ? String(r.dice[p.id]) : contenders.includes(p.id) ? undefined : "—")} labels={{}} />
        {myTurn ? (
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); act({ type: "dice", value: Number(total) }); setTotal(""); }}>
            <input type="number" inputMode="numeric" min={2} max={12} value={total} onChange={(e) => setTotal(e.target.value)} placeholder="Your total (2–12)" aria-label="Your dice total" className="flex-1 min-w-0 h-11 px-4 rounded-full border border-line outline-none focus:border-ink" />
            <Btn type="submit" disabled={busy || !(Number(total) >= 2 && Number(total) <= 12)}>Submit</Btn>
          </form>
        ) : (
          <p className="t-meta text-muted">{contenders.includes(me) ? "Your roll is in. Waiting for the others." : "Waiting for the tied players to roll again."}</p>
        )}
      </>
    );
  } else if (step.kind === "dice-break") {
    const canEnter = !r.dealerId || r.dealerId === me;
    if (!r.breakRoll) {
      const die = (val: number | null, set: (n: number) => void, label: string) => (
        <div className="flex flex-col gap-1">
          <span className="t-meta text-muted">{label}</span>
          <div className="grid grid-cols-6 gap-1">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button key={n} type="button" onClick={() => set(n)} aria-pressed={val === n} className={cx("h-11 rounded-lg border t-btn", val === n ? "bg-ink text-white border-ink" : "border-line")}>{n}</button>
            ))}
          </div>
        </div>
      );
      body = (
        <>
          {head(canEnter ? "Roll two dice and enter both numbers" : `Waiting for ${dealer?.name || "the dealer"} to roll`)}
          {canEnter ? (
            <>
              {die(d1, setD1, "First die")}
              {die(d2, setD2, "Second die")}
              <Btn disabled={busy || !d1 || !d2} onClick={() => act({ type: "break", d1, d2 })}>Submit Dice</Btn>
            </>
          ) : (
            <p className="t-sub text-muted">{dealer?.name || "The dealer"} rolls two real dice and enters them on their phone. Then everyone follows the instruction.</p>
          )}
        </>
      );
    } else body = completion(step.question || "Has the wall been broken?");
  } else {
    body = completion(step.question || "Has everyone completed this step?", step.kind === "begin" ? "Yes, Ready to Play" : "Yes, Done");
  }

  return (
    <Panel label={step.title}>
      {body}
      <button onClick={details} className="self-start t-sub text-muted underline underline-offset-4 decoration-line min-h-8">Detailed instructions</button>
      {helpRow}
    </Panel>
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

function Coach({ r, me, onBack }: { r: PublicRoom; me: string; onBack: () => void }) {
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
  useEffect(() => {
    window.scrollTo({ top: document.body.scrollHeight });
  }, [msgs?.length, thinking]);

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
      <Header title="My Private Coach" subtitle="Only you can see this conversation." onBack={onBack} backLabel="Back to Shared Table" />
      <main className="flex-1 px-4 py-6 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="t-section">Ask privately</div>
          <Prose text={`I'm your private Rule Assistant. Ask about ${variant ? variant.name : "Mahjong"} rules or general strategy without sharing it with the table. I can't see your tiles, so describe them in text if you want help thinking a decision through.`} />
          <p className="t-meta text-muted flex items-start gap-1.5"><Lock size={12} strokeWidth={2} className="mt-[3px] shrink-0" /> Your private messages are tied to your seat on this device. The host and other players can't open them.</p>
        </div>
        {msgs === null ? <p className="t-sub text-muted">Loading…</p> : <MessageList messages={msgs} me={me} onDetail={setDetail} onAction={onAction} busy={thinking} />}
        {thinking && <Typing />}
        {err && <p className="t-sub text-[#B42318]" role="alert">{err}</p>}
      </main>
      <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      <Composer
        inputRef={inputRef}
        placeholder="Ask your private coach..."
        onAsk={(t) => post({ question: t }, t)}
        busy={thinking}
        disabled={done}
        disabledText="This session has ended."
        leading={<>{tool("Upload Photo", <ImagePlus size={19} strokeWidth={1.75} />, () => uploadRef.current?.click())}{tool("Use Camera", <Camera size={19} strokeWidth={1.75} />, () => cameraRef.current?.click())}</>}
        above={image ? (
          <div className="mb-2 p-3 bg-white border border-line rounded-2xl flex flex-col gap-2">
            <div className="flex gap-3 items-start">
              <img src={image} alt="Your selected photo" className="max-h-28 max-w-[45%] w-auto rounded-lg border border-line object-contain" />
              <p className="flex-1 t-meta text-muted">Photo analysis is not available in this free demo. You can describe your tiles using text instead. The photo stays on your phone.</p>
              <button onClick={() => setImage(null)} aria-label="Remove photo" className="h-9 w-9 -mt-1 -mr-1 rounded-full flex items-center justify-center hover:bg-surface"><X size={18} /></button>
            </div>
            <input value={imgQ} onChange={(e) => setImgQ(e.target.value)} placeholder="Optional question about your tiles" className="h-11 px-3 rounded-xl border border-line outline-none focus:border-ink" />
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
    </div>
  );
}

// ---------------- complete ----------------
function Complete({ r, me, actions }: { r: PublicRoom; me: string; actions: Actions }) {
  const router = useRouter();
  const [text, setText] = useState(r.reflections[me] || "");
  const [saved, setSaved] = useState(false);
  const { busy, run } = useBusy();
  const variant = variantById(r.variant);
  const shared = useMemo(() => r.players.filter((p) => r.reflections[p.id]), [r]);
  return (
    <div className="min-h-[100dvh] flex flex-col pt-safe">
      <div className="h-14 px-4 flex items-center t-app">Mahjong Together</div>
      <main className="flex-1 px-4 py-6 flex flex-col gap-8">
        <div>
          <div className="h-10 w-10 rounded-full border border-ok text-ok flex items-center justify-center mb-4"><Check size={22} strokeWidth={2} /></div>
          <h1 className="t-app">Session Complete!</h1>
          <p className="t-body text-muted mt-1">Thanks for learning and playing together.</p>
          <p className="t-meta text-muted mt-2">{r.name} · {variant?.name} · This session has ended.</p>
        </div>
        <section className="flex flex-col gap-2">
          <label htmlFor="refl" className="t-section">What did you discover today?</label>
          <p className="t-sub text-muted -mt-1">Optional. Shared with your group.</p>
          <textarea id="refl" rows={3} value={text} onChange={(e) => { setText(e.target.value); setSaved(false); }} className="rounded-xl border border-line px-3 py-2 outline-none focus:border-ink resize-none t-body" placeholder="One rule I learned, something that surprised me, what I'd like to explore next…" />
          <Btn variant="secondary" disabled={busy} onClick={() => run(async () => { await actions.act({ type: "reflect", text }); setSaved(true); })}>{saved ? <><Check size={16} className="text-ok" /> Saved</> : "Share Reflection"}</Btn>
        </section>
        {shared.length > 0 && (
          <section className="flex flex-col gap-4">
            <div className="t-section">Group reflections</div>
            {shared.map((p) => (
              <div key={p.id} className="flex flex-col gap-1">
                <div className="t-meta text-muted">{p.name}</div>
                <div className="t-body whitespace-pre-wrap">{r.reflections[p.id]}</div>
              </div>
            ))}
          </section>
        )}
      </main>
      <div className="sticky bottom-0 bg-white px-4 pt-3 pb-safe border-t border-line">
        <Btn className="w-full" onClick={() => router.push("/")}>Back to Home</Btn>
      </div>
    </div>
  );
}
