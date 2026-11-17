"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Clock, Send, Sparkles, Users } from "lucide-react";
import type { Discussion, Group, Groups, Topic, Viewer } from "@/lib/watch/types";
import { TOPIC_LABEL, TOPIC_SHORT } from "@/lib/watch/topics";
import { interestProfiles, joinWords } from "@/lib/watch/groups";
import { SCENARIOS, scenarioOrder } from "@/lib/watch/scenarios";
import { tileName } from "@/lib/mj/rules";
import { Btn, cx } from "@/components/ui";
import { VAvatar } from "./Discussion";
import { WTile } from "./SpecTable";
import type { PracticeView } from "./useWatch";

const NUM = ["zero", "one", "two", "three"];
type Act = (a: Record<string, unknown>) => Promise<unknown>;

export function myGroupOf(groups: Groups | null, me: string): Group | null {
  if (!groups) return null;
  const acc = groups.assign[me];
  return groups.groups.find((g) => g.id === acc) || groups.groups.find((g) => g.kind === "topic" && g.members.includes(me) && g.status[me] === "invited") || null;
}

/** Spectator summary: real shared-question data only (no fabricated classmates or metrics). */
export function Summary({ disc, groups, people, me, act, openPractice, keepWatching, gameOver }: {
  disc: Discussion; groups: Groups | null; people: Record<string, Viewer>; me: string; act: Act; openPractice: () => void; keepWatching?: () => void; gameOver: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async (a: Record<string, unknown>, then?: () => void) => {
    setBusy(true); setErr(null);
    try { await act(a); then?.(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const topics = useMemo(() => {
    const by: Partial<Record<Topic, Set<string>>> = {};
    for (const q of disc.questions) for (const s of q.same) (by[q.topic] ||= new Set()).add(s);
    return (Object.entries(by) as [Topic, Set<string>][]).map(([t, s]) => ({ t, n: s.size })).sort((a, b) => b.n - a.n);
  }, [disc]);
  const top = [...disc.questions].sort((a, b) => b.same.length - a.same.length || b.ts - a.ts).slice(0, 4);
  const mine = interestProfiles(disc)[me] || [];
  const g = myGroupOf(groups, me);
  const accepted = !!g && g.status[me] === "accepted";
  const declined = groups?.groups.some((x) => x.kind === "topic" && x.members.includes(me) && x.status[me] === "declined");
  const max = Math.max(1, ...topics.map((x) => x.n));

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1120px] mx-auto px-6 py-8 flex flex-col gap-6">
        <div className="text-center mt-pop">
          <h1 className="text-[30px] leading-[38px] font-semibold text-green-text">You Learned Together!</h1>
          <p className="t-body text-muted mt-1">See what your classmates were curious about.</p>
          {!gameOver && keepWatching && <button onClick={keepWatching} className="t-sub text-green-text font-medium min-h-11 mt-1 hover:underline">Keep watching the table (questions are closed)</button>}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-5 items-start">
          <section className="rounded-[22px] border border-line bg-card p-5 flex flex-col gap-4" aria-label="Most Asked About">
            <h2 className="t-page">Most Asked About</h2>
            {topics.length ? (
              <ul className="flex flex-col gap-2.5">
                {topics.slice(0, 6).map(({ t, n }) => (
                  <li key={t} className="flex flex-col gap-1">
                    <div className="flex items-center"><span className="t-body font-medium flex-1">{TOPIC_LABEL[t]}</span><span className="t-sub text-muted tabular-nums">{n} {n === 1 ? "viewer" : "viewers"}</span></div>
                    <div className="h-2.5 rounded-full bg-bubble overflow-hidden"><div className="h-full rounded-full bg-green-strong" style={{ width: `${(n / max) * 100}%` }} /></div>
                  </li>
                ))}
              </ul>
            ) : <p className="t-body text-muted">No public questions were asked in this session.</p>}
            {top.length > 0 && <>
              <h3 className="t-section mt-2">Most Shared Questions</h3>
              <ul className="flex flex-col gap-2">
                {top.map((q) => (
                  <li key={q.id} className="rounded-[14px] bg-page border border-line px-3 py-2">
                    <p className="t-body">“{q.text}”</p>
                    <p className="t-sub text-muted">{q.ref ? q.ref.text.replace(/\.$/, "") : "General question"} · {q.same.length} {q.same.length === 1 ? "person" : "people"} · {q.replies.length} {q.replies.length === 1 ? "reply" : "replies"}</p>
                  </li>
                ))}
              </ul>
            </>}
          </section>

          <section className="rounded-[22px] border border-line bg-card p-5 flex flex-col gap-4 mt-pop" aria-label="Your learning group" data-group-card>
            {g && g.kind === "topic" ? (
              <>
                <div className="flex items-center gap-2"><Users size={22} className="text-green-text" /><h2 className="t-page">Meet Your Learning Group</h2></div>
                <p className="t-body">You and {NUM[g.members.length - 1] || g.members.length - 1} other viewers had similar questions during this game.</p>
                <ul className="grid grid-cols-2 gap-2">
                  {g.members.map((id) => (
                    <li key={id} className="flex items-center gap-2 rounded-[14px] border border-line px-3 py-2 min-w-0">
                      <VAvatar v={people[id]} size={36} />
                      <div className="min-w-0"><p className="t-body font-medium truncate">{people[id]?.name || "Viewer"}{id === me ? " (you)" : ""}</p>
                        <p className={cx("t-sub", g.status[id] === "accepted" ? "text-green-text" : "text-muted")}>{g.status[id] === "accepted" ? "Joined" : g.status[id] === "declined" ? "Maybe later" : "Invited"}</p></div>
                    </li>
                  ))}
                </ul>
                <p className="t-body rounded-[14px] bg-sage px-3 py-2">You all asked about {joinWords(g.topics.map((t) => TOPIC_SHORT[t]))}.</p>
                {accepted ? (
                  <Btn onClick={openPractice}><Sparkles size={18} /> Open Practice Room</Btn>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Btn disabled={busy} onClick={() => run({ type: "group-accept", gid: g.id }, openPractice)}>Practice Together</Btn>
                    <Btn variant="secondary" className="bg-card" disabled={busy} onClick={() => run({ type: "group-decline", gid: g.id })}>Maybe Later</Btn>
                  </div>
                )}
              </>
            ) : g && g.kind === "general" ? (
              <>
                <div className="flex items-center gap-2"><Users size={22} className="text-green-text" /><h2 className="t-page">General Beginner Group</h2></div>
                <p className="t-body">{g.members.length === 1 ? "You're the first one here. Others can join you." : `${g.members.length} learners have joined.`}</p>
                <div className="flex -space-x-2">{g.members.map((id) => <span key={id} title={people[id]?.name}><VAvatar v={people[id]} size={36} ring /></span>)}</div>
                <Btn onClick={openPractice}><Sparkles size={18} /> Open Practice Room</Btn>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2"><Users size={22} className="text-green-text" /><h2 className="t-page">Find Learning Partners</h2></div>
                {!groups?.computedAt ? (
                  <p className="t-body text-muted">{mine.length ? "Your learning group will appear here when your instructor shares the recommendations." : "Watch a few moves and join the discussion to discover learning partners."}</p>
                ) : declined ? (
                  <p className="t-body text-muted">No problem. You can still join a general beginner group.</p>
                ) : (
                  <p className="t-body text-muted">{mine.length ? "We haven't found a full learning group yet. You can join a general beginner group instead." : "Watch a few moves and join the discussion to discover learning partners."}</p>
                )}
                {mine.length > 0 && <p className="t-sub">Your topics: {mine.map((t) => TOPIC_LABEL[t]).join(", ")}</p>}
                <Btn variant="secondary" className="bg-card" disabled={busy} onClick={() => run({ type: "general-join" }, openPractice)}>Join a General Beginner Group</Btn>
              </>
            )}
            {err && <p className="t-sub text-[#B42318] dark:text-[#FF6961]" role="alert">{err}</p>}
          </section>
        </div>
      </div>
    </div>
  );
}

/** Four-person collaborative mini-scenario. Answers stay hidden until the reveal. */
export function PracticeRoom({ group, practice, people, me, act, onBack }: { group: Group; practice: PracticeView | null; people: Record<string, Viewer>; me: string; act: Act; onBack: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [text, setText] = useState("");
  const chatEnd = useRef<HTMLDivElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (practice?.stage === "reveal") revealRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [practice?.stage, practice?.round]);
  const run = async (a: Record<string, unknown>) => { setBusy(true); setErr(null); try { await act(a); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  useEffect(() => { chatEnd.current?.scrollIntoView({ block: "end" }); }, [practice?.chat.length]);
  const members = group.members.filter((m) => group.status[m] === "accepted");
  const invited = group.members.filter((m) => group.status[m] === "invited");
  if (!practice) return <div className="h-full flex items-center justify-center t-body text-muted">Opening the practice room…</div>;
  const order = scenarioOrder(group.topics);
  const sc = SCENARIOS[order[practice.idx % order.length]];
  const reveal = practice.stage === "reveal";
  const my = practice.answers[me];
  const label = (id: string) => sc.options.find((o) => o.id === id)?.label || id;

  return (
    <div className="h-full min-h-0 max-w-[1320px] mx-auto w-full px-4 py-4 grid grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)] gap-4">
      <section className="min-h-0 overflow-y-auto rounded-[22px] border border-line bg-card p-5 flex flex-col gap-4" aria-label={sc.title} data-practice>
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="h-11 px-2 -ml-2 rounded-full t-sub font-medium inline-flex items-center gap-1 hover:bg-hover"><ArrowLeft size={18} /> Summary</button>
          <span className="ml-auto t-sub text-muted">Scenario {practice.idx + 1} · {TOPIC_LABEL[sc.topic]}</span>
        </div>
        <div>
          <h1 className="text-[26px] leading-[34px] font-semibold text-green-text">{sc.title}</h1>
          {sc.context && <p className="t-body text-muted mt-1">{sc.context}</p>}
          <p className="text-[18px] leading-[27px] font-semibold mt-2">{sc.prompt}</p>
        </div>
        {sc.hand.length > 0 && (
          <div className="spec-table rounded-[18px] p-4 flex flex-wrap gap-[3px] justify-center" style={{ ["--t" as string]: "30px" }} aria-label={`Sample hand: ${sc.hand.map(tileName).join(", ")}`}>
            {sc.hand.map((t) => <WTile key={t} id={t} w="44px" hl={!!sc.highlight?.includes(t)} label={tileName(t)} />)}
          </div>
        )}
        <div className={cx("grid gap-2", sc.options.some((o) => o.tiles && o.tiles.length > 1) ? "grid-cols-3" : sc.options.length > 4 ? "grid-cols-6" : "grid-cols-2")} role="radiogroup" aria-label="Your answer">
          {sc.options.map((o) => {
            const chosen = my === o.id, correct = reveal && o.id === sc.correct;
            const who = reveal ? Object.entries(practice.answers).filter(([, c]) => c === o.id).map(([s]) => s) : [];
            return (
              <button key={o.id} role="radio" aria-checked={chosen} disabled={busy || !!my || reveal} onClick={() => run({ type: "prac-answer", choice: o.id })}
                className={cx("rounded-[16px] border-[1.5px] p-3 flex flex-col items-center gap-2 min-h-14 transition-colors",
                  correct ? "border-green bg-green-soft" : chosen ? "border-green-strong bg-sage" : "border-line bg-card hover:bg-hover disabled:hover:bg-card",
                  reveal && !correct && "opacity-75")}>
                {o.tiles && <span className="flex gap-[2px]">{o.tiles.map((t) => <span key={t} className="w-[34px]"><WTile id={t} w="34px" /></span>)}</span>}
                <span className="t-section">{o.label}{correct ? " ✓" : ""}</span>
                {who.length > 0 && <span className="flex -space-x-1.5" aria-label={`Chosen by ${who.map((s) => people[s]?.name || "a viewer").join(", ")}`}>{who.map((s) => <VAvatar key={s} v={people[s]} size={26} ring />)}</span>}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2" aria-live="polite">
          {members.map((m) => (
            <span key={m} className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 t-sub">
              <VAvatar v={people[m]} size={24} />{people[m]?.name || "Viewer"}{m === me ? " (you)" : ""}
              {practice.answered.includes(m) ? <Check size={16} className="text-green-text" aria-label="answered" /> : <Clock size={16} className="text-muted" aria-label="thinking" />}
            </span>
          ))}
          {invited.length > 0 && <span className="t-sub text-muted">{invited.length} invited, not joined yet</span>}
        </div>
        {!reveal && my && <div className="flex items-center gap-3 flex-wrap"><p className="t-body text-muted">You chose {label(my)}. Answers appear when everyone has chosen.</p>
          <Btn variant="secondary" className="bg-card min-h-11" disabled={busy} onClick={() => run({ type: "prac-reveal" })}>Reveal Answers Now</Btn></div>}
        {reveal && (
          <div ref={revealRef} className="rounded-[16px] bg-sage p-4 flex flex-col gap-2 mt-pop" data-reveal>
            <p className="t-section">{my ? (my === sc.correct ? "You got it!" : `Correct answer: ${label(sc.correct)}`) : `Correct answer: ${label(sc.correct)}`}</p>
            <p className="t-body">{sc.explain}</p>
            <div className="flex gap-2 flex-wrap mt-1">
              <Btn disabled={busy} onClick={() => run({ type: "prac-next", round: practice.round })}>Next Scenario</Btn>
              <Btn variant="secondary" className="bg-card" onClick={() => { window.location.href = "/profile?next=class"; }}>Play a Full Mahjong Game</Btn>
            </div>
          </div>
        )}
        {err && <p className="t-sub text-[#B42318] dark:text-[#FF6961]" role="alert">{err}</p>}
      </section>
      <section className="min-h-0 rounded-[22px] border border-line bg-card flex flex-col overflow-hidden" aria-label="Group discussion">
        <div className="px-4 pt-3 pb-2 border-b border-line"><h2 className="t-page">Group Discussion</h2>
          <p className="t-sub text-muted">{group.kind === "topic" ? `Shared topics: ${group.topics.map((t) => TOPIC_LABEL[t]).join(", ")}` : "General beginner group"}</p></div>
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-2">
          {!practice.chat.length && <p className="t-body text-muted">Talk it through: why do you think that's the answer?</p>}
          {practice.chat.map((c) => (
            <div key={c.id} className={cx("flex gap-2 items-start", c.sid === me && "flex-row-reverse")}>
              <VAvatar v={people[c.sid]} size={28} />
              <div className={cx("max-w-[80%] rounded-[14px] px-3 py-1.5", c.sid === me ? "bg-green-strong text-white" : "bg-bubble")}>
                {c.sid !== me && <p className="t-sub font-semibold">{people[c.sid]?.name || "Viewer"}</p>}
                <p className={cx(c.kind === "emoji" ? "text-[26px] leading-[32px]" : "t-body", "break-words")}>{c.text}</p>
              </div>
            </div>
          ))}
          <div ref={chatEnd} />
        </div>
        <div className="px-3 pt-2 flex gap-1.5 flex-wrap">
          {["👍", "❤️", "😂", "👏", "🤔", "🎉"].map((e) => <button key={e} onClick={() => run({ type: "prac-emoji", text: e })} aria-label={`React ${e}`} className="h-11 w-11 rounded-full bg-bubble hover:bg-hover text-[20px]">{e}</button>)}
        </div>
        <form className="px-3 py-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) run({ type: "prac-chat", text }).then(() => setText("")); }}>
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder="Ask a follow-up question…" aria-label="Message your group"
            className="flex-1 min-w-0 h-12 px-3 rounded-[12px] border border-line bg-page outline-none focus:border-green" />
          <Btn type="submit" className="min-h-12 px-3" disabled={!text.trim()} aria-label="Send"><Send size={16} /></Btn>
        </form>
      </section>
    </div>
  );
}
