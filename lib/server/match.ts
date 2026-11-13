import "server-only";
import crypto from "crypto";
import { kv } from "./kv";
import { HttpError, cleanAvatar, cleanName, createMatchedRoom, getRoom, roomKey, uid } from "./room";

/**
 * Random Match: one server-side FIFO queue, updated only through the store's atomic compare-and-set.
 * - Full four-human tables are formed first, as soon as four people are waiting.
 * - Only after the oldest waiting person has waited DEMO_MATCH_TIMEOUT_MS are the remaining 1–3 people seated
 *   together with clearly labelled AI demo seats. A room never has zero humans or more than four seats.
 * - Each entry is assigned exactly once; a person refreshing keeps the same entry (httpOnly cookie).
 */

const QKEY = "mt:match:queue";
const QTTL = 60 * 60;
const STALE_MS = 8_000; // a waiting entry whose page stopped polling (closed tab) is dropped quickly; pages poll every 1s
const KEEP_ASSIGNED_MS = 10 * 60_000;
export const MATCH_TIMEOUT_MS = Math.max(1000, Math.min(120_000, Number(process.env.DEMO_MATCH_TIMEOUT_MS) || 10_000));
export const QUEUE_COOKIE = "mt_q";

interface Entry {
  id: string;
  sh: string; // sha256 of the entry secret
  name: string;
  avatar: string;
  at: number;
  seen: number;
  room?: string;
  pid?: string;
  token?: string; // room credential, server-side only, delivered through an httpOnly cookie
  matchedAt?: number;
}
interface Queue { v: number; entries: Entry[] }

const sha = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

async function load(): Promise<Queue | null> {
  const raw = await kv.get(QKEY);
  return raw ? (JSON.parse(raw) as Queue) : null;
}

async function update<T>(fn: (q: Queue) => T): Promise<T> {
  for (let i = 0; i < 10; i++) {
    const cur = await load();
    const q: Queue = cur ? structuredClone(cur) : { v: 0, entries: [] };
    const out = fn(q);
    q.v = (cur?.v ?? 0) + 1;
    if (await kv.cas(QKEY, cur ? cur.v : -1, JSON.stringify(q), QTTL)) return out;
    await new Promise((r) => setTimeout(r, 15 + Math.random() * 50));
  }
  throw new HttpError(409, "Matching is busy. Please try again.");
}

export function authEntry(q: Queue | null, cookie: string | undefined): Entry | null {
  if (!q || !cookie) return null;
  const [id, secret] = cookie.split(".");
  const e = q.entries.find((x) => x.id === id);
  if (!e || !secret) return null;
  const a = Buffer.from(e.sh), b = Buffer.from(sha(secret));
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? e : null;
}

function prune(q: Queue, now: number) {
  q.entries = q.entries.filter((e) => (e.room ? now - (e.matchedAt || 0) < KEEP_ASSIGNED_MS : now - e.seen < STALE_MS));
}

/** Plan groups: as many full human tables as possible, then (after the timeout) one table for the remainder. */
function plan(q: Queue, now: number): Entry[][] {
  const waiting = q.entries.filter((e) => !e.room).sort((a, b) => a.at - b.at);
  const groups: Entry[][] = [];
  while (waiting.length >= 4) groups.push(waiting.splice(0, 4));
  if (waiting.length && now - waiting[0].at >= MATCH_TIMEOUT_MS) groups.push(waiting.splice(0, waiting.length));
  return groups;
}

/** Form any tables that are due. Rooms are written first (unique code); the queue assignment is then committed
 *  atomically. If another request changed the queue meanwhile, the unused rooms are deleted and we retry. */
