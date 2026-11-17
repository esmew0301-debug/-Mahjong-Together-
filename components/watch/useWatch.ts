"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "@/lib/client";
import type { Discussion, GameSummary, Groups, Practice, Session, SpecEvent, SpecView, Viewer } from "@/lib/watch/types";

export type PracticeView = Practice & { answered: string[] };
export interface WatchData {
  me: Viewer;
  classroom: string;
  watching: number;
  mode: "waiting" | "select" | "live" | "summary";
  games?: GameSummary[];
  game?: string;
  featured?: boolean;
  session?: Session | null;
}

/**
 * Spectator polling (~1 s while visible). Only changed parts are sent: the game projection (room version), the feed
 * since the last known event, the discussion / groups / practice documents (their versions) and viewer profiles.
 * On a lost connection the last synchronized state stays on screen and `stale` is set.
 */
export function useWatch(cls: string, game: string | null) {
  const [data, setData] = useState<WatchData | null>(null);
  const [view, setView] = useState<SpecView | null>(null);
  const [feed, setFeed] = useState<SpecEvent[]>([]);
  const [disc, setDisc] = useState<Discussion>({ v: 0, questions: [] });
  const [groups, setGroups] = useState<Groups | null>(null);
  const [practice, setPractice] = useState<PracticeView | null>(null);
  const [people, setPeople] = useState<Record<string, Viewer>>({});
  const [stale, setStale] = useState(false);
  const [fatal, setFatal] = useState<ApiError | null>(null);
  const v = useRef({ rv: 0, fs: 0, dv: 0, gv: 0, pv: 0, pc: -1, game: "" });
  const fails = useRef(0);

  const acceptDisc = useCallback((d: Discussion) => { if (d.v >= v.current.dv) { v.current.dv = d.v; setDisc(d); } }, []);
  const acceptPractice = useCallback((p: PracticeView) => { if (p.v >= v.current.pv) { v.current.pv = p.v; setPractice(p); } }, []);

  const poll = useCallback(async () => {
    const q = v.current;
    const j = await api<any>(`/api/watch/${encodeURIComponent(cls)}?rv=${q.rv}&fs=${q.fs}&dv=${q.dv}&gv=${q.gv}&pv=${q.pv}&pc=${q.pc}${game ? `&game=${encodeURIComponent(game)}` : ""}`);
    if (j.game && j.game !== q.game) { Object.assign(q, { rv: 0, fs: 0, game: j.game }); setFeed([]); } // switched game
    if (j.view) {
      const sv = j.view as SpecView;
      q.rv = sv.roomV;
      setView(sv);
      if (sv.feed.length || sv.feedMin) {
        setFeed((f) => {
          const merged = [...f, ...sv.feed.filter((e) => !f.some((x) => x.seq === e.seq))].filter((e) => e.seq >= sv.feedMin).sort((a, b) => a.seq - b.seq);
          q.fs = merged.length ? merged[merged.length - 1].seq : q.fs;
          return merged;
        });
        if (sv.feed.length) q.fs = Math.max(q.fs, sv.feed[sv.feed.length - 1].seq);
      }
    }
    if (j.disc) acceptDisc(j.disc);
    if (j.groups) { q.gv = j.groups.v; setGroups(j.groups); }
    if (j.practice) acceptPractice(j.practice);
    if (j.people) { q.pc = j.pc; setPeople((p) => ({ ...p, ...j.people })); }
    setData({ me: j.me, classroom: j.classroom, watching: j.watching, mode: j.mode, games: j.games, game: j.game, featured: j.featured, session: j.session });
  }, [cls, game, acceptDisc, acceptPractice]);

  useEffect(() => {
    let stop = false;
    let t: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        await poll();
        fails.current = 0;
        setStale(false);
      } catch (e) {
        if (e instanceof ApiError && [401, 403, 404].includes(e.status)) { setFatal(e); return; }
        fails.current++;
        setStale(true);
      }
      if (stop) return;
      const hidden = typeof document !== "undefined" && document.hidden;
      t = setTimeout(tick, Math.min((hidden ? 4000 : 1000) * Math.pow(2, Math.min(fails.current, 3)), 8000));
    };
    tick();
    const vis = () => { if (!document.hidden) { clearTimeout(t); tick(); } };
    document.addEventListener("visibilitychange", vis);
    return () => { stop = true; clearTimeout(t); document.removeEventListener("visibilitychange", vis); };
  }, [poll]);

  /** Spectator action; retries once if the shared document was busy (atomic compare-and-set lost a race). */
  const act = useCallback(async (a: Record<string, unknown>) => {
    const send = () => api<{ result: any }>(`/api/watch/${encodeURIComponent(cls)}/act`, { game: v.current.game || undefined, ...a });
    let r;
    try { r = await send(); } catch (e) { if (e instanceof ApiError && e.status === 409 && /try again/i.test(e.message)) r = await send(); else throw e; }
    const res = r.result;
    if (res && Array.isArray(res.questions)) acceptDisc(res);
    else if (res && Array.isArray(res.groups)) { v.current.gv = res.v; setGroups(res); }
    else if (res && res.group && "stage" in res) acceptPractice(res);
    poll().catch(() => {});
    return res;
  }, [cls, acceptDisc, acceptPractice, poll]);

  return { data, view, feed, disc, groups, practice, people, stale, fatal, act };
}
