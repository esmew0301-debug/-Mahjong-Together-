"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Msg, RoomResponse } from "./types";
import { looksLikeQuestion } from "./mahjong/assistant";
import { displayName } from "./names";

const withDisplayNames = <T extends { name: string }>(ps: T[]): T[] => ps.map((p) => ({ ...p, name: displayName(p.name) }));

export class ApiError extends Error {
  constructor(public status: number, message: string, public config = false) {
    super(message);
  }
}

export async function api<T = any>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  let j: any = null;
  try {
    j = await r.json();
  } catch {}
  if (!r.ok) throw new ApiError(r.status, j?.error || `Request failed (${r.status})`, !!j?.config);
  return j as T;
}

export function rememberRoom(code: string) {
  try {
    localStorage.setItem("mt.lastRoom", code);
  } catch {}
}
export function forgetRoom(code?: string) {
  try {
    if (!code || localStorage.getItem("mt.lastRoom") === code) localStorage.removeItem("mt.lastRoom");
  } catch {}
}
export function lastRoom(): string | null {
  try {
    return localStorage.getItem("mt.lastRoom");
  } catch {
    return null;
  }
}

export type Conn = "connecting" | "live" | "retrying";

/** Short-interval polling of the shared room (≈1s while visible, slower when hidden, backoff on errors). */
export function useRoom(code: string) {
  const [data, setData] = useState<RoomResponse | null>(null);
  const [notMember, setNotMember] = useState(false);
  const [fatal, setFatal] = useState<ApiError | null>(null);
  const [conn, setConn] = useState<Conn>("connecting");
  const vRef = useRef(0);
  const failures = useRef(0);

  const accept = useCallback((d: RoomResponse) => {
    if (d.room.v >= vRef.current) {
      vRef.current = d.room.v;
      setData({ ...d, room: { ...d.room, players: withDisplayNames(d.room.players) } });
    }
  }, []);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const j = await api<any>(`/api/rooms/${code}?v=${vRef.current}`);
        failures.current = 0;
        setConn("live");
        if (!j.member) setNotMember(true);
        else if (j.same) setData((d) => (d ? { ...d, room: { ...d.room, players: withDisplayNames(j.players) } } : d));
        else accept(j);
      } catch (e) {
        if (e instanceof ApiError && (e.status === 404 || e.config)) {
          setFatal(e);
          return;
        }
        failures.current++;
        setConn("retrying");
      }
      if (stop) return;
      const hidden = typeof document !== "undefined" && document.hidden;
      const base = hidden ? 5000 : 1000;
      timer = setTimeout(tick, Math.min(base * Math.pow(2, failures.current), 10000));
    };
    tick();
    const onVis = () => {
      if (!document.hidden) {
        clearTimeout(timer);
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [code, accept]);

  const act = useCallback(async (action: Record<string, unknown>) => accept(await api<RoomResponse>(`/api/rooms/${code}/action`, action)), [code, accept]);
  const ask = useCallback(async (question: string) => accept(await api<RoomResponse>(`/api/rooms/${code}/ai`, { question })), [code, accept]);
  const summarize = useCallback(async () => accept(await api<RoomResponse>(`/api/rooms/${code}/ai`, { mode: "summarize" })), [code, accept]);
  const followup = useCallback(async (topicId: string, facet: string) => accept(await api<RoomResponse>(`/api/rooms/${code}/ai`, { mode: "followup", topicId, facet })), [code, accept]);
  const current = useCallback(async () => accept(await api<RoomResponse>(`/api/rooms/${code}/ai`, { mode: "current" })), [code, accept]);

  return { data, notMember, fatal, conn, act, ask, summarize, followup, current };
}

export function openQuestionCount(messages: Msg[], since: number) {
  return messages.filter((m) => m.ts > since && m.sender !== "ai" && m.sender !== "system" && looksLikeQuestion(m.text)).length;
}