export async function processQueue() {
  for (let attempt = 0; attempt < 6; attempt++) {
    const cur = await load();
    if (!cur) return;
    const now = Date.now();
    const draft = structuredClone(cur);
    prune(draft, now);
    const groups = plan(draft, now);
    if (!groups.length) {
      if (draft.entries.length !== cur.entries.length) await kv.cas(QKEY, cur.v, JSON.stringify({ ...draft, v: cur.v + 1 }), QTTL);
      return;
    }
    const made = [];
    for (const g of groups) made.push({ g, ...(await createMatchedRoom(g.map((e) => ({ name: e.name, avatar: e.avatar })))) });
    for (const m of made)
      m.g.forEach((e, i) => {
        const d = draft.entries.find((x) => x.id === e.id)!;
        Object.assign(d, { room: m.room.code, pid: m.creds[i].pid, token: m.creds[i].token, matchedAt: now });
      });
    if (await kv.cas(QKEY, cur.v, JSON.stringify({ ...draft, v: cur.v + 1 }), QTTL)) return;
    for (const m of made) await kv.del(roomKey(m.room.code)); // lost the race: nobody was assigned to these rooms
  }
}

export type MatchStatus =
  | { status: "none" }
  | { status: "waiting"; filled: number; waitedMs: number; timeoutMs: number; members: { name: string; avatar: string; me: boolean }[] }
  | { status: "matched"; code: string; pid: string; token: string };

export function statusOf(q: Queue | null, e: Entry | null): MatchStatus {
  if (!q || !e) return { status: "none" };
  if (e.room && e.pid && e.token) return { status: "matched", code: e.room, pid: e.pid, token: e.token };
  const waiting = q.entries.filter((x) => !x.room).sort((a, b) => a.at - b.at);
  const p = Math.max(0, waiting.findIndex((x) => x.id === e.id));
  const start = p - (p % 4);
  const group = waiting.slice(start, start + 4); // the real people currently forming this table (FIFO)
  return {
    status: "waiting", filled: group.length, waitedMs: Date.now() - waiting[start].at, timeoutMs: MATCH_TIMEOUT_MS,
    members: group.map((x) => ({ name: x.name, avatar: x.avatar, me: x.id === e.id })),
  };
}

/** Join the queue, or resume the caller's existing entry (refresh / second tab never duplicates). */
export async function enqueue(cookie: string | undefined, rawName: unknown, rawAvatar: unknown) {
  const name = cleanName(rawName);
  if (!name) throw new HttpError(400, "Enter a name to continue.");
  const existing = authEntry(await load(), cookie);
  if (existing?.room) {
    const room = await getRoom(existing.room);
    if (room && room.status !== "complete") return { cookie: null as string | null }; // already seated: resume that room
  }
  const secret = crypto.randomBytes(18).toString("base64url");
  const id = uid();
  const fresh = await update((q) => {
    const now = Date.now();
    prune(q, now);
    const mine = authEntry(q, cookie);
    if (mine && !mine.room) { mine.seen = now; mine.name = name; mine.avatar = cleanAvatar(rawAvatar); return false; }
    if (mine?.room) q.entries = q.entries.filter((x) => x.id !== mine.id); // finished game: start a new search
    q.entries.push({ id, sh: sha(secret), name, avatar: cleanAvatar(rawAvatar), at: now, seen: now });
    return true;
  });
  return { cookie: fresh ? `${id}.${secret}` : null };
}

/** Poll: refresh liveness, form due tables, report this caller's status. */
export async function poll(cookie: string | undefined): Promise<MatchStatus> {
  const q0 = await load();
  const e0 = authEntry(q0, cookie);
  if (!e0) return { status: "none" };
  if (!e0.room) await update((q) => { const e = q.entries.find((x) => x.id === e0.id); if (e) e.seen = Date.now(); });
  await processQueue();
  const q = await load();
  return statusOf(q, authEntry(q, cookie));
}

/** Cancel: removes a waiting entry. If the table was formed at the same moment, the match stands (no double assignment). */
export async function cancel(cookie: string | undefined): Promise<MatchStatus> {
  return update((q) => {
    const e = authEntry(q, cookie);
    if (!e) return { status: "none" } as MatchStatus;
    if (e.room) return statusOf(q, e);
    q.entries = q.entries.filter((x) => x.id !== e.id);
    return { status: "none" } as MatchStatus;
  });
}
