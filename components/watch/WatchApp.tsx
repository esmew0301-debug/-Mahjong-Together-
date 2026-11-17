"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CircleHelp, Eye, Pause, Play, Radio, X } from "lucide-react";
import { api } from "@/lib/client";

import type { QRef, SpecEvent, SpecSnap } from "@/lib/watch/types";
import { Btn, cx } from "@/components/ui";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { EMOJI_FONT, emojiFor } from "@/components/s3/avatar";
import { SpecTable, WTile, type Highlight, type TableModel } from "./SpecTable";
import { DiscussionPanel, VAvatar } from "./Discussion";
import { PracticeRoom, Summary, myGroupOf } from "./Learn";
import { Guide, Intro } from "./Basics";
import { useWatch } from "./useWatch";

const SHORT: Record<string, string> = { discard: "Discard", pung: "Pung", kong: "Kong", hu: "Hu", deal: "New hand", exchange: "Exchange", dingque: "Ding Que", end: "Hand over", draw: "Draw" };

function Centered({ title, text, children }: { title: string; text?: string; children?: React.ReactNode }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center gap-2 px-6">
      <h2 className="text-[24px] leading-[32px] font-semibold text-green-text">{title}</h2>
      {text && <p className="t-body text-muted max-w-[520px]">{text}</p>}
      {children}
    </div>
  );
}

