"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Clock, Home, Send, Sparkles, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { api, rememberRoom } from "@/lib/client";
import type { Discussion, Group, Groups, Question, SpecPlayer, Topic, Viewer } from "@/lib/watch/types";
import { TOPIC_LABEL, TOPIC_SHORT } from "@/lib/watch/topics";
import { interestProfiles, joinWords } from "@/lib/watch/groups";
import { TOPIC_EXPLAIN, groupName } from "@/lib/watch/basics";
import { explainMoment, meaningfulQuestion, momentTiles } from "@/lib/watch/moments";
import { tileName } from "@/lib/mj/rules";
import { T } from "@/lib/watch/scenarios";
import { Btn, cx } from "@/components/ui";
import { RefChip, VAvatar } from "./Discussion";
import { SpecTable, WTile } from "./SpecTable";
import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";
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

/** A few real tiles that illustrate a topic (small, decorative). */
const TOPIC_TILES: Record<Topic, string[]> = {
  dingque: ["d5", "b5", "c5"], discard: ["c9", "b2", "d5"], exchange: ["d1", "d4", "d9"], pung: ["b3", "b3", "b3"], kong: ["d6", "d6", "d6", "d6"],
  hu: ["b1", "b2", "b3", "d7", "d7", "d7", "d6", "d6"], tile: ["d1", "b1", "c1"], scoring: ["c5", "c5", "c5"], turn: ["d2", "b7", "c4"], general: ["d5", "b5", "c5"],
};
function TopicTiles({ t }: { t: Topic }) {
  const seen: Record<string, number> = {};
  return <span className="flex gap-[3px]" aria-hidden>{TOPIC_TILES[t].map((k, i) => { const c = (seen[k] = (seen[k] ?? -1) + 1); return <span key={i} className={cx("w-[30px]", t === "dingque" && i === 1 && "intro-fade")}><WTile id={T(k, c)} w="30px" /></span>; })}</span>;
}

