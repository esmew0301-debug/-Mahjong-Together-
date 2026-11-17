"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Clock, Home, Send, Sparkles, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { api, rememberRoom } from "@/lib/client";
import type { Discussion, Group, Groups, Topic, Viewer } from "@/lib/watch/types";
import { TOPIC_LABEL, TOPIC_SHORT } from "@/lib/watch/topics";
import { interestProfiles, joinWords } from "@/lib/watch/groups";
import { PRACTICE_LENGTH, scenarioById } from "@/lib/watch/scenarios";
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

/** Plain-language description of what a topic is about (no analytics, no internal tags). */
const ABOUT: Record<Topic, string> = {
  tile: "what the tiles mean", discard: "why players discard certain tiles", dingque: "the missing suit (Ding Que)", exchange: "exchanging three tiles",
  pung: "when you can call Pung", kong: "how Kong works", hu: "what makes a winning hand", scoring: "how points are counted", turn: "whose turn it is", general: "the basic rules",
};

/** Spectator summary — appears automatically when the watched hand / game ends. Real people and simple words only. */
export function Summary({ disc, groups, people, me, act, openPractice, backToTable, gameOver, liveAgain }: {
  disc: Discussion; groups: Groups | null; people: Record<string, Viewer>; me: string; act: Act; openPractice: () => void; backToTable: () => void; gameOver: boolean; liveAgain: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async (a: Record<string, unknown>, then?: () => void) => {
    setBusy(true); setErr(null);
    try { await act(a); then?.(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  // topics shared by at least two people, with those people (from public questions and +1s only)
  const shared = useMemo(() => {
    const by: Partial<Record<Topic, Set<string>>> = {};
    for (const q of disc.questions) for (const s of q.same) (by[q.topic] ||= new Set()).add(s);
    return (Object.entries(by) as [Topic, Set<string>][]).filter(([, s]) => s.size >= 2).map(([t, s]) => ({ t, ids: [...s] })).sort((a, b) => b.ids.length - a.ids.length).slice(0, 4);
  }, [disc]);
  const mine = interestProfiles(disc)[me] || [];
  const g = myGroupOf(groups, me);
  const accepted = !!g && g.status[me] === "accepted";
  const declined = groups?.groups.some((x) => x.kind === "topic" && x.members.includes(me) && x.status[me] === "declined");

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1120px] mx-auto px-6 py-8 flex flex-col gap-6">
        <div className="flex items-end gap-4 mt-pop">
          <div className="flex-1">
            <h1 className="text-[32px] leading-[40px] font-semibold text-green-text">You Learned Together!</h1>
            <p className="t-body text-muted mt-1">See what your classmates were curious about.</p>
          </div>
          {!gameOver && <Btn variant="secondary" className="bg-card" onClick={backToTable}>{liveAgain ? "Watch the Next Hand" : "Back to the Table"}</Btn>}
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-6 items-start">
          <section className="rounded-[22px] border border-line bg-card p-6 flex flex-col gap-4" aria-label="People who asked similar questions" data-similar-people>
            <h2 className="t-page">People who asked similar questions</h2>
            {shared.length ? shared.map(({ t, ids }) => (
              <div key={t} className="rounded-[16px] border border-line bg-page p-4 flex flex-col gap-2">
                <p className="t-body">Several of you wondered about <b>{ABOUT[t]}</b>.</p>
                <ul className="flex flex-wrap gap-2">
                  {ids.map((id) => <li key={id} className="inline-flex items-center gap-1.5 rounded-full bg-card border border-line pl-1 pr-3 py-1 t-sub"><VAvatar v={people[id]} size={26} />{people[id]?.name || "Viewer"}{id === me ? " (you)" : ""}</li>)}
                </ul>
              </div>
            )) : <p className="t-body text-muted">No shared questions came up at this table yet.</p>}
          </section>

          <section className="rounded-[22px] border border-line bg-card p-6 flex flex-col gap-4 mt-pop" aria-label="Your learning group" data-group-card>
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
                <div className="flex items-center gap-2"><Users size={22} className="text-green-text" /><h2 className="t-page">Beginner Practice Group</h2></div>
                <p className="t-body">{g.members.length === 1 ? "You're the first one here. Others can join you." : "Other beginners have joined you."}</p>
                <div className="flex -space-x-2">{g.members.map((id) => <span key={id} title={people[id]?.name}><VAvatar v={people[id]} size={36} ring /></span>)}</div>
                <Btn onClick={openPractice}><Sparkles size={18} /> Open Practice Room</Btn>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2"><Users size={22} className="text-green-text" /><h2 className="t-page">Find Learning Partners</h2></div>
                <p className="t-body text-muted">{declined ? "No problem. You can still practice with other beginners." : mine.length ? "We haven't found a full learning group yet. You can join a general beginner group instead." : "Watch a few moves and join the discussion to discover learning partners."}</p>
                <Btn variant="secondary" className="bg-card self-start" disabled={busy} onClick={() => run({ type: "general-join" }, openPractice)}>Join a Beginner Group</Btn>
              </>
            )}
            {err && <p className="t-sub text-[#B42318] dark:text-[#FF6961]" role="alert">{err}</p>}
          </section>
        </div>
      </div>
    </div>
  );
}

