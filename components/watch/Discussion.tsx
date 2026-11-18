"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, MessageSquare, Send, X } from "lucide-react";
import type { Discussion as Disc, QRef, Question, SpecSnap, Viewer } from "@/lib/watch/types";
import { classify } from "@/lib/watch/topics";
import { COACH_STARTERS, coachAnswer } from "@/lib/watch/coach";
import { PrivateCoachLauncher } from "@/components/ui/PrivateCoachLauncher";
import { tileName } from "@/lib/mj/rules";
import { Btn, cx } from "@/components/ui";
import { EMOJI_FONT, avatarOf, emojiFor } from "@/components/s3/avatar";
import { WTile } from "./SpecTable";

const ago = (ts: number, now: number) => { const s = Math.max(0, Math.round((now - ts) / 1000)); return s < 45 ? "just now" : s < 3600 ? `${Math.round(s / 60)}m ago` : `${Math.round(s / 3600)}h ago`; };
export function VAvatar({ v, size = 28, ring }: { v?: Viewer | { avatar?: string; kind?: string }; size?: number; ring?: boolean }) {
  const e = v && "kind" in v && v.kind ? emojiFor(v as never) : avatarOf(v?.avatar).emoji;
  return (
    <span aria-hidden className={cx("inline-flex items-center justify-center rounded-full bg-bubble border shrink-0", ring ? "border-card ring-2 ring-card" : "border-line")} style={{ width: size, height: size }}>
      <span style={{ ...EMOJI_FONT, fontSize: Math.round(size * 0.58), lineHeight: 1 }}>{e}</span>
    </span>
  );
}

/** "🐻 Frank discarded [tile] Bamboo 3" */
export function RefChip({ r, onClick, compact }: { r: QRef; onClick?: () => void; compact?: boolean }) {
  const inner = (
    <>
      <VAvatar v={{ avatar: r.actorAvatar, kind: r.actorKind }} size={24} />
      {r.tile !== undefined && <span className="w-[18px] shrink-0"><WTile id={r.tile} w="18px" /></span>}
      <span className={cx("t-sub min-w-0", compact ? "truncate" : "")}>{r.text.replace(/\.$/, "")}</span>
      <span className="t-sub text-muted shrink-0">· Move {r.seq}</span>
    </>
  );
  return onClick
    ? <button type="button" onClick={onClick} className="flex items-center gap-1.5 min-h-9 px-2 py-1 rounded-[10px] bg-sage hover:bg-green-soft text-left max-w-full" aria-label={`Show move: ${r.text}`}>{inner}</button>
    : <span className="flex items-center gap-1.5 min-h-9 px-2 py-1 rounded-[10px] bg-sage max-w-full">{inner}</span>;
}

