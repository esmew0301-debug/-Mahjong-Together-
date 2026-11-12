"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { BookOpen, ChevronDown, ChevronRight, ClipboardList, Crown, Flag, ListOrdered, Lock, Plus, Trash2 } from "lucide-react";
import type { GameEvent, MsgAction, PublicRoom } from "@/lib/types";
import { variantById } from "@/lib/variants";
import { MANUAL_NOTE, profileFor, type Transfer } from "@/lib/scoring";
import { exhaustCalc, kongCalc, winCalc } from "@/lib/scoring/sichuan";
import { Btn, Count, Panel, Sheet, Statuses, cx } from "./ui";
import { Confetti, type ConfettiRef } from "./ui/confetti";
import { ThemeToggle } from "./ui/theme-toggle";

type Act = (a: Record<string, unknown>) => void;
const newIdem = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now());
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

// ---------- derived data (all from committed ledger entries) ----------
export function useScores(r: PublicRoom) {
  return useMemo(() => {
    const totals: Record<string, number> = Object.fromEntries(r.players.map((p) => [p.id, 0]));
    for (const l of r.ledger || []) {
      totals[l.from] = (totals[l.from] || 0) - l.amount;
      totals[l.to] = (totals[l.to] || 0) + l.amount;
    }
    const committed = (r.events || []).filter((e) => e.status === "committed");
    const invalidated = new Set(committed.filter((e) => e.type === "correction" && e.claim.invalidWin).map((e) => e.claim.corrects as string));
    const wins: Record<string, number> = {};
    const kongs: Record<string, number> = {};
    for (const e of committed) {
      if (e.type === "win" && e.actor && !invalidated.has(e.id)) wins[e.actor] = (wins[e.actor] || 0) + 1;
      if (e.type === "kong") {
        const a = e.claim.actorId as string;
        kongs[a] = (kongs[a] || 0) + 1;
      }
    }
    const handsPlayed = (r.hands || []).length;
    return { totals, wins, kongs, handsPlayed, committed };
  }, [r.ledger, r.events, r.hands, r.players]);
}

const nameIn = (r: PublicRoom) => (id?: string | null) => r.players.find((p) => p.id === id)?.name || "Player";

export function describeEvent(r: PublicRoom, e: GameEvent) {
  const n = nameIn(r);
  const c = e.claim as Record<string, string | undefined>;
  const M: Record<string, string> = { self_draw: "self-draw (Zi Mo)", discard: "on a discard (Dian Pao)", kong_replacement: "kong replacement", robbing_kong: "robbing a kong" };
  const S: Record<string, string> = { standard: "standard hand", seven_pairs: "seven pairs", all_pungs: "all pungs", other: "other" };
  const K: Record<string, string> = { concealed: "Concealed kong", exposed: "Exposed kong", added: "Added kong" };
  if (e.type === "win") return { title: `${n(e.actor)} — Win (Hu)`, sub: `${M[c.method || ""] || ""}${c.fromId ? ` from ${n(c.fromId)}` : ""} · ${S[c.structure || ""] || ""}` };
  if (e.type === "kong") return { title: `${n(c.actorId)} — ${K[c.kind || ""] || "Kong"}`, sub: c.fromId ? `from ${n(c.fromId)}'s discard` : "" };
  if (e.type === "exhaust") return { title: "Wall exhausted", sub: "End-of-hand settlement" };
  if (e.type === "correction") return { title: "Correction", sub: c.reason || "" };
  return { title: "Manual score entry", sub: c.note || "" };
}

export const topicForEvent = (r: PublicRoom, e: GameEvent) =>
  r.variant !== "sichuan" ? null : e.type === "kong" ? "sc-kong" : e.type === "exhaust" ? "sc-wallend" : e.type === "win" ? "sc-scoring" : "sc-scoring";