type Attempt = { id: string; members: { id: string; name: string; avatar: string }[]; deadlineInMs: number; room?: string };

/** Group Discussion (right column): talk while everyone works at their own pace. */
function GroupChat({ group, practice, people, me, act }: { group: Group; practice: PracticeView; people: Record<string, Viewer>; me: string; act: Act }) {
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [practice.chat.length]);
  const send = async (a: Record<string, unknown>) => { try { await act(a); return true; } catch { return false; } };
  return (
    <section className="min-h-0 rounded-[22px] border border-line bg-card flex flex-col overflow-hidden" aria-label="Group discussion">
      <div className="px-4 pt-3 pb-2 border-b border-line"><h2 className="t-page">Group Discussion</h2>
        <p className="t-sub text-muted">{group.kind === "topic" ? `You all asked about ${joinWords(group.topics.map((t) => TOPIC_SHORT[t]))}.` : "Beginner practice group"}</p></div>
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-2">
        {!practice.chat.length && <p className="t-body text-muted">Everyone answers at their own pace. Talk it through here.</p>}
        {practice.chat.map((c) => (
          <div key={c.id} className={cx("flex gap-2 items-start", c.sid === me && "flex-row-reverse")}>
            <VAvatar v={people[c.sid]} size={28} />
            <div className={cx("max-w-[80%] rounded-[14px] px-3 py-1.5", c.sid === me ? "bg-green-strong text-white" : "bg-bubble")}>
              {c.sid !== me && <p className="t-sub font-semibold">{people[c.sid]?.name || "Viewer"}</p>}
              <p className={cx(c.kind === "emoji" ? "text-[26px] leading-[32px]" : "t-body", "break-words")}>{c.text}</p>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <div className="px-3 pt-2 flex gap-1.5 flex-wrap">
        {["👍", "❤️", "😂", "👏", "🤔", "🎉"].map((e) => <button key={e} onClick={() => send({ type: "prac-emoji", text: e })} aria-label={`React ${e}`} className="h-11 w-11 rounded-full bg-bubble hover:bg-hover text-[20px]">{e}</button>)}
      </div>
      <form className="px-3 py-3 flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (text.trim() && (await send({ type: "prac-chat", text }))) setText(""); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder="Ask a follow-up question…" aria-label="Message your group"
          className="flex-1 min-w-0 h-12 px-3 rounded-[12px] border border-line bg-page outline-none focus:border-green" />
        <Btn type="submit" className="min-h-12 px-3" disabled={!text.trim()} aria-label="Send"><Send size={16} /></Btn>
      </form>
    </section>
  );
}

/** Other members' progress (never their answers). */
function Progress({ group, practice, people, me }: { group: Group; practice: PracticeView; people: Record<string, Viewer>; me: string }) {
  const members = group.members.filter((m) => group.status[m] === "accepted");
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Group progress">
      {members.map((m) => {
        const u = practice.users[m];
        const label = !u ? "Question 1 of 5" : u.decision === "yes" ? "Ready to play" : u.decision === "no" ? "Went home" : u.done ? "Finished" : `Question ${u.idx + 1} of 5`;
        return (
          <span key={m} className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 t-sub" data-member={m}>
            <VAvatar v={people[m]} size={24} />{people[m]?.name || "Viewer"}{m === me ? " (you)" : ""}<span className="text-muted">· {label}</span>
            {u?.done ? <Check size={16} className="text-green-text" aria-hidden /> : <Clock size={16} className="text-muted" aria-hidden />}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Learning-group practice: every learner answers the group's FIVE distinct questions independently, with immediate
 * feedback; then chooses Play a Game Together (a fresh real Mahjong room for the willing members, AI for empty
 * seats) or Back to Home.
 */
export function PracticeRoom({ group, practice, people, me, act, onBack, cls, game }: { group: Group; practice: PracticeView | null; people: Record<string, Viewer>; me: string; act: Act; onBack: () => void; cls: string; game?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState<{ qid: string; choice: string } | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const run = async (a: Record<string, unknown>) => { setBusy(true); setErr(null); try { await act(a); return true; } catch (e) { setErr((e as Error).message); return false; } finally { setBusy(false); } };
  const my = practice?.users[me] || { idx: 0, answers: {} as Record<string, string>, done: false, decision: undefined as undefined | "yes" | "no" };
  const waiting = my.decision === "yes";

  // Waiting for Everyone: poll the pending game; when the fresh room exists, go straight to it (seat cookie set by the server)
  useEffect(() => {
    if (!waiting) return;
    let stop = false, t: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const j = await api<{ status: string; attempt?: Attempt; room?: string }>(`/api/watch/${encodeURIComponent(cls)}/game`, { game });
        if (stop) return;
        if (j.attempt) setAttempt(j.attempt);
        if (j.status === "formed" && j.room) { rememberRoom(j.room); router.push(`/room/${j.room}`); return; }
      } catch {}
      if (!stop) t = setTimeout(tick, 1000);
    };
    tick();
    return () => { stop = true; clearTimeout(t); };
  }, [waiting, cls, game, router]);
  useEffect(() => {
    if (!attempt) return;
    const endAt = Date.now() + attempt.deadlineInMs;
    const f = () => setLeft(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)));
    f(); const iv = setInterval(f, 250); return () => clearInterval(iv);
  }, [attempt]);

  if (!practice) return <div className="h-full flex items-center justify-center t-body text-muted">Opening the practice room…</div>;
  const goHome = async () => { if (await run({ type: "prac-decide", choice: "no" })) router.push("/"); };
  const chat = <GroupChat group={group} practice={practice} people={people} me={me} act={act} />;
  const shell = (main: React.ReactNode) => (
    <div className="h-full min-h-0 max-w-[1320px] mx-auto w-full px-4 py-4 grid grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)] gap-4">
      <section className="min-h-0 overflow-y-auto rounded-[22px] border border-line bg-card p-6 flex flex-col gap-5" data-practice>{main}{err && <p className="t-sub text-[#B42318] dark:text-[#FF6961]" role="alert">{err}</p>}</section>
      {chat}
    </div>
  );

  // ---------------- Waiting for Everyone
  if (waiting) {
    const members = attempt?.members || [{ id: me, name: people[me]?.name || "You", avatar: people[me]?.avatar || "smile" }];
    const still = group.members.filter((m) => group.status[m] === "accepted" && !members.some((x) => x.id === m) && practice.users[m]?.decision !== "no");
    return shell(<>
      <div>
        <h1 className="text-[28px] leading-[36px] font-semibold text-green-text">Waiting for Everyone</h1>
        <p className="t-body text-muted mt-1">Learners from your group who choose to play join this table. Empty seats are filled with simulated players.</p>
      </div>
      <ul className="grid grid-cols-4 gap-3" data-waiting-seats>
        {[0, 1, 2, 3].map((k) => {
          const m = members[k];
          return m ? (
            <li key={m.id} className="rounded-[18px] border border-green bg-card py-5 px-3 flex flex-col items-center gap-2 text-center mt-pop">
              <VAvatar v={{ avatar: m.avatar }} size={60} />
              <span className="t-section truncate max-w-full">{m.name}{m.id === me ? " (you)" : ""}</span>
              <span className="t-sub text-green-text inline-flex items-center gap-1"><Check size={14} /> Ready</span>
            </li>
          ) : (
            <li key={`open-${k}`} className="rounded-[18px] border border-dashed border-dash py-5 px-3 flex flex-col items-center gap-2 text-center">
              <span className="h-[60px] w-[60px] rounded-full border-2 border-dashed border-dash" aria-hidden />
              <span className="t-section text-muted">Open Seat</span>
              <span className="t-sub text-muted">Waiting for learner / AI</span>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-4 border-t border-line pt-5">
        <div className="flex-1" aria-live="polite">
          <p className="t-body">{members.length >= 4 ? "Everyone's here. Opening your table…" : left !== null && left > 0 ? `Empty seats are filled with simulated players in ${left}s` : "Opening your table…"}</p>
          {still.length > 0 && <p className="t-sub text-muted">Still deciding: {still.map((m) => `${people[m]?.name || "Learner"}${practice.users[m]?.done ? "" : ` (Question ${(practice.users[m]?.idx ?? 0) + 1} of 5)`}`).join(", ")}</p>}
        </div>
        <Btn variant="secondary" className="bg-card min-w-[180px]" disabled={busy} onClick={goHome}><Home size={16} /> Leave and Go Home</Btn>
      </div>
      <Progress group={group} practice={practice} people={people} me={me} />
    </>);
  }

  // ---------------- completion
  if (my.done) {
    return shell(<>
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-8" data-complete>
        <Sparkles size={36} className="text-green-text" />
        <h1 className="text-[32px] leading-[40px] font-semibold text-green-text">You&apos;ve Finished All 5 Questions!</h1>
        <p className="text-[18px] leading-[28px] text-muted max-w-[560px]">Great work! You&apos;ve completed the practice. Ready to try a real game of Sichuan Mahjong?</p>
        <div className="grid grid-cols-2 gap-4 mt-5 w-full max-w-[560px]">
          <Btn className="min-h-14 text-[17px]" disabled={busy} onClick={() => run({ type: "prac-decide", choice: "yes" })}><Users size={18} /> Play a Game Together</Btn>
          <Btn variant="secondary" className="min-h-14 text-[17px] bg-card" disabled={busy} onClick={goHome}><Home size={18} /> Back to Home</Btn>
        </div>
      </div>
      <Progress group={group} practice={practice} people={people} me={me} />
    </>);
  }

  // ---------------- question i of 5 (individual)
  const qid = practice.set[my.idx];
  const sc = scenarioById(qid)!;
  const chosen = my.answers[qid] || (pending?.qid === qid ? pending.choice : undefined);
  const right = chosen === sc.correct;
  const label = (id: string) => sc.options.find((o) => o.id === id)?.label || id;
  const wrongWhy = chosen && !right ? sc.options.find((o) => o.id === chosen)?.why : undefined;
  const last = my.idx === PRACTICE_LENGTH - 1;
  const answer = (choice: string) => { if (chosen) return; setPending({ qid, choice }); run({ type: "prac-answer", qid, choice }); };
  return shell(<>
    <div className="flex items-center gap-3">
      <button onClick={onBack} className="h-11 px-2 -ml-2 rounded-full t-sub font-medium inline-flex items-center gap-1 hover:bg-hover"><ArrowLeft size={18} /> Summary</button>
      <span className="ml-auto t-section" data-progress>Question {my.idx + 1} of {PRACTICE_LENGTH}</span>
      <span className="flex gap-1.5" aria-hidden>{Array.from({ length: PRACTICE_LENGTH }).map((_, k) => <span key={k} className={cx("h-2 w-8 rounded-full", k < my.idx || (k === my.idx && chosen) ? "bg-green" : k === my.idx ? "bg-green/40" : "bg-line")} />)}</span>
    </div>
    <Progress group={group} practice={practice} people={people} me={me} />
    <div data-question-id={qid}>
      <p className="t-sub font-semibold text-green-text">{sc.title}</p>
      {sc.context && <p className="t-body text-muted mt-1">{sc.context}</p>}
      <p className="text-[20px] leading-[30px] font-semibold mt-1">{sc.prompt}</p>
    </div>
    {sc.hand.length > 0 && (
      <div className="spec-table rounded-[18px] p-4 flex flex-wrap gap-[3px] justify-center" style={{ ["--t" as string]: "30px" }} aria-label={`Sample hand: ${sc.hand.map(tileName).join(", ")}`}>
        {sc.hand.map((t) => <WTile key={t} id={t} w="44px" hl={!!sc.highlight?.includes(t)} label={tileName(t)} />)}
      </div>
    )}
    <div className={cx("grid gap-3", sc.options.some((o) => o.tiles && o.tiles.length > 1) ? "grid-cols-3" : sc.options.length > 3 ? "grid-cols-6" : sc.options.length === 3 ? "grid-cols-3" : "grid-cols-2")} role="radiogroup" aria-label="Your answer">
      {sc.options.map((o) => {
        const isChosen = chosen === o.id, isRight = !!chosen && o.id === sc.correct;
        return (
          <button key={o.id} role="radio" aria-checked={isChosen} disabled={!!chosen || busy} onClick={() => answer(o.id)}
            className={cx("rounded-[16px] border-[1.5px] p-3 flex flex-col items-center gap-2 min-h-16 transition-colors",
              isRight ? "border-green bg-green-soft" : isChosen ? "border-[#D92D20] bg-[#FEF3F2] dark:bg-[#3a1512]" : "border-line bg-card hover:bg-hover disabled:hover:bg-card", chosen && !isRight && !isChosen && "opacity-70")}>
            {o.tiles && <span className="flex gap-[2px]">{o.tiles.map((t) => <span key={t} className="w-[38px]"><WTile id={t} w="38px" /></span>)}</span>}
            <span className="t-section">{o.label}</span>
            {isRight && <span className="t-sub text-green-text inline-flex items-center gap-1"><Check size={14} /> Correct answer</span>}
            {isChosen && !isRight && <span className="t-sub text-[#B42318] dark:text-[#FF6961] inline-flex items-center gap-1"><X size={14} /> Your answer</span>}
          </button>
        );
      })}
    </div>
    {chosen && (
      <div className={cx("rounded-[16px] p-4 flex flex-col gap-2 mt-pop", right ? "bg-green-soft" : "bg-surface border border-line")} data-feedback={right ? "correct" : "wrong"}>
        <p className="text-[20px] leading-[28px] font-semibold">{right ? "Correct!" : "Not Quite!"}</p>
        {!right && wrongWhy && <p className="t-body">{wrongWhy}</p>}
        {!right && <p className="t-body font-medium">Correct answer: {label(sc.correct)}</p>}
        <p className="t-body">{sc.explain}</p>
        <div className="flex justify-end mt-1">
          <Btn className="min-w-[200px]" disabled={busy || !my.answers[qid]} onClick={() => run({ type: "prac-next", qid })}>{last ? "Finish Quiz" : "Next Question"}</Btn>
        </div>
      </div>
    )}
  </>);
}
