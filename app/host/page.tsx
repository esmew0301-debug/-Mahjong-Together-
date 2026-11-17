"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, RefreshCw, Star } from "lucide-react";
import { ApiError, api } from "@/lib/client";
import type { GameSummary, Session } from "@/lib/watch/types";
import { TOPIC_LABEL } from "@/lib/watch/topics";
import { Btn, cx } from "@/components/ui";
import { EMOJI_FONT, emojiFor } from "@/components/s3/avatar";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface HostState {
  classroom: string; featured: string | null; session: Session | null; games: GameSummary[];
  stats: { watching: number; viewers: number; questions: number; replies: number; topics: Record<string, number>; groups: number; accepted: number; computedAt: number | null };
}

/** Minimal classroom organizer controls (host key required; not visible to spectators). */
function HostInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const cls = (sp.get("class") || "COGS123").toUpperCase();
  const [st, setSt] = useState<HostState | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [key, setKey] = useState("");
  const [room, setRoom] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setSt(await api<HostState>(`/api/host/${cls}`)); setNeedLogin(false); }
    catch (e) { if (e instanceof ApiError && e.status === 401) setNeedLogin(true); else setErr((e as Error).message); }
  }, [cls]);
  useEffect(() => { load(); const t = setInterval(load, 3000); return () => clearInterval(t); }, [load]);
  const act = async (a: Record<string, unknown>) => {
    setBusy(true); setErr(null);
    try { setSt(await api<HostState>(`/api/host/${cls}`, a)); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const login = async () => {
    setBusy(true); setErr(null);
    try { await api("/api/host/login", { key }); await load(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div data-wide className="min-h-[100dvh] bg-page">
      <header className="h-16 max-w-[1120px] mx-auto px-6 flex items-center gap-3">
        <button onClick={() => router.push("/")} className="h-11 px-2 -ml-2 rounded-full inline-flex items-center gap-1 t-sub font-medium hover:bg-hover"><ArrowLeft size={18} /> Home</button>
        <span className="t-app text-green-text">Classroom Host</span><span className="t-section text-muted">{cls}</span>
        <span className="flex-1" /><ThemeToggle />
      </header>
      <main className="max-w-[1120px] mx-auto px-6 pb-10 flex flex-col gap-5">
        {needLogin ? (
          <form className="max-w-[420px] rounded-[22px] border border-line bg-card p-6 flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); login(); }}>
            <h1 className="t-page">Host Sign-In</h1>
            <p className="t-sub text-muted">Host controls need the classroom host key (set on the server). The classroom code alone is not enough.</p>
            <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Host key" aria-label="Host key" className="h-12 px-4 rounded-xl border border-line bg-page outline-none focus:border-green" />
            <Btn type="submit" disabled={busy || !key}>Sign In</Btn>
          </form>
        ) : !st ? <p className="t-body text-muted">Loading…</p> : (
          <>
            <section className="rounded-[22px] border border-line bg-card p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2"><h2 className="t-page flex-1">Featured Teaching Game</h2>
                <button onClick={load} aria-label="Refresh" className="h-11 w-11 rounded-full flex items-center justify-center hover:bg-hover"><RefreshCw size={18} /></button></div>
              <p className="t-sub text-muted">Featuring a game turns on teaching mode: its players are told before the first hand that authorized spectators can see all four hands. Teaching mode must be enabled before the first hand is dealt.</p>
              <ul className="flex flex-col gap-2">
                {st.games.map((g) => (
                  <li key={g.code} className={cx("rounded-[16px] border p-3 flex items-center gap-3", g.featured ? "border-green bg-green-soft" : "border-line")}>
                    <div className="min-w-0 flex-1">
                      <p className="t-section">{g.code} · {g.name}{g.featured && <span className="ml-2 t-sub text-green-text"><Star size={14} className="inline -mt-0.5" /> Featured</span>}</p>
                      <p className="t-sub text-muted flex flex-wrap gap-x-3">{g.players.map((p, i) => <span key={i}><span style={EMOJI_FONT}>{emojiFor(p)}</span> {p.name}{p.kind === "virtual" ? " (AI)" : ""}</span>)}</p>
                      <p className="t-sub text-muted">{g.hand ? `Hand ${g.hand} in progress` : `Status: ${g.status}`}{g.teaching ? " · Teaching mode on" : ""}{g.classroom ? "" : " · Private room"}</p>
                    </div>
                    {g.featured ? <Btn variant="secondary" className="bg-card min-h-11" disabled={busy} onClick={() => act({ type: "unfeature" })}>Unfeature</Btn>
                      : <Btn className="min-h-11" disabled={busy || (!g.teaching && !!g.hand)} onClick={() => act({ type: "feature", room: g.code })}>{!g.teaching && g.hand ? "Already started" : "Feature This Game"}</Btn>}
                  </li>
                ))}
                {!st.games.length && <li className="t-body text-muted">No live games in {cls} yet. Players join with Play Mahjong → Join Room → {cls}.</li>}
              </ul>
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); act({ type: "feature", room }); }}>
                <input value={room} onChange={(e) => setRoom(e.target.value.toUpperCase())} placeholder="Or feature a private room code, e.g. MAH-AB12" aria-label="Game room code"
                  className="flex-1 h-12 px-4 rounded-xl border border-line bg-page outline-none focus:border-green" />
                <Btn type="submit" disabled={busy || !room.trim()}>Feature Room</Btn>
              </form>
            </section>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <section className="rounded-[22px] border border-line bg-card p-5 flex flex-col gap-3">
                <h2 className="t-page">Observation Session</h2>
                <p className="t-body">{st.session ? (st.session.status === "live" ? "Live: spectators can ask questions." : "Ended: spectators see the summary.") : "No session yet. Feature a game to start one."}</p>
                <p className="t-sub text-muted">Ending observation never ends the players' Mahjong game.</p>
                <div className="flex gap-2 flex-wrap">
                  <Btn disabled={busy || !st.featured || st.session?.status === "live"} onClick={() => act({ type: "start-session" })}>Start Observation</Btn>
                  <Btn variant="secondary" className="bg-card" disabled={busy || st.session?.status !== "live"} onClick={() => act({ type: "end-session" })}>End Observation</Btn>
                  <Btn variant="secondary" className="bg-card" disabled={busy || !st.session} onClick={() => act({ type: "recommend" })}>Recommend Learning Groups</Btn>
                </div>
              </section>
              <section className="rounded-[22px] border border-line bg-card p-5 flex flex-col gap-2" aria-label="Question summary">
                <h2 className="t-page">Question Summary</h2>
                <p className="t-body">{st.stats.watching} watching now · {st.stats.viewers} viewers joined</p>
                <p className="t-body">{st.stats.questions} questions · {st.stats.replies} replies</p>
                <p className="t-body">{st.stats.computedAt ? `${st.stats.groups} groups recommended · ${st.stats.accepted} learners joined a group` : "Groups not recommended yet"}</p>
                <ul className="flex flex-wrap gap-1.5 mt-1">
                  {Object.entries(st.stats.topics).sort((a, b) => b[1] - a[1]).map(([t, n]) => <li key={t} className="t-sub rounded-full bg-green-soft text-green-text px-2.5 py-1">{TOPIC_LABEL[t as keyof typeof TOPIC_LABEL]} · {n}</li>)}
                </ul>
              </section>
            </div>
          </>
        )}
        {err && <p className="t-sub text-[#B42318] dark:text-[#FF6961]" role="alert">{err}</p>}
      </main>
    </div>
  );
}
export default function HostPage() { return <Suspense fallback={null}><HostInner /></Suspense>; }