export function WatchApp({ cls }: { cls: string }) {
  const router = useRouter();
  // the table being watched survives a reload (per classroom, this browser only); the server re-validates it
  const gameKey = `mt.watchGame.${cls}`;
  const [game, setGameState] = useState<string | null>(() => { try { return typeof window === "undefined" ? null : localStorage.getItem(gameKey); } catch { return null; } });
  const setGame = useCallback((g: string | null) => { setGameState(g); try { if (g) localStorage.setItem(gameKey, g); else localStorage.removeItem(gameKey); } catch {} }, [gameKey]);
  const w = useWatch(cls, game);
  const { data, view, feed, disc, groups, practice, people, stale, fatal, act } = w;
  const [persp, setPersp] = useState<string | null>(null);
  const [paused, setPaused] = useState<{ event: SpecEvent; snap: SpecSnap } | null>(null);
  const [snaps, setSnaps] = useState<Record<number, SpecSnap>>({});
  const [selRef, setSelRef] = useState<QRef | null>(null);
  const [draft, setDraft] = useState({ text: "", focus: 0 });
  const [toast, setToast] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const [screen, setScreen] = useState<"auto" | "practice" | "table">("auto");
  // The summary appears automatically when the watched hand / game ends and stays until the viewer leaves it.
  const [sticky, setSticky] = useState(false);
  const summaryKey = useRef("");
  const tableBox = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const [bubble, setBubble] = useState<{ left: number; top: number } | null>(null);

  // pin the table being watched — but after "Switch Table", only from a response that arrived after the switch
  const switchedAt = useRef<unknown>(null);
  useEffect(() => {
    if (switchedAt.current) { if (data === switchedAt.current) return; switchedAt.current = null; }
    if (!game && data?.game && data.mode !== "select") setGame(data.game);
  }, [data, game]);
  useEffect(() => {
    if (data?.mode !== "summary") return;
    const key = `${data.game}:${view?.live?.hand ?? 0}:${data.gameOver ? "done" : "hand"}`;
    if (summaryKey.current !== key) { summaryKey.current = key; setSticky(true); setScreen((s) => (s === "practice" ? s : "auto")); }
  }, [data?.mode, data?.game, data?.gameOver, view?.live?.hand]);
  useEffect(() => { if (fatal?.status === 401) router.replace(`/watch?code=${encodeURIComponent(cls)}`); }, [fatal, cls, router]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3200); return () => clearTimeout(t); }, [toast]);

  const live = view?.live || null;
  const players = view?.players || [];
  const names = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p.name])), [players]);
  const order = live?.order || [...players].sort((a, b) => a.seat - b.seat).map((p) => p.id);
  useEffect(() => { if (order.length && (!persp || !order.includes(persp))) setPersp(order[0]); }, [order.join(","), persp]); // eslint-disable-line react-hooks/exhaustive-deps

  const moves = useMemo(() => feed.filter((e) => e.type !== "draw"), [feed]);
  const newest = [...feed].reverse().find((e) => e.type === "discard");
  useEffect(() => { const el = strip.current; if (el && !paused) el.scrollLeft = el.scrollWidth; }, [moves.length, paused]);

  const refOf = useCallback((e: SpecEvent): QRef => {
    const p = players.find((x) => x.id === e.actor);
    return { seq: e.seq, game: e.game, hand: e.hand, type: e.type, actor: e.actor, actorName: p?.name, actorAvatar: p?.avatar, actorKind: p?.kind, tile: e.tile, text: e.text, ts: e.ts, rule: e.rule, from: e.from };
  }, [players]);

  const inspect = useCallback(async (seq: number) => {
    if (!data?.game) return;
    try {
      const j = await api<{ event: SpecEvent; snap: SpecSnap }>(`/api/watch/${encodeURIComponent(cls)}/snap?game=${encodeURIComponent(data.game)}&seq=${seq}`);
      setSnaps((s) => ({ ...s, [seq]: j.snap }));
      setPaused(j);
    } catch (e) { setToast((e as Error).message); }
  }, [cls, data?.game]);
  const onTile = (tile: number) => {
    const ev = [...feed].reverse().find((e) => e.tile === tile && ["discard", "pung", "kong", "hu"].includes(e.type));
    if (!ev) return setToast("This move is no longer available for replay.");
    inspect(ev.seq);
  };
  const backToLive = () => { setPaused(null); setBubble(null); };
  const askAbout = () => {
    if (!paused) return;
    setSelRef(refOf(paused.event));
    setDraft((d) => ({ text: d.text, focus: Date.now() }));
  };

  const shown: TableModel | null = paused ? { ...paused.snap } : live;
  const highlight: Highlight | null = useMemo(() => {
    if (!paused) return null;
    const e = paused.event;
    const tiles = e.tile !== undefined ? [e.tile] : [];
    if ((e.type === "pung" || e.type === "kong") && e.actor) {
      const m = (paused.snap.melds[e.actor] || []).find((x) => x.tiles.includes(e.tile!));
      if (m) tiles.push(...m.tiles);
    }
    return { tiles, actor: e.actor };
  }, [paused]);

  // anchor the question bubble next to the highlighted move (clamped inside the table)
  useLayoutEffect(() => {
    if (!paused) return;
    const place = () => {
      const box = tableBox.current;
      if (!box) return;
      const b = box.getBoundingClientRect();
      const W = 300, H = 168, G = 12;
      const rel = (e: Element) => { const r = e.getBoundingClientRect(); return { l: r.left - b.left, t: r.top - b.top, r: r.right - b.left, b: r.bottom - b.top }; };
      const hls = [...box.querySelectorAll("[data-hl]")].map(rel);
      if (!hls.length) { setBubble({ left: b.width / 2 - W / 2, top: b.height / 2 - H / 2 }); return; }
      const t = { l: Math.min(...hls.map((x) => x.l)), t: Math.min(...hls.map((x) => x.t)), r: Math.max(...hls.map((x) => x.r)), b: Math.max(...hls.map((x) => x.b)) };
      const actor = paused?.event.actor;
      const seats = [...box.querySelectorAll("[data-seat]")].map((e) => ({ ...rel(e), mine: (e as HTMLElement).dataset.pid === actor }));
      const piles = [...box.querySelectorAll("[data-pile], [data-status]")].map(rel);
      const ov = (a: { l: number; t: number; r: number; b: number }, x: number, y: number) => Math.max(0, Math.min(a.r, x + W) - Math.max(a.l, x)) * Math.max(0, Math.min(a.b, y + H) - Math.max(a.t, y));
      const cx0 = (t.l + t.r) / 2, cy0 = (t.t + t.b) / 2;
      const clampX = (x: number) => Math.min(Math.max(8, x), b.width - W - 8), clampY = (y: number) => Math.min(Math.max(8, y), b.height - H - 8);
      // candidates: next to the move (above / below / left / right) and the four corners; pick the least-covering one
      const cands = [[cx0 - W / 2, t.t - H - G], [cx0 - W / 2, t.b + G], [t.l - W - G, cy0 - H / 2], [t.r + G, cy0 - H / 2], [8, 8], [b.width - W - 8, 8], [8, b.height - H - 8], [b.width - W - 8, b.height - H - 8]]
        .map(([x, y]) => [clampX(x), clampY(y)]);
      let best = cands[0], bestScore = Infinity;
      for (const [x, y] of cands) {
        const near = Math.hypot(x + W / 2 - cx0, y + H / 2 - cy0);
        const score = hls.reduce((s2, h) => s2 + ov(h, x, y) * 60, 0) + seats.reduce((s2, st) => s2 + ov(st, x, y) * (st.mine ? 5 : 1.2), 0) + piles.reduce((s2, pl) => s2 + ov(pl, x, y), 0) + near * 8;
        if (score < bestScore) { bestScore = score; best = [x, y]; }
      }
      setBubble({ left: best[0], top: best[1] });
    };
    place();
    const t = setTimeout(place, 380); // after a perspective layout animation
    window.addEventListener("resize", place);
    return () => { clearTimeout(t); window.removeEventListener("resize", place); };
  }, [paused, persp]);

  if (fatal && fatal.status !== 401) {
    return (
      <div data-wide className="h-[100dvh] flex flex-col bg-page">
        <Centered title={fatal.status === 403 ? "You're a Player in This Game" : "Classroom Not Found"} text={fatal.message}>
          <Btn className="mt-3" onClick={() => router.push("/")}>Back to Home</Btn>
        </Centered>
      </div>
    );
  }

  const mode = data?.mode;
  const closed = !data?.session || data.session.status !== "live";
  const g = myGroupOf(groups, data?.me.id || "");
  const showPractice = screen === "practice" && g && g.status[data!.me.id] === "accepted";
  const showSummary = !showPractice && sticky && screen !== "table";
  const scores = view?.scores || {};

  const header = (
    <header className="h-16 shrink-0 w-full max-w-[1600px] mx-auto px-4 flex items-center gap-3">
      <button onClick={() => router.push("/")} className="h-11 px-2 -ml-2 rounded-full inline-flex items-center gap-1 t-sub font-medium hover:bg-hover" aria-label="Back to Home"><ArrowLeft size={18} /> Home</button>
      <span className="t-app text-green-text whitespace-nowrap">Mahjong Together</span>
      <span className="h-6 w-px bg-line" aria-hidden />
      <span className="t-section whitespace-nowrap">Watching {cls}</span>
      {mode === "live" && live && <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D92D20] text-white px-2.5 h-7 t-sub font-semibold" aria-label="Live"><Radio size={14} /> LIVE</span>}
      <span className="inline-flex items-center gap-1.5 t-sub text-muted whitespace-nowrap" data-watching><Eye size={16} /> {data?.watching ?? "–"} watching</span>
      <span className="flex-1" />
      {(data?.tables ?? 0) > 1 && game && <Btn variant="secondary" className="min-h-10 px-3 bg-card t-sub" onClick={() => { switchedAt.current = data; setGame(null); setPaused(null); setSticky(false); setScreen("auto"); }}>Switch Table</Btn>}
      {data && <span className="hidden xl:inline-flex items-center gap-2 t-sub text-muted"><VAvatar v={data.me} size={28} />{data.me.name}</span>}
      <button onClick={() => setHelp(true)} aria-label="Help" className="h-11 w-11 rounded-full flex items-center justify-center hover:bg-hover"><CircleHelp size={20} /></button>
      <ThemeToggle />
    </header>
  );

  const tableColumn = (
    <div className="min-h-0 min-w-0 flex flex-col gap-3">
      {/* perspective selector */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="t-sub text-muted shrink-0">Perspective</span>
        <div className="flex gap-1.5 min-w-0 flex-wrap" role="radiogroup" aria-label="Choose a player perspective">
          {order.map((pid) => {
            const p = players.find((x) => x.id === pid);
            const on = persp === pid;
            return (
              <button key={pid} role="radio" aria-checked={on} onClick={() => setPersp(pid)} aria-label={`Watch from ${p?.name || "player"}'s seat`}
                className={cx("min-h-11 pl-1.5 pr-3 rounded-full border inline-flex items-center gap-1.5 t-sub font-medium transition-colors",
                  on ? "bg-green-strong border-green-strong text-white" : "bg-card border-line hover:bg-hover")}>
                <span className="h-8 w-8 rounded-full bg-white/90 inline-flex items-center justify-center" aria-hidden><span style={{ ...EMOJI_FONT, fontSize: 18, lineHeight: 1 }}>{p ? emojiFor(p) : "🙂"}</span></span>
                {p?.name || "Player"}{shown?.turn === pid && shown.phase === "play" ? <span className={cx("h-2 w-2 rounded-full", on ? "bg-[#ffd166]" : "bg-green-strong")} aria-label="their turn" /> : null}
              </button>
            );
          })}
        </div>
        <span className="flex-1" />
        {paused ? (
          <Btn className="min-h-11 px-3 shrink-0" onClick={backToLive}><Play size={16} /> Back to Live</Btn>
        ) : live ? <span className="t-sub text-muted shrink-0 inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#D92D20] animate-pulse" aria-hidden /> Following live</span> : null}
      </div>
      {/* the square table */}
      <div ref={tableBox} className="relative flex-1 min-h-0" data-table-box>
        {shown ? (
          <SpecTable snap={shown} players={players} persp={persp || order[0]} highlight={highlight} paused={!!paused} newestTile={newest?.tile} onDiscard={onTile} scores={scores} />
        ) : (
          <div className="spec-table h-full rounded-[28px] flex items-center justify-center">
            <div className="text-center text-white px-6">
              {stale ? <>
                <p className="text-[24px] leading-[32px] font-semibold">Connection interrupted. Reconnecting…</p>
                <p className="t-body text-white/85 mt-1">We can't reach the server right now. The table appears as soon as the connection is back.</p>
              </> : <>
                <p className="text-[24px] leading-[32px] font-semibold">Waiting for the Game to Start</p>
                <p className="t-body text-white/85 mt-1">{view ? "The players are getting ready. The live table appears as soon as the first hand is dealt." : "Your classroom is ready. The live Mahjong table will appear when the players begin."}</p>
              </>}
              {players.length > 0 && <div className="flex justify-center gap-3 mt-4">{players.map((p) => <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full bg-black/25 px-3 h-10 t-sub"><span style={EMOJI_FONT}>{emojiFor(p)}</span>{p.name}</span>)}</div>}
            </div>
          </div>
        )}
        {paused && bubble && (
          <div className="absolute z-20 w-[300px] rounded-[18px] bg-card border border-line shadow-sheet p-4 flex flex-col gap-2 mt-pop" style={{ left: bubble.left, top: bubble.top }} role="dialog" aria-label="Have a Question?" data-bubble>
            <div className="flex items-center gap-2">
              {paused.event.tile !== undefined && <span className="w-[26px] shrink-0"><WTile id={paused.event.tile} w="26px" /></span>}
              <div className="min-w-0"><p className="t-section">Have a Question?</p><p className="t-sub text-muted truncate">{paused.event.text}</p></div>
            </div>
            {selRef?.seq === paused.event.seq
              ? <p className="t-sub text-green-text">Write your question in the discussion panel →</p>
              : <p className="t-sub text-muted">Ask about this move. Only your view is paused.</p>}
            <div className="grid grid-cols-2 gap-2">
              <Btn className="min-h-11 px-2 t-sub" disabled={closed || selRef?.seq === paused.event.seq} onClick={askAbout}>Ask About This Move</Btn>
              <Btn variant="secondary" className="min-h-11 px-2 t-sub bg-card" onClick={backToLive}>Back to Live</Btn>
            </div>
          </div>
        )}
      </div>
      {/* recent moves (bounded replay buffer) */}
      <div className="shrink-0 flex items-center gap-2 min-w-0" aria-label="Recent moves">
        <span className="t-sub text-muted shrink-0 inline-flex items-center gap-1">{paused ? <Pause size={14} /> : null}Moves</span>
        <div ref={strip} className="flex-1 min-w-0 overflow-x-auto no-scrollbar flex gap-1.5 py-0.5" data-moves>
          {moves.length === 0 && <span className="t-sub text-muted">Moves will appear here as the players act.</span>}
          {moves.slice(-60).map((e) => {
            const p = players.find((x) => x.id === e.actor);
            const on = paused?.event.seq === e.seq;
            return (
              <button key={e.seq} onClick={() => inspect(e.seq)} aria-label={`Inspect move ${e.seq}: ${e.text}`} title={e.text} aria-pressed={on}
                className={cx("shrink-0 min-h-11 pl-1.5 pr-2.5 rounded-full border inline-flex items-center gap-1.5 t-sub spec-new", on ? "bg-green-soft border-green text-green-text font-semibold" : "bg-card border-line hover:bg-hover")}>
                {p ? <span style={{ ...EMOJI_FONT, fontSize: 16 }} aria-hidden>{emojiFor(p)}</span> : null}
                {e.tile !== undefined && <span className="w-[16px]"><WTile id={e.tile} w="16px" /></span>}
                <span>{e.type === "deal" ? `Hand ${e.hand}` : SHORT[e.type]}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div data-wide className="h-[100dvh] flex flex-col bg-page overflow-hidden" data-watch-app>
      {header}
      {stale && <div className="shrink-0 mx-auto mb-2 rounded-full bg-[#FEF3C7] text-[#7A4B00] dark:bg-[#3a2e0b] dark:text-[#FCD34D] px-4 py-1.5 t-sub" role="status">Connection interrupted. Reconnecting… The view may be out of date.</div>}
      <main className="flex-1 min-h-0 w-full max-w-[1600px] mx-auto px-4 pb-4">
        {!data ? <Centered title="Joining the classroom…" />
          : !data.intro && !introDone ? <Intro onDone={() => { setIntroDone(true); act({ type: "intro-done" }).catch(() => {}); }} />
          : showPractice ? <PracticeRoom group={g!} practice={practice} people={people} me={data.me.id} act={act} onBack={() => setScreen("auto")} cls={cls} game={data.game} players={players} />
          : showSummary ? <Summary disc={disc} groups={groups} people={people} me={data.me.id} act={act} openPractice={() => setScreen("practice")} gameOver={!!data.gameOver}
              backToTable={() => { setSticky(false); setScreen("table"); }} liveAgain={mode === "live"} />
          : mode === "select" && !game ? (
            <Centered title="Choose a Table to Watch" text="Several tables are playing in this classroom. Pick one to watch.">
              <div className="grid grid-cols-2 gap-4 mt-5 w-full max-w-[880px]" data-tables>
                {(data.games || []).map((gm) => (
                  <div key={gm.code} className="rounded-[20px] border border-line bg-card p-5 text-left flex flex-col gap-3">
                    <div className="flex items-center"><span className="t-section flex-1">Table {gm.code}</span><span className="t-sub text-muted">{gm.status}</span></div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">{gm.players.map((p, k) => <span key={k} className="inline-flex items-center gap-1.5 t-body min-w-0"><span style={EMOJI_FONT}>{emojiFor(p)}</span><span className="truncate">{p.name}</span></span>)}</div>
                    <Btn className="self-start min-w-[140px]" onClick={() => setGame(gm.code)}>Watch</Btn>
                  </div>
                ))}
              </div>
            </Centered>
          ) : (
            <div className="h-full grid gap-4" style={{ gridTemplateColumns: "minmax(0,1.9fr) minmax(340px,1fr)" }}>
              {tableColumn}
              {data.session ? (
                <DiscussionPanel disc={disc} people={people} me={data.me.id} act={act} selRef={selRef} clearRef={() => setSelRef(null)}
                  onRef={(r) => (r.game === data.game ? inspect(r.seq) : setToast("This move is from another game."))} closed={closed}
                  snapFor={selRef ? snaps[selRef.seq] || null : paused?.snap || null} names={names} draft={draft} setDraft={setDraft}
                  pausedRef={paused ? refOf(paused.event) : null} setRef={setSelRef} />
              ) : (
                <section className="rounded-[22px] border border-line bg-card p-6 flex flex-col justify-center text-center gap-2" aria-label="Live Discussion">
                  <h2 className="t-page">Live Discussion</h2>
                  <p className="t-body text-muted">Live Discussion opens automatically as soon as a table starts in this classroom.</p>
                </section>
              )}
            </div>
          )}
        {screen === "table" && mode === "summary" && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40"><Btn onClick={() => { setSticky(true); setScreen("auto"); }}>Back to Summary</Btn></div>}
      </main>
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-ink text-bg px-4 py-2.5 t-sub shadow-sheet mt-pop" role="status">{toast}</div>}
      {help && <Guide onClose={() => setHelp(false)} />}
    </div>
  );
}
