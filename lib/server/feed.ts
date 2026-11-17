import "server-only";
import type { Room } from "../types";
import type { SpecEvent, SpecSnap } from "../watch/types";
import { kv } from "./kv";

/**
 * Spectator event adapter (Mahjong Together 4.0). Only active for rooms in classroom teaching mode (r.teaching).
 * The engine calls emit() right after it commits an action; the event (public text only) is kept in a bounded
 * server-side feed on the room, and an authorized all-hands snapshot taken AT that moment is staged in r._snaps.
 * mutate() strips the staged snapshots before writing the room and stores each one under its own key after the
 * room write succeeds — so snapshots never enter the room document that players read, and a retried mutation
 * re-creates its own snapshots. Never includes the wall order or any future draw.
 */
export const FEED_MAX = 160; // bounded replay buffer (a full hand is ~110 events)
const SNAP_TTL = 60 * 60 * 24;
export const snapKey = (code: string, seq: number) => `mt:snap:${code}:${seq}`;

export function snapshotOf(r: Room, seq: number): SpecSnap | null {
  const m = r.mj;
  if (!m) return null;
  return {
    seq, hand: m.hand, phase: m.phase, turn: m.turn, dealer: m.dealer, order: [...m.order],
    hands: structuredClone(m.hands), melds: structuredClone(m.melds), discards: structuredClone(m.discards),
    dq: { ...m.dq }, exchange: structuredClone(m.exchange), wallCount: m.wall.length, last: m.last ? { ...m.last } : null,
    winners: m.winners.map((w) => ({ pid: w.pid, method: w.method, from: w.from, tile: w.tile, value: w.value })), exDir: m.exDir,
  };
}

export function emit(r: Room, e: Omit<SpecEvent, "seq" | "id" | "game" | "hand" | "ts">) {
  if (!r.teaching || !r.mj) return;
  const seq = (r.feedSeq || 0) + 1;
  r.feedSeq = seq;
  const ev: SpecEvent = { seq, id: `${r.code}:${seq}`, game: r.code, hand: r.mj.hand, ts: Date.now(), ...e };
  r.feed = [...(r.feed || []), ev].slice(-FEED_MAX);
  const snap = snapshotOf(r, seq);
  if (snap) (r._snaps ||= []).push(snap);
}

export async function saveSnaps(code: string, snaps: SpecSnap[]) {
  await Promise.all(snaps.map((s) => kv.set(snapKey(code, s.seq), JSON.stringify(s), SNAP_TTL)));
}
export async function loadSnap(code: string, seq: number): Promise<SpecSnap | null> {
  const raw = await kv.get(snapKey(code, seq));
  return raw ? (JSON.parse(raw) as SpecSnap) : null;
}