function SameStrip({ q, people, me, onToggle, disabled }: { q: Question; people: Record<string, Viewer>; me: string; onToggle: (on: boolean) => void; disabled: boolean }) {
  const [open, setOpen] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const [bump, setBump] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const toggle = (el: HTMLElement) => {
    if (open) return setOpen(null);
    // fixed position, so the list's scroll container never clips it; opens upward when there's no room below
    const r = el.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.right - 260, window.innerWidth - 268));
    setOpen(window.innerHeight - r.bottom > 300 ? { left, top: r.bottom + 6 } : { left, bottom: window.innerHeight - r.top + 6 });
  };
  const mine = q.same.includes(me), author = q.author === me;
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    const c = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(null); };
    const s = () => setOpen(null); // the anchor moved
    const list = box.current?.closest("[data-question-list]");
    window.addEventListener("keydown", k); window.addEventListener("mousedown", c); list?.addEventListener("scroll", s);
    return () => { window.removeEventListener("keydown", k); window.removeEventListener("mousedown", c); list?.removeEventListener("scroll", s); };
  }, [open]);
  const shown = q.same.slice(0, 4);
  return (
    <div className="flex items-center gap-2 min-w-0" ref={box}>
      {author ? (
        <span className="t-sub text-muted inline-flex items-center gap-1 min-h-11 px-1">Your question · {q.same.length} {q.same.length === 1 ? "person" : "people"}</span>
      ) : (
        <button type="button" disabled={disabled} aria-pressed={mine} onClick={() => { if (!mine) setBump((b) => b + 1); onToggle(!mine); }}
          className={cx("relative t-sub font-semibold min-h-11 px-3 rounded-full border inline-flex items-center gap-1.5 transition-[transform,background-color] duration-150 active:scale-95 motion-reduce:transition-none",
            mine ? "bg-green-soft border-green text-green-text" : "bg-card border-line text-ink hover:bg-hover")}>
          {mine ? <Check size={16} /> : null}+1 Same Question <span className="tabular-nums text-muted font-normal">{q.same.length}</span>
          {bump > 0 && <span key={bump} className="plus-one absolute -top-3 right-2 t-sub font-bold text-green-text pointer-events-none" aria-hidden>+1</span>}
        </button>
      )}
      <span className="flex -space-x-2" aria-label={`${q.same.length} ${q.same.length === 1 ? "person has" : "people have"} this question`}>
        {shown.map((id) => <span key={id} className="mt-pop" title={people[id]?.name}><VAvatar v={people[id]} size={28} ring /></span>)}
      </span>
      {q.same.length > 4 && (
        <div className="relative">
          <button type="button" onClick={(e) => toggle(e.currentTarget)} aria-expanded={!!open} aria-label={`See all ${q.same.length} people with the same question`}
            className="h-11 min-w-11 px-2 rounded-full text-green-text font-bold text-[18px] leading-none hover:bg-green-soft tracking-[0.1em]">···</button>
          {open && (
            <div role="dialog" aria-label="People With the Same Question" style={{ left: open.left, top: open.top, bottom: open.bottom }} className="fixed z-50 w-[260px] max-h-[280px] overflow-y-auto rounded-[16px] border border-line bg-card shadow-sheet p-3 mt-pop">
              <div className="flex items-center mb-1"><p className="t-section flex-1">People With the Same Question</p>
                <button onClick={() => setOpen(null)} aria-label="Close" className="h-9 w-9 -mr-1 rounded-full flex items-center justify-center hover:bg-hover"><X size={18} /></button></div>
              <ul className="flex flex-col">
                {q.same.map((id) => <li key={id} className="flex items-center gap-2 min-h-10"><VAvatar v={people[id]} size={28} /><span className="t-body truncate">{people[id]?.name || "Viewer"}{id === me ? " (you)" : ""}</span></li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QuestionCard({ q, people, me, now, act, onRef, closed }: { q: Question; people: Record<string, Viewer>; me: string; now: number; act: (a: Record<string, unknown>) => Promise<unknown>; onRef: (r: QRef) => void; closed: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const a = people[q.author];
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true); setErr(null);
    try { await act({ type: "reply", qid: q.id, text }); setText(""); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <li className="rounded-[16px] border border-line bg-card p-3 flex flex-col gap-2 spec-new" data-question={q.id}>
      <div className="flex items-center gap-2 min-w-0">
        <VAvatar v={a} size={30} />
        <span className="t-sub font-semibold truncate">{a?.name || "Viewer"}{q.author === me ? " (you)" : ""}</span>
        <span className="t-sub text-muted shrink-0">· {ago(q.ts, now)}</span>
      </div>
      {q.ref ? <RefChip r={q.ref} onClick={() => onRef(q.ref!)} compact /> : <span className="t-sub text-muted">General question</span>}
      <p className="t-body break-words">{q.text}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <SameStrip q={q} people={people} me={me} disabled={closed} onToggle={(on) => act({ type: "same", qid: q.id, on }).catch(() => {})} />
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="ml-auto t-sub font-medium min-h-11 px-3 rounded-full hover:bg-hover inline-flex items-center gap-1.5">
          <MessageSquare size={16} /> {open ? "Hide Replies" : q.replies.length ? `Reply · ${q.replies.length}` : "Reply"}
        </button>
      </div>
      {open && (
        <div className="flex flex-col gap-2 border-t border-line pt-2">
          {q.replies.map((r) => (
            <div key={r.id} className="flex gap-2 items-start">
              <VAvatar v={people[r.author]} size={26} />
              <div className="min-w-0"><p className="t-sub"><span className="font-semibold">{people[r.author]?.name || "Viewer"}</span> <span className="text-muted">· {ago(r.ts, now)}</span></p><p className="t-body break-words">{r.text}</p></div>
            </div>
          ))}
          {!q.replies.length && <p className="t-sub text-muted">No replies yet. Share what you think.</p>}
          {!closed && (
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={280} placeholder="Write a reply…" aria-label={`Reply to ${a?.name || "this"} question`}
                className="flex-1 min-w-0 h-11 px-3 rounded-[12px] border border-line bg-page outline-none focus:border-green" />
              <Btn type="submit" className="min-h-11 px-3" disabled={busy || !text.trim()}>Reply</Btn>
            </form>
          )}
          {err && <p className="t-sub text-[#B42318] dark:text-[#FF6961]" role="alert">{err}</p>}
        </div>
      )}
    </li>
  );
}

type Coach = { id: number; q: string; a: string };
export function DiscussionPanel({ disc, people, me, act, selRef, clearRef, onRef, closed, snapFor, names, draft, setDraft, pausedRef, setRef }: {
  disc: Disc; people: Record<string, Viewer>; me: string; act: (a: Record<string, unknown>) => Promise<unknown>;
  selRef: QRef | null; clearRef: () => void; onRef: (r: QRef) => void; closed: boolean;
  snapFor: SpecSnap | null; names: Record<string, string>; draft: { text: string; focus: number }; setDraft: (d: { text: string; focus: number }) => void; pausedRef?: QRef | null; setRef?: (r: QRef) => void;
}) {
  const coachRef = selRef || pausedRef || null; // the Coach explains the move you selected or paused on
  const [filter, setFilter] = useState<"all" | "shared" | "mine" | "move">("all");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [coachOpen, setCoachOpen] = useState(false);
  const [coach, setCoach] = useState<Coach[]>([]);
  const [cq, setCq] = useState("");
  const [now, setNow] = useState(Date.now());
  const [forceOwn, setForceOwn] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(t); }, []);
  useEffect(() => { if (draft.focus) ta.current?.focus(); }, [draft.focus]);
  useEffect(() => { setForceOwn(false); if (!selRef && filter === "move") setFilter("all"); }, [selRef?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => {
    let qs = [...disc.questions];
    if (filter === "mine") qs = qs.filter((q) => q.author === me || q.same.includes(me));
    if (filter === "move" && selRef) qs = qs.filter((q) => q.ref?.seq === selRef.seq && q.game === selRef.game);
    return filter === "shared" ? qs.sort((a, b) => b.same.length - a.same.length || b.ts - a.ts) : qs.sort((a, b) => b.ts - a.ts);
  }, [disc, filter, me, selRef]);

  // "Others are asking something similar." — same move AND same basic topic (local classifier, no AI)
  const similar = useMemo(() => {
    if (!selRef || forceOwn) return [];
    const mine = draft.text.trim() ? classify(draft.text, { ...selRef, missingSuit: selRef.rule === "missing-suit" }) : null;
    return disc.questions.filter((q) => q.ref?.seq === selRef.seq && q.game === selRef.game && q.author !== me && !q.same.includes(me) && (!mine || q.topic === mine)).slice(0, 2);
  }, [disc, selRef, draft.text, forceOwn, me]);

  const post = async () => {
    if (!draft.text.trim()) return;
    setBusy(true); setErr(null);
    try { await act({ type: "ask", text: draft.text, seq: selRef?.seq ?? null }); setDraft({ text: "", focus: 0 }); clearRef(); setFilter("all"); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const askCoach = (q: string) => {
    const text = q.trim();
    if (!text) return;
    setCoach((c) => [...c, { id: Date.now(), q: text, a: coachAnswer(text, { ref: coachRef, snap: snapFor, names }) }]);
    setCq("");
  };
  const placeholder = selRef?.type === "discard" && selRef.actorName ? `Why did ${selRef.actorName} discard this tile?` : selRef ? `What would you like to know about this move?` : "Ask about the game, or select a move first.";

  return (
    <section className="relative h-full min-h-0 flex flex-col rounded-[22px] border border-line bg-card shadow-card overflow-hidden" aria-label="Live Discussion" data-discussion>
      <div className="px-4 pt-3 pb-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-line">
        <div className="flex-1 min-w-[190px]"><h2 className="t-page">Live Discussion</h2><p className="t-sub text-muted">Ask, learn, and explore together.</p></div>
      </div>
      <div className="px-3 py-2 flex gap-1.5 flex-wrap border-b border-line" role="tablist" aria-label="Filter questions">
        {([["all", "All"], ...(selRef ? [["move", "This Move"]] : []), ["shared", "Most Shared"], ["mine", "Mine"]] as [typeof filter, string][]).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}
            className={cx("t-sub font-medium min-h-9 px-3 rounded-full", filter === k ? "bg-green-strong text-white" : "bg-bubble hover:bg-hover")}>{l}</button>
        ))}
        <span className="ml-auto t-sub text-muted self-center">{disc.questions.length} {disc.questions.length === 1 ? "question" : "questions"}</span>
      </div>
      <ul className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-2.5" aria-live="polite" data-question-list>
        {list.map((q) => <QuestionCard key={q.id} q={q} people={people} me={me} now={now} act={act} onRef={onRef} closed={closed} />)}
        {!list.length && <li className="t-body text-muted text-center py-8 px-4">{filter === "all" ? "Be the first to ask about a move." : filter === "move" ? "No questions about this move yet." : "Nothing here yet."}</li>}
      </ul>
      {closed ? (
        <div className="border-t border-line px-4 py-3 t-sub text-muted">This game has finished. Questions are closed.</div>
      ) : (
        <form className="border-t border-line px-3 pt-2.5 pb-3 flex flex-col gap-2 bg-card" onSubmit={(e) => { e.preventDefault(); post(); }} data-composer>
          {similar.length > 0 && (
            <div className="rounded-[14px] bg-sage p-2.5 flex flex-col gap-1.5 mt-pop" data-similar>
              <p className="t-sub font-semibold">Others have a similar question.</p>
              {similar.map((q) => (
                <div key={q.id} className="flex items-center gap-2">
                  <p className="t-sub flex-1 min-w-0 truncate">“{q.text}”</p>
                  <Btn variant="ok" className="min-h-11 px-3 t-sub" onClick={() => act({ type: "same", qid: q.id, on: true }).catch(() => {})}>+1 Same Question</Btn>
                </div>
              ))}
              <button type="button" onClick={() => setForceOwn(true)} className="self-start t-sub font-medium text-green-text min-h-9 hover:underline">Ask My Own Question</button>
            </div>
          )}
          {selRef ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="t-sub text-muted shrink-0">Replying to:</span>
              <span className="min-w-0 flex-1"><RefChip r={selRef} compact /></span>
              <button type="button" onClick={clearRef} aria-label="Remove move reference" className="h-11 w-11 rounded-full flex items-center justify-center hover:bg-hover shrink-0"><X size={18} /></button>
            </div>
          ) : <p className="t-sub text-muted">Tip: click a discarded tile or a move to ask about it.</p>}
          <label className="t-sub font-medium" htmlFor="q-input">What would you like to know?</label>
          <div className="flex gap-2 items-end">
            <textarea id="q-input" ref={ta} rows={2} maxLength={280} value={draft.text} onChange={(e) => setDraft({ text: e.target.value, focus: 0 })} placeholder={placeholder}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); post(); } }}
              className="flex-1 min-w-0 resize-none px-3 py-2 rounded-[12px] border border-line bg-page outline-none focus:border-green leading-[22px]" />
            <Btn type="submit" className="min-h-12 px-4" disabled={busy || !draft.text.trim()}><Send size={16} /> Post Question</Btn>
          </div>
          {err && <p className="t-sub text-[#B42318] dark:text-[#FF6961]" role="alert">{err}</p>}
        </form>
      )}

      {/* The draggable AI orb is this screen's only Coach chat opener (it replaces the old "Ask Private Coach" button).
          It renders into <body> at the viewport's bottom-right; the chat below is the same Coach, unchanged. */}
      <PrivateCoachLauncher open={coachOpen} setOpen={setCoachOpen} title="Private Coach" avoid="[data-composer]"
        subtitle={`Only you can see this. Free rule-based answers${coachRef ? " about the selected move" : ""}.`}>
        <div className="flex-1 min-h-0 flex flex-col" data-coach>
          {coachRef && <div className="px-3 pt-2"><RefChip r={coachRef} compact /></div>}
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-3">
            {!coach.length && <p className="t-body text-muted">Ask about a rule or the selected move. Try one of these:</p>}
            {coach.map((c) => (
              <div key={c.id} className="flex flex-col gap-1.5">
                <p className="self-end max-w-[85%] rounded-[16px] bg-green-strong text-white px-3 py-2 t-body">{c.q}</p>
                <div className="max-w-[92%] rounded-[16px] bg-bubble px-3 py-2"><p className="t-body">{c.a}</p></div>
                <button type="button" onClick={() => { if (!selRef && coachRef && setRef) setRef(coachRef); setDraft({ text: c.q, focus: Date.now() }); setCoachOpen(false); }}
                  className="self-start t-sub font-medium text-green-text min-h-11 px-2 rounded-full hover:bg-green-soft">Share This Question With the Group</button>
              </div>
            ))}
          </div>
          <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
            {COACH_STARTERS.map((s) => <button key={s} onClick={() => askCoach(s)} className="t-sub min-h-11 px-3 rounded-full bg-bubble hover:bg-hover">{s}</button>)}
            {coachRef?.type === "discard" && <button onClick={() => askCoach(`Why did ${coachRef.actorName || "they"} discard ${tileName(coachRef.tile!)}?`)} className="t-sub min-h-11 px-3 rounded-full bg-sage hover:bg-green-soft">Why this discard?</button>}
          </div>
          <form className="border-t border-line px-3 py-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); askCoach(cq); }}>
            <input value={cq} onChange={(e) => setCq(e.target.value)} maxLength={200} placeholder="Ask a rule question…" aria-label="Ask the Private Coach"
              className="flex-1 min-w-0 h-12 px-3 rounded-[12px] border border-line bg-page outline-none focus:border-green" />
            <Btn type="submit" className="min-h-12" disabled={!cq.trim()}>Ask</Btn>
          </form>
        </div>
      </PrivateCoachLauncher>
    </section>
  );
}