/** Why you were matched: the group's real shared topic, your own honest participation, and one short rule. */
function SharedTopic({ g, disc, me }: { g: Group; disc: Discussion; me: string }) {
  const t = g.topics[0];
  const members = new Set(g.members);
  const involved = (q: Question) => [...q.same, ...q.replies.map((r) => r.author)].some((m) => members.has(m));
  const qs = disc.questions.filter((q) => g.topics.includes(q.topic) && involved(q)).sort((a, b) => b.same.length - a.same.length || a.ts - b.ts);
  const role = (q: Question) => (q.author === me ? "You asked this" : q.same.includes(me) ? "You agreed (+1)" : q.replies.some((r) => r.author === me) ? "You replied" : "Asked in your group");
  const others = g.members.length - 1;
  if (!t) return null;
  return (
    <section className="rounded-[22px] border border-green bg-card p-6 flex flex-col gap-3 mt-pop" aria-label="Your shared question" data-shared-topic>
      <h2 className="t-page text-green-text">You Had Similar Questions About {TOPIC_LABEL[t]}</h2>
      <p className="t-body">You and {others === 1 ? "one other viewer" : `${NUM[others] || others} other viewers`} were curious about {ABOUT[t]}.</p>
      {qs.slice(0, 2).map((q) => (
        <div key={q.id} className="rounded-[14px] border border-line bg-page px-3 py-2 flex flex-col gap-1.5">
          <p className="t-body">“{q.text}”</p>
          <div className="flex items-center gap-2 flex-wrap">{q.ref && <RefChip r={q.ref} compact />}<span className="t-sub text-muted">{role(q)}</span></div>
        </div>
      ))}
      <div className="rounded-[14px] bg-sage px-4 py-3 flex items-center gap-4">
        <div className="flex-1"><p className="t-section">{TOPIC_EXPLAIN[t].title}</p><p className="t-sub mt-0.5">{TOPIC_EXPLAIN[t].text}</p></div>
        <TopicTiles t={t} />
      </div>
    </section>
  );
}

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
          <div className="flex flex-col gap-6 min-w-0">
          {g && g.kind === "topic" && <SharedTopic g={g} disc={disc} me={me} />}
          <section className="rounded-[22px] border border-line bg-card p-6 flex flex-col gap-4" aria-label="People who asked similar questions" data-similar-people>
            <h2 className="t-page">People who asked similar questions</h2>
            {shared.length ? shared.map(({ t, ids }) => (
              <div key={t} className="rounded-[16px] border border-line bg-page p-4 flex flex-col gap-2">
                <p className="t-body">Several of you wondered about <b>{ABOUT[t]}</b>.</p>
                <ul className="flex flex-wrap gap-2">
                  {ids.map((id) => <li key={id} className="inline-flex items-center gap-1.5 rounded-full bg-card border border-line pl-1 pr-3 py-1 t-sub"><VAvatar v={people[id]} size={26} />{people[id]?.name || "Viewer"}{id === me ? " (you)" : ""}</li>)}
                </ul>
                <div className="rounded-[12px] bg-sage px-3 py-2.5 flex items-center gap-3 mt-1" data-topic-explain={t}>
                  <div className="flex-1 min-w-0"><p className="t-section">{TOPIC_EXPLAIN[t].title}</p><p className="t-sub mt-0.5">{TOPIC_EXPLAIN[t].text}</p></div>
                  <TopicTiles t={t} />
                </div>
              </div>
            )) : <p className="t-body text-muted">No shared questions came up at this table yet.</p>}
          </section>
          </div>

          <section className="rounded-[22px] border border-line bg-card p-6 flex flex-col gap-4 mt-pop" aria-label="Your learning group" data-group-card>
            {g && g.kind === "topic" ? (
              <>
                <div className="flex items-center gap-2"><Users size={22} className="text-green-text" /><h2 className="t-page flex-1">Meet Your Learning Group</h2><span className="t-sub font-medium text-green-text bg-green-soft rounded-full px-3 py-1">{groupName(g.topics)}</span></div>
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
                <p className="t-sub text-muted">Revisit real moments from the game and talk through your shared questions together. Afterward, you can start a Mahjong game with your group.</p>
                {accepted ? (
                  <Btn onClick={openPractice}><Sparkles size={18} /> Open Discussion Group</Btn>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <InteractiveHoverButton disabled={busy} onClick={() => run({ type: "group-accept", gid: g.id }, openPractice)}>Join Discussion Group</InteractiveHoverButton>
                    <Btn variant="secondary" className="bg-card" disabled={busy} onClick={() => run({ type: "group-decline", gid: g.id })}>Maybe Later</Btn>
                  </div>
                )}
              </>
            ) : g && g.kind === "general" ? (
              <>
                <div className="flex items-center gap-2"><Users size={22} className="text-green-text" /><h2 className="t-page">Shared Questions Group</h2></div>
                <p className="t-body">{g.members.length === 1 ? "You're the first one here. Others can join you." : "Other viewers have joined you."}</p>
                <div className="flex -space-x-2">{g.members.map((id) => <span key={id} title={people[id]?.name}><VAvatar v={people[id]} size={36} ring /></span>)}</div>
                <Btn onClick={openPractice}><Sparkles size={18} /> Open Discussion Group</Btn>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2"><Users size={22} className="text-green-text" /><h2 className="t-page">Find Learning Partners</h2></div>
                <p className="t-body text-muted">{declined ? "No problem. You can still join a Shared Questions Group." : mine.length ? "We haven't found a full group with the same questions yet. You can join a Shared Questions Group instead." : "Watch a few moves and join the discussion to discover learning partners."}</p>
                <Btn variant="secondary" className="bg-card self-start" disabled={busy} onClick={() => run({ type: "general-join" }, openPractice)}>Join a Shared Questions Group</Btn>
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

/** Group Discussion: messages are kept per moment (earlier moments stay readable, never mixed). */
function GroupChat({ group, practice, people, me, act, compact }: { group: Group; practice: PracticeView; people: Record<string, Viewer>; me: string; act: Act; compact?: boolean }) {
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [practice.chat.length]);
  const send = async (a: Record<string, unknown>) => { try { await act(a); return true; } catch { return false; } };
  const n = practice.moments.length;
  return (
    <section className="min-h-0 flex-1 rounded-[22px] border border-line bg-card flex flex-col overflow-hidden" aria-label="Group discussion">
      <div className="px-4 pt-3 pb-2 border-b border-line"><h2 className="t-page">Group Discussion</h2>
        <p className="t-sub text-muted">{group.kind === "topic" ? `${groupName(group.topics)} · you all asked about ${joinWords(group.topics.map((t) => TOPIC_SHORT[t]))}.` : "Shared Questions Group"}</p></div>
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-2" data-chat>
        {!practice.chat.length && <p className="t-body text-muted">{compact ? "Share what you think this move was about." : "Talk it through here."}</p>}
        {practice.chat.map((c, k) => {
          const head = c.moment !== undefined && n > 0 && (k === 0 || practice.chat[k - 1].moment !== c.moment);
          return (
            <div key={c.id} className="flex flex-col gap-2">
              {head && <p className="t-sub text-muted text-center py-1" data-chat-moment={c.moment}>{c.moment! < n ? `Moment ${c.moment! + 1}` : "After the discussion"}</p>}
              <div className={cx("flex gap-2 items-start", c.sid === me && "flex-row-reverse")}>
                <VAvatar v={people[c.sid]} size={28} />
                <div className={cx("max-w-[80%] rounded-[14px] px-3 py-1.5", c.sid === me ? "bg-green-strong text-white" : "bg-bubble")}>
                  {c.sid !== me && <p className="t-sub font-semibold">{people[c.sid]?.name || "Viewer"}</p>}
                  <p className={cx(c.kind === "emoji" ? "text-[26px] leading-[32px]" : "t-body", "break-words")}>{c.text}</p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <div className="px-3 pt-2 flex gap-1.5 flex-wrap">
        {["👍", "❤️", "😂", "👏", "🤔", "🎉"].map((e) => <button key={e} onClick={() => send({ type: "prac-emoji", text: e })} aria-label={`React ${e}`} className="h-11 w-11 rounded-full bg-bubble hover:bg-hover text-[20px]">{e}</button>)}
      </div>
      <form className="px-3 py-3 flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (text.trim() && (await send({ type: "prac-chat", text }))) setText(""); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder="Share your thinking or ask a follow-up…" aria-label="Message your group"
          className="flex-1 min-w-0 h-12 px-3 rounded-[12px] border border-line bg-page outline-none focus:border-green" />
        <Btn type="submit" className="min-h-12 px-3" disabled={!text.trim()} aria-label="Send"><Send size={16} /></Btn>
      </form>
    </section>
  );
}

/** Members' status (group progress / decisions). */
function Progress({ group, practice, people, me }: { group: Group; practice: PracticeView; people: Record<string, Viewer>; me: string }) {
  const members = group.members.filter((m) => group.status[m] === "accepted");
  const done = practice.cur >= practice.moments.length;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Group progress">
      {members.map((m) => {
        const u = practice.users[m] || {};
        const active = !practice.active || practice.active.includes(m);
        const label = u.decision === "yes" ? "Ready to play" : u.decision === "no" ? "Went home" : done ? "Finished" : !active ? "Away" : practice.ready.includes(m) ? "Understands" : "Discussing";
        const ok = u.decision === "yes" || done || practice.ready.includes(m);
        return (
          <span key={m} className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 t-sub" data-member={m}>
            <VAvatar v={people[m]} size={24} />{people[m]?.name || "Viewer"}{m === me ? " (you)" : ""}<span className="text-muted">· {label}</span>
            {ok ? <Check size={16} className="text-green-text" aria-hidden /> : <Clock size={16} className="text-muted" aria-hidden />}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Collaborative practice on REAL moments of the watched game: everyone sees the same recorded table (the move circled
 * in red), reads what happened and why, discusses, and confirms "I Understand"; when every active member has
 * confirmed, the whole group moves to the next moment. Afterwards: the completion screen (Play a Game Together /
 * Back to Home) and, for willing members, the existing Waiting for Everyone → fresh real game flow.
 */
export function PracticeRoom({ group, practice, people, me, act, onBack, cls, game, players }: { group: Group; practice: PracticeView | null; people: Record<string, Viewer>; me: string; act: Act; onBack: () => void; cls: string; game?: string; players: SpecPlayer[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const prevCur = useRef<number | null>(null);
  const run = async (a: Record<string, unknown>) => { setBusy(true); setErr(null); try { await act(a); return true; } catch (e) { setErr((e as Error).message); return false; } finally { setBusy(false); } };
  const my = practice?.users[me] || {};
  const waiting = my.decision === "yes";

  useEffect(() => {
    if (!practice) return;
    if (prevCur.current !== null && practice.cur > prevCur.current) { setAdvanced(true); const t = setTimeout(() => setAdvanced(false), 1600); prevCur.current = practice.cur; return () => clearTimeout(t); }
    prevCur.current = practice.cur;
  }, [practice?.cur]); // eslint-disable-line react-hooks/exhaustive-deps

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

  if (!practice) return <div className="h-full flex items-center justify-center t-body text-muted">Opening the discussion group…</div>;
  const goHome = async () => { await run({ type: "prac-decide", choice: "no" }); router.push("/"); }; // leaving always works (no seat is ever held without a yes)
  const names = Object.fromEntries(players.map((p) => [p.id, p.name]));
  const done = practice.cur >= practice.moments.length;
  const shell = (main: React.ReactNode) => (
    <div className="h-full min-h-0 max-w-[1320px] mx-auto w-full px-4 py-4 grid grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)] gap-4">
      <section className="min-h-0 overflow-y-auto rounded-[22px] border border-line bg-card p-6 flex flex-col gap-5" data-practice>{main}{err && <p className="t-sub text-[#B42318] dark:text-[#FF6961]" role="alert">{err}</p>}</section>
      <GroupChat group={group} practice={practice} people={people} me={me} act={act} />
    </div>
  );

  // ---------------- Waiting for Everyone (unchanged flow)
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
          {still.length > 0 && <p className="t-sub text-muted">Still deciding: {still.map((m) => people[m]?.name || "Learner").join(", ")}</p>}
        </div>
        <Btn variant="secondary" className="bg-card min-w-[180px]" disabled={busy} onClick={goHome}><Home size={16} /> Leave and Go Home</Btn>
      </div>
      <Progress group={group} practice={practice} people={people} me={me} />
    </>);
  }

  // ---------------- completion (existing screen; wording only)
  if (done) {
    const n = practice.moments.length;
    return shell(<>
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-8" data-complete>
        <Sparkles size={36} className="text-green-text" />
        <h1 className="text-[32px] leading-[40px] font-semibold text-green-text">{n === 4 ? "You've Explored All 4 Game Moments!" : "You've Completed the Group Discussion!"}</h1>
        <p className="text-[18px] leading-[28px] text-muted max-w-[560px]">{n ? "Great work! You've explored real Mahjong moves together. Ready to try a game?" : "Your group's questions weren't tied to specific recorded moves, so there were no game moments to revisit. Ready to try a game?"}</p>
        <div className="grid grid-cols-2 gap-4 mt-5 w-full max-w-[560px]">
          <InteractiveHoverButton className="min-h-14 text-[17px]" disabled={busy} onClick={() => run({ type: "prac-decide", choice: "yes" })} icon={<Users size={18} />}>Play a Game Together</InteractiveHoverButton>
          <Btn variant="secondary" className="min-h-14 text-[17px] bg-card" disabled={busy} onClick={goHome}><Home size={18} /> Back to Home</Btn>
        </div>
      </div>
      <Progress group={group} practice={practice} people={people} me={me} />
    </>);
  }

  // ---------------- shared real moment
  const m = practice.moments[practice.cur];
  const ex = explainMoment(m.ref, m.snap, names);
  const tiles = momentTiles(m);
  const persp = m.ref.actor && m.snap.order.includes(m.ref.actor) ? m.ref.actor : m.snap.order[0];
  const active = (practice.active || group.members.filter((x) => group.status[x] === "accepted"));
  const readyN = active.filter((x) => practice.ready.includes(x)).length;
  const iReady = practice.ready.includes(me);
  const revealed = !!practice.revealed;
  // who has shared a real text message about THIS moment (same rule as the server; emoji don't count)
  const said = new Set(practice.chat.filter((c) => c.moment === practice.cur && c.kind === "text" && c.text.replace(/\s+/g, "").length >= 2).map((c) => c.sid));
  const saidN = active.filter((x) => said.has(x)).length;
  const allSaid = active.length > 0 && saidN === active.length;
  const tablePlayers: SpecPlayer[] = m.snap.order.map((pid, k) => players.find((p) => p.id === pid) || { id: pid, name: pid === m.ref.actor ? m.ref.actorName || "Player" : "Player", seat: k });
  return (
    <div className="h-full min-h-0 max-w-[1440px] mx-auto w-full px-4 py-4 grid grid-cols-[minmax(0,1.75fr)_minmax(340px,1fr)] gap-4" data-practice-moment={practice.cur}>
      <section className="min-h-0 rounded-[22px] border border-line bg-card p-5 flex flex-col gap-3" data-practice>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="h-11 px-2 -ml-2 rounded-full t-sub font-medium inline-flex items-center gap-1 hover:bg-hover"><ArrowLeft size={18} /> Summary</button>
          <span className="ml-auto t-section" data-progress>Moment {practice.cur + 1} of {practice.moments.length}</span>
          <span className="flex gap-1.5" aria-hidden>{practice.moments.map((_, k) => <span key={k} className={cx("h-2 w-8 rounded-full", k < practice.cur ? "bg-green" : k === practice.cur ? "bg-green/40" : "bg-line")} />)}</span>
        </div>
        <div>
          <p className="text-[20px] leading-[28px] font-semibold" data-moment-question>{ex.title}</p>
          <p className="t-sub text-muted mt-0.5">{meaningfulQuestion(m.question) ? `A viewer asked: “${m.question}” · ` : ""}Move {m.seq}{ex.label ? ` · ${ex.label}` : ""}{tiles.length ? " · circled in red" : ""}</p>
        </div>
        <div className="relative flex-1 min-h-[360px]" data-moment-table>
          <SpecTable snap={m.snap} players={tablePlayers} persp={persp} highlight={tiles.length ? { tiles, actor: m.ref.actor } : null} paused red scores={{}} statusText={`Recorded move ${m.seq}`} unit="clamp(16px, min(1.6vw, 2.55vh), 30px)" />
          {advanced && <div className="absolute inset-x-0 top-4 flex justify-center z-30"><span className="rounded-full bg-green-strong text-white px-4 py-2 t-section shadow-sheet mt-pop">Everyone&apos;s Ready — Next Moment</span></div>}
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <Btn className="min-w-[200px]" variant={iReady ? "ok" : "primary"} disabled={busy || iReady || !revealed} onClick={() => run({ type: "prac-understand", moment: practice.cur })}><Check size={18} /> {iReady ? "You Understand" : "I Understand"}</Btn>
          <p className="t-body" aria-live="polite" data-ready-count>{revealed ? `${readyN} of ${active.length} ready to continue` : "Discuss first, then view the explanation"}</p>
          <span className="flex -space-x-1.5 ml-auto">{active.map((x) => (
            <span key={x} className="relative" title={`${people[x]?.name || "Viewer"}${practice.ready.includes(x) ? " · understands" : ""}`}>
              <VAvatar v={people[x]} size={32} ring />
              {practice.ready.includes(x) && <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-green-strong text-white ring-2 ring-card flex items-center justify-center"><Check size={10} strokeWidth={3} /></span>}
            </span>
          ))}</span>
        </div>
        {err && <p className="t-sub text-[#B42318] dark:text-[#FF6961]" role="alert">{err}</p>}
      </section>
      <div className="min-h-0 flex flex-col gap-4">
        <section className="rounded-[22px] border border-line bg-card p-5 flex flex-col gap-2 max-h-[58%] overflow-y-auto" aria-label="What Happened Here?" data-explain>
          <h2 className="t-page">What Happened Here?</h2>
          <p className="t-body">{ex.happened}</p>
          {!revealed ? (
            <div className="rounded-[12px] bg-sage px-3 py-2.5 mt-1 flex flex-col gap-2" data-discuss>
              <p className="t-section">Discuss Together</p>
              <p className="t-body">{ex.prompt}</p>
              <p className="t-sub text-muted" aria-live="polite" data-said-count>{saidN} of {active.length} members have shared their thoughts</p>
              <Btn className="self-start min-h-11" disabled={busy || !allSaid} onClick={() => run({ type: "prac-reveal", moment: practice.cur })}>View Explanation</Btn>
              {!allSaid && <p className="t-sub text-muted -mt-1">Unlocks when everyone has posted one message in Group Discussion.</p>}
            </div>
          ) : (
            <div className="flex flex-col gap-2 mt-1 mt-pop" data-revealed>
              <h3 className="t-section">Why This Move?</h3>
              <p className="t-body">{ex.why}</p>
              <p className="t-sub rounded-[12px] bg-sage px-3 py-2"><b>Key takeaway:</b> {ex.takeaway}</p>
            </div>
          )}
        </section>
        <GroupChat group={group} practice={practice} people={people} me={me} act={act} compact />
      </div>
    </div>
  );
}