function TransferList({ r, transfers }: { r: PublicRoom; transfers: Transfer[] }) {
  const n = nameIn(r);
  if (!transfers.length) return <p className="t-sub text-muted">No points change.</p>;
  return (
    <ul className="flex flex-col gap-1">
      {transfers.map((t, i) => (
        <li key={i} className="t-sub flex items-center gap-2">
          <span className="flex-1 min-w-0 truncate">{n(t.from)} → {n(t.to)}</span>
          <span className="font-medium tabular-nums">{t.amount}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------- Game bar (playing) ----------
export function GameBar({ r, me, act, busy, openRecord, openScores, reviewRules, openCoach }: { r: PublicRoom; me: string; act: Act; busy: boolean; openRecord: () => void; openScores: () => void; reviewRules: () => void; openCoach: () => void }) {
  const [open, setOpen] = useState(false);
  const [finishBlock, setFinishBlock] = useState(false);
  const { totals } = useScores(r);
  const pending = (r.events || []).filter((e) => e.status === "pending");
  const v = variantById(r.variant);
  const isHost = r.hostId === me;
  const n = nameIn(r);
  const rows = [
    { label: "Record Event", icon: <ClipboardList size={20} strokeWidth={1.75} />, onClick: openRecord },
    { label: "View Scores", icon: <ListOrdered size={20} strokeWidth={1.75} />, onClick: openScores },
    { label: "Review Rules", icon: <BookOpen size={20} strokeWidth={1.75} />, onClick: reviewRules },
    { label: "My Private Coach", icon: <Lock size={20} strokeWidth={1.75} />, onClick: openCoach },
    ...(isHost ? [{ label: "Finish Session", icon: <Flag size={20} strokeWidth={1.75} />, onClick: () => (pending.length ? setFinishBlock(true) : act({ type: "finish-request" })) }] : []),
  ];
  return (
    <Panel label="Game in progress">
      <div>
        <div className="t-section">Game in Progress</div>
        <p className="t-sub text-muted">
          Hand {r.hand?.n ?? 1} · {v?.name}{r.hand?.dealerId ? ` · Dealer ${n(r.hand.dealerId)}` : ""}
          {r.hand && r.hand.winners.length > 0 && profileFor(r.variant).winnersLeave ? ` · Won: ${r.hand.winners.map(n).join(", ")}` : ""}
        </p>
      </div>
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-center gap-2 text-left rounded-[12px] bg-surface px-3 min-h-11">
        <span className="flex-1 min-w-0 t-sub truncate">
          {r.players.map((p) => `${p.name} ${signed(totals[p.id] || 0)}`).join(" · ")}
        </span>
        <ChevronDown size={16} className={cx("text-muted transition-transform shrink-0", open && "rotate-180")} />
      </button>
      {open && (
        <ul className="flex flex-col gap-1 -mt-1 px-1">
          {[...r.players].sort((a, b) => (totals[b.id] || 0) - (totals[a.id] || 0)).map((p) => (
            <li key={p.id} className="flex justify-between t-sub"><span>{p.name}{p.id === me ? " (you)" : ""}</span><span className="font-medium tabular-nums">{signed(totals[p.id] || 0)}</span></li>
          ))}
        </ul>
      )}
      <ul className="-mx-1 rounded-[14px] border border-line divide-y divide-line overflow-hidden">
        {rows.map((it) => (
          <li key={it.label}>
            <button disabled={busy} onClick={it.onClick} className="w-full min-h-12 px-3 flex items-center gap-3 text-left t-body bg-bg hover:bg-surface active:bg-bubble disabled:opacity-60">
              <span className="text-muted">{it.icon}</span>
              <span className="flex-1">{it.label}</span>
              <ChevronRight size={18} strokeWidth={1.75} className="text-muted" />
            </button>
          </li>
        ))}
      </ul>
      {finishBlock && pending.length > 0 && (
        <div className="rounded-[12px] bg-surface p-3 flex flex-col gap-2" role="alert">
          <p className="t-sub">{pending.length} item{pending.length > 1 ? "s" : ""} still need verification. Confirm, correct, or void {pending.length > 1 ? "each one" : "it"} before finishing — nothing is deleted silently.</p>
          <div className="grid grid-cols-2 gap-2">
            <Btn variant="secondary" className="px-2" onClick={() => { document.getElementById(`event-${pending[0].id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); setFinishBlock(false); }}>Review Pending</Btn>
            <Btn variant="ghost" className="px-2" onClick={() => setFinishBlock(false)}>Cancel</Btn>
          </div>
        </div>
      )}
      {!isHost && <p className="t-meta text-muted">The host can finish the session when your group is done.</p>}
    </Panel>
  );
}

// ---------- Pending event card (fourth mechanism: group verification) ----------
export function EventCard({ r, me, e, act, busy, onExplain, onCorrect }: { r: PublicRoom; me: string; e: GameEvent; act: Act; busy: boolean; onExplain: (e: GameEvent) => void; onCorrect: (e: GameEvent) => void }) {
  const [disputing, setDisputing] = useState(false);
  const [note, setNote] = useState("");
  const d = describeEvent(r, e);
  const mine = e.approvals[me];
  const disputed = Object.values(e.approvals).includes("dispute");
  const confirmed = r.players.filter((p) => e.approvals[p.id] === "confirm").length;
  const canEdit = e.type !== "win" || e.actor === me;
  return (
    <section id={`event-${e.id}`} aria-label={`Verify: ${d.title}`} className={cx("border rounded-2xl bg-bg p-4 shadow-card flex flex-col gap-3", disputed ? "border-[#FF9F0A]" : "border-line")}>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="t-meta text-muted">{e.voidProposed ? "Proposal to void" : "Needs verification"} · Hand {e.hand} · Version {e.rev}</span>
          <Count n={confirmed} label="confirmed" />
        </div>
        <div className="t-section">{d.title}</div>
        {d.sub && <p className="t-sub text-muted">{d.sub}</p>}
        {disputed && <p className="t-sub font-medium text-[#B25000] dark:text-[#FFB340]">Disputed — paused until corrected or everyone confirms.</p>}
      </div>
      <div className="rounded-[12px] bg-surface p-3 flex flex-col gap-2">
        <div className="t-meta text-muted">Proposed points</div>
        <TransferList r={r} transfers={e.transfers} />
        <ul className="t-meta text-muted flex flex-col gap-0.5 pt-1 border-t border-line">
          {e.lines.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
        {e.limitations && <p className="t-meta text-[#B25000] dark:text-[#FFB340]">Limitation: {e.limitations}</p>}
        <p className="t-meta text-muted">Rule: {e.ruleVersion}{e.manual ? " · manual group-verified" : ""}</p>
      </div>
      <Statuses players={r.players} value={(p) => e.approvals[p.id]} labels={{ confirm: { text: "Confirmed", ok: true }, explain: { text: "Needs explanation" }, dispute: { text: "Disputes" } }} />
      {e.notes.length > 0 && (
        <ul className="t-meta text-muted flex flex-col gap-0.5">
          {e.notes.slice(-4).map((x, i) => <li key={i}>{nameIn(r)(x.by)} (v{x.rev}): {x.text}</li>)}
        </ul>
      )}
      <div className="grid grid-cols-1 gap-2">
        <Btn variant={mine === "confirm" ? "ok" : "primary"} disabled={busy || mine === "confirm"} onClick={() => act({ type: "event-respond", eventId: e.id, rev: e.rev, value: "confirm" })}>
          {mine === "confirm" ? "You confirmed" : e.voidProposed ? "Confirm Voiding" : "Confirm Result"}
        </Btn>
        <div className="grid grid-cols-2 gap-2">
          <Btn variant={mine === "explain" ? "chosen" : "secondary"} className="px-2 text-[14px]" disabled={busy} onClick={() => { act({ type: "event-respond", eventId: e.id, rev: e.rev, value: "explain" }); onExplain(e); }}>Need Explanation</Btn>
          <Btn variant={mine === "dispute" ? "chosen" : "secondary"} className="px-2 text-[14px]" disabled={busy} onClick={() => setDisputing(!disputing)}>Dispute or Correct</Btn>
        </div>
      </div>
      {disputing && (
        <div className="rounded-[12px] bg-surface p-3 flex flex-col gap-2">
          <input value={note} onChange={(ev) => setNote(ev.target.value)} maxLength={200} placeholder="What's wrong? (optional)" className="h-11 px-3 rounded-xl border border-line bg-bg outline-none focus:border-green" />
          <Btn variant="secondary" disabled={busy} onClick={() => { act({ type: "event-respond", eventId: e.id, rev: e.rev, value: "dispute", note }); setDisputing(false); }}>Dispute (pause this event)</Btn>
          {canEdit && !e.voidProposed && <Btn variant="secondary" disabled={busy} onClick={() => { setDisputing(false); onCorrect(e); }}>Correct the Details</Btn>}
          {!e.voidProposed && <Btn variant="ghost" disabled={busy} onClick={() => { act({ type: "event-revise", eventId: e.id, rev: e.rev, void: true }); setDisputing(false); }}>Propose Voiding This Item</Btn>}
          <p className="t-meta text-muted">Any change creates a new version and everyone confirms again.</p>
        </div>
      )}
    </section>
  );
}

// ---------- shared form bits ----------
function PlayerPick({ r, value, onChange, exclude = [], label }: { r: PublicRoom; value?: string; onChange: (id: string) => void; exclude?: string[]; label: string }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="t-sub font-medium mb-1">{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        {r.players.filter((p) => !exclude.includes(p.id)).map((p) => (
          <Btn key={p.id} variant={value === p.id ? "selected" : "secondary"} className="px-2" onClick={() => onChange(p.id)}>{p.name}</Btn>
        ))}
      </div>
    </fieldset>
  );
}
function Choice<T extends string>({ label, value, options, onChange }: { label: string; value?: T; options: { id: T; label: string; help?: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="t-sub font-medium mb-1">{label}</legend>
      {options.map((o) => (
        <button key={o.id} type="button" onClick={() => onChange(o.id)} aria-pressed={value === o.id}
          className={cx("text-left rounded-[14px] border px-3 py-2.5 min-h-12", value === o.id ? "border-green bg-green-soft" : "border-line bg-bg hover:bg-surface")}>
          <span className="block t-body">{o.label}</span>
          {o.help && <span className="block t-meta text-muted">{o.help}</span>}
        </button>
      ))}
    </fieldset>
  );
}
function TransferEditor({ r, rows, setRows }: { r: PublicRoom; rows: Transfer[]; setRows: (t: Transfer[]) => void }) {
  const ids = r.players.map((p) => p.id);
  const sel = "h-11 rounded-xl border border-line bg-bg px-2 t-sub outline-none focus:border-green min-w-0";
  return (
    <div className="flex flex-col gap-2">
      {rows.map((t, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <select aria-label="Payer" className={cx(sel, "flex-1")} value={t.from} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)))}>
            {r.players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <span className="text-muted">→</span>
          <select aria-label="Recipient" className={cx(sel, "flex-1")} value={t.to} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)))}>
            {r.players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input aria-label="Points" type="number" inputMode="numeric" min={1} className={cx(sel, "w-16 text-center")} value={t.amount || ""} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, amount: Math.round(Number(e.target.value)) } : x)))} />
          <button type="button" aria-label="Remove transfer" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="h-11 w-9 flex items-center justify-center text-muted"><Trash2 size={16} /></button>
        </div>
      ))}
      <Btn variant="ghost" onClick={() => setRows([...rows, { from: ids[1] || ids[0], to: ids[0], amount: 1 }])}><Plus size={16} /> Add Transfer</Btn>
    </div>
  );
}

// ---------- Record Event sheet + wizards ----------
type Mode = "menu" | "win" | "kong" | "exhaust" | "correct" | "history" | "manual";
export interface WinPrefill { method?: string; fromId?: string; structure?: string; pureSuit?: boolean; roots?: number; goldenHook?: boolean; lastTile?: boolean; missingSuitCleared?: string }

export function RecordEventSheet({ r, me, open, onClose, act, busy, initial, revise, prefill }: { r: PublicRoom; me: string; open: boolean; onClose: () => void; act: Act; busy: boolean; initial?: Mode; revise?: GameEvent | null; prefill?: WinPrefill | null }) {
  const [mode, setMode] = useState<Mode>("menu");
  const [idem, setIdem] = useState(newIdem());
  const [claim, setClaim] = useState<Record<string, any>>({});
  const [rows, setRows] = useState<Transfer[]>([]);
  const [corrects, setCorrects] = useState<string>("");
  const prof = profileFor(r.variant);
  const n = nameIn(r);
  const winners = r.hand?.winners || [];
  const active = r.players.map((p) => p.id).filter((id) => !(prof.winnersLeave && winners.includes(id)));
  useEffect(() => {
    if (!open) return;
    setIdem(newIdem());
    if (revise) {
      setMode(revise.type === "correction" ? "correct" : (revise.type as Mode));
      setClaim({ ...revise.claim });
      setRows(revise.transfers.map((t) => ({ ...t })));
      setCorrects((revise.claim.corrects as string) || "");
    } else {
      setMode(initial || "menu");
      setClaim(prefill ? { ...prefill } : {});
      setRows([]);
      setCorrects("");
    }
  }, [open, initial, revise, prefill]);

  const inHand = r.status === "playing" && !r.hand?.ended;
  const committedOpen = (r.events || []).filter((e) => e.status === "committed" && !e.correctedBy && e.type !== "correction");
  const preview = useMemo(() => {
    if (!prof.automatic) return null;
    try {
      if (mode === "win") return winCalc(me, claim as any, active, n);
      if (mode === "kong" && claim.actorId) return kongCalc(claim as any, active, n);
      if (mode === "exhaust") return exhaustCalc(claim as any, active, [], n);
    } catch {}
    return null;
  }, [mode, claim, active.join(), me]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (eventType: string, extra: Record<string, unknown> = {}) => {
    if (revise) act({ type: "event-revise", eventId: revise.id, rev: revise.rev, claim, transfers: rows, ...extra });
    else act({ type: "event-submit", eventType, idem, claim, transfers: rows, ...extra });
    onClose();
  };
  const set = (k: string, v: unknown) => setClaim((c) => ({ ...c, [k]: v }));
  const title = { menu: "Record Event", win: revise ? "Correct Win Details" : "Declare Win (Hu)", kong: "Record Kong (Gang)", exhaust: "Wall Exhausted / End Hand", correct: "Review or Correct Event", history: "Scoring History", manual: "Manual Score Entry" }[mode];

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {mode === "menu" && (
        <div className="flex flex-col gap-2">
          {!inHand && <p className="t-sub text-muted">No hand is in progress, so only corrections are available.</p>}
          {[
            { m: "win" as Mode, label: "Declare Win (Hu)", help: "For your own winning hand. Self-draw and discard are ways of winning, not separate wins.", ok: inHand && !winners.includes(me) },
            { m: "kong" as Mode, label: "Record Kong (Gang)", help: "Concealed, exposed, or added kong.", ok: inHand },
            { m: "exhaust" as Mode, label: "Wall Exhausted / End Hand", help: "The wall ran out before the hand finished.", ok: inHand },
            { m: "correct" as Mode, label: "Review or Correct Event", help: "Fix a verified event with a reversal + replacement. History is kept.", ok: committedOpen.length > 0 },
            { m: "history" as Mode, label: "Scoring History", help: "Every verified transfer.", ok: true },
          ].map((x) => (
            <button key={x.m} disabled={!x.ok} onClick={() => setMode(x.m)} className="text-left rounded-[14px] border border-line bg-bg px-3 py-2.5 min-h-12 hover:bg-surface disabled:opacity-45">
              <span className="block t-body">{x.label}</span>
              <span className="block t-meta text-muted">{x.help}</span>
            </button>
          ))}
          {!prof.automatic && <p className="t-meta text-muted">{MANUAL_NOTE[prof.variant]}</p>}
        </div>
      )}

      {mode === "win" && (
        <div className="flex flex-col gap-5">
          <p className="t-sub text-muted">You're declaring your own win. Players will reveal and check the real tiles; no points change until all four confirm.</p>
          <Choice label="How did you get your winning tile?" value={claim.method} onChange={(v) => set("method", v)} options={[
            { id: "self_draw", label: "Self-draw (Zi Mo)", help: "You drew it from the wall." },
            { id: "discard", label: "Another player's discard (Dian Pao)", help: "Someone else discarded it." },
            ...(r.variant === "sichuan" ? [
              { id: "kong_replacement", label: "Kong replacement tile", help: "You drew it right after declaring your own kong." },
              { id: "robbing_kong", label: "Robbing a kong", help: "Another player added a fourth tile to a pung, and it completes your hand." },
            ] : []),
          ]} />
          {(claim.method === "discard" || claim.method === "robbing_kong") && (
            <PlayerPick r={r} label={claim.method === "discard" ? "Who discarded it?" : "Whose kong did you rob?"} value={claim.fromId} onChange={(v) => set("fromId", v)} exclude={[me, ...(prof.winnersLeave ? winners : [])]} />
          )}
          <Choice label="What is the basic winning structure?" value={claim.structure} onChange={(v) => set("structure", v)} options={[
            { id: "standard", label: "Standard: four sets + a pair" },
            { id: "seven_pairs", label: "Seven pairs" },
            ...(r.variant === "sichuan" ? [{ id: "all_pungs", label: "All pungs", help: "Four pungs/kongs + a pair, no sequences." }] : []),
            { id: "other", label: "Other / not sure" },
          ]} />
          {r.variant === "sichuan" && (
            <>
              <fieldset className="flex flex-col gap-2">
                <legend className="t-sub font-medium mb-1">Additional patterns (only if true)</legend>
                {[
                  { k: "pureSuit", label: "Pure suit (full flush) — every tile one suit" },
                  { k: "goldenHook", label: "Golden hook — four sets melded, won on the pair", disabled: claim.structure === "seven_pairs" },
                  { k: "lastTile", label: "Won on the last tile of the wall" },
                ].map((x) => (
                  <label key={x.k} className={cx("flex items-center gap-3 min-h-11 t-sub", x.disabled && "opacity-45")}>
                    <input type="checkbox" disabled={x.disabled} checked={!!claim[x.k]} onChange={(e) => set(x.k, e.target.checked)} className="h-5 w-5 accent-[#34C759]" />
                    {x.label}
                  </label>
                ))}
                <label className="flex items-center gap-3 min-h-11 t-sub">
                  Roots (sets of four identical tiles):
                  <select value={claim.roots || 0} onChange={(e) => set("roots", Number(e.target.value))} className="h-10 rounded-xl border border-line bg-bg px-2 outline-none focus:border-green">
                    {[0, 1, 2, 3, 4].map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </label>
                {claim.structure === "seven_pairs" && <p className="t-meta text-muted">Dragon seven pairs = seven pairs with four identical tiles: choose 1 root.</p>}
              </fieldset>
              <Choice label="Have you cleared your declared missing suit?" value={claim.missingSuitCleared} onChange={(v) => set("missingSuitCleared", v)} options={[
                { id: "yes", label: "Yes" }, { id: "no", label: "No" }, { id: "unsure", label: "Not sure" },
              ]} />
            </>
          )}
          {!prof.automatic && (
            <div className="flex flex-col gap-2">
              <p className="t-sub font-medium">Points (manual)</p>
              <p className="t-meta text-muted">{MANUAL_NOTE[prof.variant]}</p>
              <TransferEditor r={r} rows={rows} setRows={setRows} />
            </div>
          )}
          {preview && <Preview r={r} calc={preview} />}
          <Btn disabled={busy || !claim.method || !claim.structure || (preview ? preview.problems.length > 0 : rows.length === 0)} onClick={() => submit("win")}>{revise ? "Submit Corrected Version" : "Declare Win"}</Btn>
        </div>
      )}

      {mode === "kong" && (
        <div className="flex flex-col gap-5">
          <PlayerPick r={r} label="Who made the kong?" value={claim.actorId} onChange={(v) => set("actorId", v)} exclude={prof.winnersLeave ? winners : []} />
          <Choice label="What kind of kong?" value={claim.kind} onChange={(v) => set("kind", v)} options={[
            { id: "concealed", label: "Concealed kong", help: "Four identical tiles drawn yourself." },
            { id: "exposed", label: "Kong from a discarded tile", help: "Claimed a discard while holding three." },
            { id: "added", label: "Added kong", help: "Added your fourth tile to an exposed pung." },
          ]} />
          {claim.kind === "exposed" && <PlayerPick r={r} label="Who discarded the tile?" value={claim.fromId} onChange={(v) => set("fromId", v)} exclude={[claim.actorId, ...(prof.winnersLeave ? winners : [])]} />}
          <p className="t-meta text-muted">The player then draws a replacement tile from the end of the wall.</p>
          {!prof.automatic && (<><p className="t-meta text-muted">{MANUAL_NOTE[prof.variant]} (Leave empty if kongs don't pay in your rules.)</p><TransferEditor r={r} rows={rows} setRows={setRows} /></>)}
          {preview && <Preview r={r} calc={preview} />}
          <Btn disabled={busy || !claim.actorId || !claim.kind || !!(preview && preview.problems.length)} onClick={() => submit("kong")}>{revise ? "Submit Corrected Version" : "Submit for Verification"}</Btn>
        </div>
      )}

      {mode === "exhaust" && (
        <div className="flex flex-col gap-5">
          {prof.automatic ? (
            <>
              <p className="t-sub text-muted">Set each remaining player's status at the end of the wall.</p>
              {active.map((id) => (
                <div key={id} className="flex flex-col gap-2">
                  <Choice label={n(id)} value={claim.status?.[id]} onChange={(v) => set("status", { ...(claim.status || {}), [id]: v })} options={[
                    { id: "ready", label: "Ready (one tile from winning)" },
                    { id: "not_ready", label: "Not ready" },
                    { id: "missing_suit", label: "Still holds their missing suit" },
                  ]} />
                  {claim.status?.[id] === "ready" && active.some((x) => claim.status?.[x] === "not_ready") && (
                    <label className="flex items-center gap-3 t-sub pl-1">
                      Highest hand value {n(id)} could complete:
                      <select value={claim.readyValues?.[id] || ""} onChange={(e) => set("readyValues", { ...(claim.readyValues || {}), [id]: Number(e.target.value) })} className="h-10 rounded-xl border border-line bg-bg px-2 outline-none focus:border-green">
                        <option value="">–</option>{[1, 2, 4, 8].map((x) => <option key={x} value={x}>{x}</option>)}
                      </select>
                    </label>
                  )}
                </div>
              ))}
              <p className="t-meta text-muted">Kong refunds from not-ready players are added automatically from this hand's verified kongs.</p>
            </>
          ) : (
            <><p className="t-meta text-muted">{MANUAL_NOTE[prof.variant]}</p><TransferEditor r={r} rows={rows} setRows={setRows} /></>
          )}
          {preview && <Preview r={r} calc={preview} />}
          <Btn disabled={busy || !!(preview && preview.problems.length)} onClick={() => submit("exhaust")}>{revise ? "Submit Corrected Version" : "Submit for Verification"}</Btn>
        </div>
      )}

      {mode === "correct" && (
        <div className="flex flex-col gap-4">
          {!revise && (
            <fieldset className="flex flex-col gap-2">
              <legend className="t-sub font-medium mb-1">Which verified event needs a correction?</legend>
              {committedOpen.map((e) => (
                <button key={e.id} onClick={() => { setCorrects(e.id); setClaim({ corrects: e.id, reason: "" }); setRows(e.transfers.map((t) => ({ ...t }))); }} aria-pressed={corrects === e.id}
                  className={cx("text-left rounded-[14px] border px-3 py-2 min-h-12", corrects === e.id ? "border-green bg-green-soft" : "border-line bg-bg")}>
                  <span className="block t-sub font-medium">{describeEvent(r, e).title}</span>
                  <span className="block t-meta text-muted">Hand {e.hand} · {e.transfers.map((t) => `${n(t.from)}→${n(t.to)} ${t.amount}`).join(", ") || "no points"}</span>
                </button>
              ))}
            </fieldset>
          )}
          {(corrects || revise) && (
            <>
              <input value={claim.reason || ""} onChange={(e) => set("reason", e.target.value)} maxLength={200} placeholder="Reason for the correction" className="h-11 px-3 rounded-xl border border-line bg-bg outline-none focus:border-green" />
              {(r.events || []).find((e) => e.id === (claim.corrects || corrects))?.type === "win" && (
                <label className="flex items-center gap-3 min-h-11 t-sub"><input type="checkbox" className="h-5 w-5 accent-[#34C759]" checked={!!claim.invalidWin} onChange={(e) => { set("invalidWin", e.target.checked); if (e.target.checked) setRows([]); }} />The win itself was invalid</label>
              )}
              <p className="t-sub font-medium">Replacement transfers</p>
              <p className="t-meta text-muted">The original transfers are reversed in full, then these are recorded instead.</p>
              <TransferEditor r={r} rows={rows} setRows={setRows} />
              <Btn disabled={busy || !String(claim.reason || "").trim()} onClick={() => submit("correction", { claim: { ...claim, corrects: claim.corrects || corrects } })}>{revise ? "Submit Corrected Version" : "Submit Correction for Verification"}</Btn>
            </>
          )}
        </div>
      )}

      {mode === "history" && <Ledger r={r} />}
    </Sheet>
  );
}

function Preview({ r, calc }: { r: PublicRoom; calc: { transfers: Transfer[]; lines: string[]; problems: string[]; limitations?: string } }) {
  return (
    <div className="rounded-[12px] bg-surface p-3 flex flex-col gap-2" aria-live="polite">
      <div className="t-meta text-muted">Preview (the server recalculates on submit)</div>
      {calc.problems.length ? <ul className="t-sub text-[#B42318] dark:text-[#FF6961] flex flex-col gap-1">{calc.problems.map((p, i) => <li key={i}>{p}</li>)}</ul> : <TransferList r={r} transfers={calc.transfers} />}
      <ul className="t-meta text-muted flex flex-col gap-0.5">{calc.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
      {calc.limitations && <p className="t-meta text-[#B25000] dark:text-[#FFB340]">{calc.limitations}</p>}
    </div>
  );
}

// ---------- Scores ----------
export function Ledger({ r }: { r: PublicRoom }) {
  const n = nameIn(r);
  const [openId, setOpenId] = useState<string | null>(null);
  const done = (r.events || []).filter((e) => e.status !== "pending").sort((a, b) => (a.committedAt || 0) - (b.committedAt || 0));
  if (!done.length) return <p className="t-sub text-muted">No verified events yet.</p>;
  return (
    <ol className="flex flex-col divide-y divide-line">
      {done.map((e) => {
        const d = describeEvent(r, e);
        const entries = (r.ledger || []).filter((l) => l.eventId === e.id);
        return (
          <li key={e.id} className="py-2.5">
            <button onClick={() => setOpenId(openId === e.id ? null : e.id)} aria-expanded={openId === e.id} className="w-full text-left flex items-start gap-2">
              <span className="flex-1 min-w-0">
                <span className="block t-sub font-medium">{d.title}{e.status === "voided" ? " (voided)" : ""}{e.correctedBy ? " (corrected)" : ""}</span>
                <span className="block t-meta text-muted">Hand {e.hand} · {entries.length ? entries.map((l) => `${n(l.from)}→${n(l.to)} ${l.amount}`).join(", ") : "no points"}</span>
              </span>
              <ChevronDown size={16} className={cx("text-muted mt-1 shrink-0", openId === e.id && "rotate-180")} />
            </button>
            {openId === e.id && (
              <div className="mt-2 rounded-[12px] bg-surface p-3 t-meta text-muted flex flex-col gap-1">
                {d.sub && <span>{d.sub}</span>}
                {e.lines.map((l, i) => <span key={i}>{l}</span>)}
                {entries.filter((l) => l.correctionOf).length > 0 && <span>Includes reversal of the original event.</span>}
                <span>Verified by all four ({r.players.map((p) => p.name).join(", ")}) · {e.ruleVersion} · version {e.rev}</span>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function ScoresSheet({ r, me, open, onClose }: { r: PublicRoom; me: string; open: boolean; onClose: () => void }) {
  const { totals, wins, kongs, handsPlayed } = useScores(r);
  return (
    <Sheet open={open} onClose={onClose} title="Scores">
      <p className="t-meta text-muted mb-2">Hand {r.hand?.n ?? 1}{handsPlayed ? ` · ${handsPlayed} hand${handsPlayed > 1 ? "s" : ""} finished` : ""} · game points only · {profileFor(r.variant).name}</p>
      <table className="w-full t-sub mb-4">
        <thead><tr className="text-muted t-meta text-left"><th className="font-normal py-1">Player</th><th className="font-normal text-right">Points</th><th className="font-normal text-right">Wins</th><th className="font-normal text-right">Kongs</th></tr></thead>
        <tbody>
          {[...r.players].sort((a, b) => (totals[b.id] || 0) - (totals[a.id] || 0)).map((p) => (
            <tr key={p.id} className="border-t border-line"><td className="py-2">{p.name}{p.id === me ? " (you)" : ""}</td><td className="text-right font-medium tabular-nums">{signed(totals[p.id] || 0)}</td><td className="text-right tabular-nums">{wins[p.id] || 0}</td><td className="text-right tabular-nums">{kongs[p.id] || 0}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="t-section mb-1">Event ledger</div>
      <Ledger r={r} />
    </Sheet>
  );
}

// ---------- Hand review ----------
export function HandReviewPanel({ r, me, act, busy, openRecord, openScores }: { r: PublicRoom; me: string; act: Act; busy: boolean; openRecord: () => void; openScores: () => void }) {
  const n = nameIn(r);
  const h = r.hand!;
  const handEntries = (r.ledger || []).filter((l) => l.hand === h.n);
  const delta: Record<string, number> = Object.fromEntries(r.players.map((p) => [p.id, 0]));
  handEntries.forEach((l) => { delta[l.from] -= l.amount; delta[l.to] += l.amount; });
  const pending = (r.events || []).filter((e) => e.status === "pending").length;
  const suggested = r.variant === "sichuan" ? h.winners[0] || h.dealerId : null;
  const votes = r.nextDealerVotes || {};
  const isHost = r.hostId === me;
  return (
    <Panel label={`Hand ${h.n} review`}>
      <div>
        <div className="t-section">Hand {h.n} Complete</div>
        <p className="t-sub text-muted">{h.endReason === "exhausted" ? "The wall was exhausted." : `Won by ${h.winners.map(n).join(", then ")}.`}</p>
      </div>
      <ul className="flex flex-col gap-1">
        {r.players.map((p) => (
          <li key={p.id} className="flex justify-between t-sub"><span>{p.name}</span><span className="font-medium tabular-nums">{signed(delta[p.id])} this hand</span></li>
        ))}
      </ul>
      {pending > 0 ? (
        <p className="t-sub text-[#B25000] dark:text-[#FFB340]">{pending} item{pending > 1 ? "s" : ""} still need verification before the next hand.</p>
      ) : (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <div className="flex flex-col gap-0.5">
            <Count n={Object.keys(votes).length} label="chosen" />
            <div className="t-section">Start Next Hand: who deals?</div>
          </div>
          {suggested && <p className="t-meta text-muted">Suggestion (Jiada's Sichuan convention; our scoring source doesn't specify): {n(suggested)} — the first player to win deals; if nobody won, the dealer stays.</p>}
          <div className="grid grid-cols-2 gap-2">
            {r.players.map((p) => (
              <Btn key={p.id} variant={votes[me] === p.id ? "selected" : "secondary"} className="px-2" disabled={busy} onClick={() => act({ type: "next-dealer", dealerId: p.id })}>{p.name}</Btn>
            ))}
          </div>
          <Statuses players={r.players} value={(p) => (votes[p.id] ? n(votes[p.id]) : undefined)} labels={{}} />
          <p className="t-meta text-muted">Everyone chooses the same dealer to start Hand {h.n + 1}. Scores and chat carry over.</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Btn variant="secondary" className="px-2" onClick={openScores}>View Scores</Btn>
        <Btn variant="secondary" className="px-2 text-[14px]" onClick={openRecord}>Correct an Event</Btn>
      </div>
      {isHost && <Btn variant="secondary" disabled={busy || pending > 0} onClick={() => act({ type: "finish-request" })}><Flag size={16} strokeWidth={1.75} /> Finish Session</Btn>}
    </Panel>
  );
}

// ---------- Session review ----------
export function SessionReviewPanel({ r, me, act, busy }: { r: PublicRoom; me: string; act: Act; busy: boolean }) {
  const { totals, handsPlayed, committed } = useScores(r);
  const f = r.finalReview!;
  const mine = f.resp[me];
  const manual = committed.filter((e) => e.manual).length;
  return (
    <Panel label="Review final scores">
      <div className="flex flex-col gap-0.5">
        <Count n={Object.keys(f.resp).length} label="confirmed" />
        <div className="t-section">Review Final Scores</div>
        <p className="t-sub text-muted">{handsPlayed + (r.hand && !r.hand.ended ? 1 : 0)} hand(s) · {profileFor(r.variant).name} · ledger version {r.ledgerVersion || 0}</p>
      </div>
      <ul className="flex flex-col gap-1">
        {[...r.players].sort((a, b) => (totals[b.id] || 0) - (totals[a.id] || 0)).map((p) => (
          <li key={p.id} className="flex justify-between t-body"><span>{p.name}</span><span className="font-medium tabular-nums">{signed(totals[p.id] || 0)}</span></li>
        ))}
      </ul>
      <p className="t-meta text-muted">{committed.filter((e) => e.type !== "correction").length} verified events{manual ? ` · ${manual} manual entr${manual > 1 ? "ies" : "y"}` : ""}{committed.some((e) => e.type === "correction") ? " · includes corrections" : ""}</p>
      <Statuses players={r.players} value={(p) => f.resp[p.id]} labels={{ confirm: { text: "Confirmed", ok: true } }} />
      <div className="grid grid-cols-1 gap-2">
        <Btn variant={mine === "confirm" ? "ok" : "primary"} disabled={busy || mine === "confirm"} onClick={() => act({ type: "final-respond", ledgerVersion: r.ledgerVersion || 0, value: "confirm" })}>{mine === "confirm" ? "You confirmed" : "Confirm Final Scores"}</Btn>
        <Btn variant="secondary" disabled={busy} onClick={() => act({ type: "final-respond", ledgerVersion: r.ledgerVersion || 0, value: "correct" })}>Request Correction</Btn>
        {r.hostId === me && <Btn variant="ghost" disabled={busy} onClick={() => act({ type: "finish-cancel" })}>Cancel Review</Btn>}
      </div>
    </Panel>
  );
}

// ---------- Final results ----------
let lastConfetti = { code: "", t: 0 };

export function FinalResults({ r, me, onHome, reflection }: { r: PublicRoom; me: string; onHome: () => void; reflection: React.ReactNode }) {
  const reduce = useReducedMotion();
  const { totals, wins, kongs, handsPlayed, committed } = useScores(r);
  const [showBreakdown, setShowBreakdown] = useState(false);
  useEffect(() => window.scrollTo(0, 0), []);
  const confettiRef = useRef<ConfettiRef>(null);
  const globalOptions = useMemo(() => ({ resize: true, useWorker: true }), []);
  const ranked = [...r.players].sort((a, b) => (totals[b.id] || 0) - (totals[a.id] || 0));
  const top = Math.max(...ranked.map((p) => totals[p.id] || 0));
  const min = Math.min(...ranked.map((p) => totals[p.id] || 0));
  const rankOf = (id: string) => 1 + ranked.filter((p) => (totals[p.id] || 0) > (totals[id] || 0)).length; // ties share rank
  // Bar height normalized to [12%, 100%] so negatives never produce negative heights.
  const heightPct = (v: number) => (top === min ? 70 : 12 + ((v - min) / (top - min)) * 88);
  const bars = r.players.map((p) => p); // seat order on the podium
  const variant = variantById(r.variant);
  const topics = [...new Set(committed.flatMap((e) => (e.type === "kong" ? ["Kong payments"] : e.type === "win" ? ["Winning hands and payments"] : e.type === "exhaust" ? ["Wall exhaustion settlement"] : [])))];

  useEffect(() => {
    if (reduce) return;
    const now = Date.now();
    if (lastConfetti.code === r.code && now - lastConfetti.t < 4000) return; // StrictMode remount / rerender guard
    lastConfetti = { code: r.code, t: now };
    const timers: number[] = [];
    const start = 1500; // after bars rise (≤900ms) and the crown appears
    for (let i = 0; i < 6; i++)
      timers.push(window.setTimeout(() => confettiRef.current?.fire({
        particleCount: 14, angle: 270, spread: 70, startVelocity: 4, gravity: 0.55, drift: (Math.random() - 0.5) * 0.6, ticks: 320, scalar: 0.9,
        origin: { x: 0.1 + Math.random() * 0.8, y: -0.05 }, colors: ["#34C759", "#FFD60A", "#FF9F0A", "#0A84FF", "#FF2D55", "#AF52DE"],
      }), start + i * 380));
    return () => timers.forEach(clearTimeout);
  }, [r.code, reduce]);

  return (
    <div className="min-h-[100dvh] flex flex-col pt-safe relative">
      <Confetti ref={confettiRef} manualstart globalOptions={globalOptions} className="pointer-events-none fixed inset-0 z-30 w-full h-full" aria-hidden />
      <div className="h-14 px-4 flex items-center justify-between t-app">Mahjong Together<span className="-mr-2"><ThemeToggle /></span></div>
      <main className="flex-1 px-4 py-4 flex flex-col gap-6">
        <div>
          <h1 className="t-app">Game Complete!</h1>
          <p className="t-body text-muted">Final Results · {r.name}</p>
          <p className="t-meta text-muted">{handsPlayed} hand{handsPlayed === 1 ? "" : "s"} · {variant?.name} · game points only</p>
        </div>
        <section aria-label="Winner podium" className="flex items-end justify-between gap-3 h-[220px] px-1 pt-8">
          {bars.map((p, i) => {
            const v = totals[p.id] || 0;
            const isTop = v === top;
            return (
              <div key={p.id} className="flex-1 h-full flex flex-col items-center justify-end gap-1 min-w-0">
                {isTop && (
                  <motion.span initial={reduce ? false : { opacity: 0, scale: 0.4, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={reduce ? { duration: 0 } : { delay: 0.9, duration: 0.35, ease: "easeOut" }} aria-label="Top score">
                    <Crown size={22} strokeWidth={1.75} className="text-[#FFB800]" fill="#FFD60A" />
                  </motion.span>
                )}
                <span className="t-sub font-semibold tabular-nums">{signed(v)}</span>
                <motion.div
                  initial={reduce ? false : { height: 0 }}
                  animate={{ height: `${heightPct(v)}%` }}
                  transition={reduce ? { duration: 0 } : { duration: 0.5 + i * 0.12, ease: "easeOut" }}
                  className={cx("w-full max-w-[64px] rounded-t-[14px] rounded-b-[6px]", isTop ? "bg-green" : "bg-bubble border border-line")}
                />
              </div>
            );
          })}
        </section>
        <ol className="flex flex-col divide-y divide-line -mt-2">
          {ranked.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2 t-body">
              <span className="w-7 t-sub text-muted">#{rankOf(p.id)}</span>
              <span className="flex-1 min-w-0 truncate">{p.name}{p.id === me ? " (you)" : ""}{(totals[p.id] || 0) === top ? " 👑" : ""}</span>
              <span className="font-semibold tabular-nums">{signed(totals[p.id] || 0)}</span>
            </li>
          ))}
        </ol>
        {ranked.filter((p) => (totals[p.id] || 0) === top).length > 1 && <p className="t-sub text-muted -mt-3">Tied for first place — no tie-breaker applied.</p>}
        <section className="flex flex-col gap-2">
          <button onClick={() => setShowBreakdown(!showBreakdown)} aria-expanded={showBreakdown} className="flex items-center justify-between t-section min-h-11">Full Score Breakdown <ChevronDown size={18} className={cx("text-muted", showBreakdown && "rotate-180")} /></button>
          {showBreakdown && (
            <>
              <ul className="t-sub flex flex-col gap-1">
                {r.players.map((p) => <li key={p.id}>{p.name}: {wins[p.id] || 0} win(s), {kongs[p.id] || 0} kong(s)</li>)}
              </ul>
              <Ledger r={r} />
            </>
          )}
        </section>
        <section className="flex flex-col gap-1">
          <div className="t-section">What We Learned</div>
          <p className="t-sub text-muted">
            {handsPlayed} hand{handsPlayed === 1 ? "" : "s"} of {variant?.name} · {Object.values(wins).reduce((a, b) => a + b, 0)} verified win(s) · {Object.values(kongs).reduce((a, b) => a + b, 0)} kong(s).
            {topics.length ? ` Topics practised: ${topics.join(", ")}.` : ""}
          </p>
        </section>
        {reflection}
      </main>
      <div className="sticky bottom-0 z-40 bg-bg px-4 pt-3 pb-safe border-t border-line">
        <Btn className="w-full" onClick={onHome}>Back to Home</Btn>
      </div>
    </div>
  );
}

