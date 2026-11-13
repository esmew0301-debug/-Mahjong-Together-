import "server-only";
import crypto from "crypto";
import { kv } from "./kv";
import { HttpError, cleanAvatar, cleanName, createMatchedRoom, getRoom, roomKey, uid } from "./room";

/**
 * Random Match: server-side FIFO queues, updated only through the store's atomic compare-and-set.
 * - Human-first: four waiting humans always form a room immediately (no demo seats).
 * - Shared deadline: a waiting group's deadline is its OLDEST member's join time + the queue's window. At the deadline,
 *   every human still waiting is seated together in ONE room and only the empty seats get demo participants — never
 *   one demo-filled room per person. A person arriving after a room was formed starts the next group.
 * - "default" queue (Match on This Device / solo demo): window DEMO_MATCH_TIMEOUT_MS (default 10s).
 * - "class" queue (the shared classroom QR code): window CLASS_MATCH_WINDOW_MS (default 25s). Fully automatic.
 * - Each entry is assigned exactly once; a person refreshing keeps the same entry (httpOnly cookie per queue), so a
 *   refresh never restarts the deadline. A room never has zero humans or more than four seats.
 * Every function receives its queue config explicitly (no shared mutable state between concurrent requests).
 */

const QTTL = 60 * 60;
const KEEP_ASSIGNED_MS = 10 * 60_000;
export const MATCH_TIMEOUT_MS = Math.max(1000, Math.min(120_000, Number(process.env.DEMO_MATCH_TIMEOUT_MS) || 10_000));
export const CLASS_WINDOW_MS = Math.max(3000, Math.min(600_000, Number(process.env.CLASS_MATCH_WINDOW_MS) || 25_000));

export type QueueName = "default" | "class";
interface QueueCfg { name: QueueName; key: string; cookie: string; windowMs: number; staleMs: number }
const QUEUES: Record<QueueName, QueueCfg> = {
  // pages poll every 1s; a closed tab drops out quickly
  default: { name: "default", key: "mt:match:queue", cookie: "mt_q", windowMs: MATCH_TIMEOUT_MS, staleMs: 8_000 },
  // classroom phones may briefly switch apps (camera, lock screen): keep their place a little longer
  class: { name: "class", key: "mt:match:queue:class", cookie: "mt_q_class", windowMs: CLASS_WINDOW_MS, staleMs: 45_000 },
};
export const queueName = (raw: unknown): QueueName => (raw === "class" ? "class" : "default");
export const queueCookie = (q: QueueName) => QUEUES[q].cookie;

interface Entry {
  id: string;
  sh: string; // sha256 of the entry secret
  name: string;
  avatar: string;
  at: number; // join time (kept on refresh → the shared deadline never restarts)
  seen: number;
  room?: string;
  pid?: string;
  token?: string; // room credential, server-side only, delivered through an httpOnly cookie
  matchedAt?: number;
}
interface Queue { v: number; entries: Entry[] }

const sha = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

async function load(c: QueueCfg): Promise<Queue | null> {
  const raw = await kv.get(c.key);
  return raw ? (JSON.parse(raw) as Queue) : null;
}

async function update<T>(c: QueueCfg, fn: (q: Queue) => T): Promise<T> {
  for (let i = 0; i < 10; i++) {
    const cur = await load(c);
    const q: Queue = cur ? structuredClone(cur) : { v: 0, entries: [] };
    const out = fn(q);
    q.v = (cur?.v ?? 0) + 1;
    if (await kv.cas(c.key, cur ? cur.v : -1, JSON.stringify(q), QTTL)) return out;
    await new Promise((r) => setTimeout(r, 15 + Math.random() * 50));
  }
  throw new HttpError(409, "Matching is busy. Please try again.");
}

function authEntry(q: Queue | null, cookie: string | undefined): Entry | null {
  if (!q || !cookie) return null;
  const [id, secret] = cookie.split(".");
  const e = q.entries.find((x) => x.id === id);
  if (!e || !secret) return null;
  const a = Buffer.from(e.sh), b = Buffer.from(sha(secret));
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? e : null;
}

function prune(c: QueueCfg, q: Queue, now: number) {
  q.entries = q.entries.filter((e) => (e.room ? now - (e.matchedAt || 0) < KEEP_ASSIGNED_MS : now - e.seen < c.staleMs));
}

/** As many full four-human tables as possible first; then, once the shared deadline (oldest waiting member's join
 *  time + window) has passed, ALL remaining waiting humans (1–3) form ONE group whose empty seats get demo seats. */
function plan(c: QueueCfg, q: Queue, now: number): Entry[][] {
  const waiting = q.entries.filter((e) => !e.room).sort((a, b) => a.at - b.at);
  const groups: Entry[][] = [];
  while (waiting.length >= 4) groups.push(waiting.splice(0, 4));
  if (waiting.length && now - waiting[0].at >= c.windowMs) groups.push(waiting.splice(0, waiting.length));
  return groups;
}

/** Form any tables that are due, re-reading the current queue each attempt. Rooms are written first (unique code);
 *  the seat assignment is then committed atomically. If another request changed the queue meanwhile (e.g. a new
 *  arrival at the deadline), the unused rooms are deleted and the plan is recomputed from fresh state. */
async function processQueue(c: QueueCfg) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const cur = await load(c);
    if (!cur) return;
    const now = Date.now();
    const draft = structuredClone(cur);
    prune(c, draft, now);
    const groups = plan(c, draft, now);
    if (!groups.length) {
      if (draft.entries.length !== cur.entries.length) await kv.cas(c.key, cur.v, JSON.stringify({ ...draft, v: cur.v + 1 }), QTTL);
      return;
    }
    const made = [];
    for (const g of groups) made.push({ g, ...(await createMatchedRoom(g.map((e) => ({ name: e.name, avatar: e.avatar })))) });
    for (const m of made)
      m.g.forEach((e, i) => {
        const d = draft.entries.find((x) => x.id === e.id)!;
        Object.assign(d, { room: m.room.code, pid: m.creds[i].pid, token: m.creds[i].token, matchedAt: now });
      });
    if (await kv.cas(c.key, cur.v, JSON.stringify({ ...draft, v: cur.v + 1 }), QTTL)) return;
    for (const m of made) await kv.del(roomKey(m.room.code)); // lost the race: nobody was assigned to these rooms
  }
}

export type MatchStatus =
  | { status: "none" }
  | {
      status: "waiting"; filled: number; waitedMs: number; timeoutMs: number; members: { name: string; avatar: string; me: boolean }[];
      queue: QueueName; deadlineInMs: number;
    }
  | { status: "matched"; code: string; pid: string; token: string };

function statusOf(c: QueueCfg, q: Queue | null, e: Entry | null): MatchStatus {
  if (!q || !e) return { status: "none" };
  if (e.room && e.pid && e.token) return { status: "matched", code: e.room, pid: e.pid, token: e.token };
  const waiting = q.entries.filter((x) => !x.room).sort((a, b) => a.at - b.at);
  const p = Math.max(0, waiting.findIndex((x) => x.id === e.id));
  const start = p - (p % 4);
  const group = waiting.slice(start, start + 4); // the real people currently forming this table (FIFO)
  const waitedMs = Date.now() - waiting[start].at;
  return {
    status: "waiting", filled: group.length, waitedMs, timeoutMs: c.windowMs,
    members: group.map((x) => ({ name: x.name, avatar: x.avatar, me: x.id === e.id })),
    queue: c.name, deadlineInMs: Math.max(0, c.windowMs - waitedMs), // server-authoritative shared deadline
  };
}

/** Join a queue, or resume the caller's existing entry (refresh / second tab / second scan never duplicates). */
export async function enqueue(qn: QueueName, cookie: string | undefined, rawName: unknown, rawAvatar: unknown) {
  const c = QUEUES[qn];
  const name = cleanName(rawName);
  if (!name) throw new HttpError(400, "Enter a name to continue.");
  const existing = authEntry(await load(c), cookie);
  if (existing?.room) {
    const room = await getRoom(existing.room);
    if (room && room.status !== "complete") return { cookie: null as string | null }; // already seated: resume that room
  }
  const secret = crypto.randomBytes(18).toString("base64url");
  const id = uid();
  const fresh = await update(c, (q) => {
    const now = Date.now();
    prune(c, q, now);
    const mine = authEntry(q, cookie);
    if (mine && !mine.room) { mine.seen = now; mine.name = name; mine.avatar = cleanAvatar(rawAvatar); return false; } // keeps `at`
    if (mine?.room) q.entries = q.entries.filter((x) => x.id !== mine.id); // finished game: start a new search
    q.entries.push({ id, sh: sha(secret), name, avatar: cleanAvatar(rawAvatar), at: now, seen: now });
    return true;
  });
  return { cookie: fresh ? `${id}.${secret}` : null };
}

/** Poll: refresh liveness, form due tables, report this caller's status. */
export async function poll(qn: QueueName, cookie: string | undefined): Promise<MatchStatus> {
  const c = QUEUES[qn];
  const q0 = await load(c);
  const e0 = authEntry(q0, cookie);
  if (!e0) return { status: "none" };
  if (!e0.room) await update(c, (q) => { const e = q.entries.find((x) => x.id === e0.id); if (e) e.seen = Date.now(); });
  await processQueue(c);
  const q = await load(c);
  return statusOf(c, q, authEntry(q, cookie));
}

/** Cancel: removes a waiting entry. If the table was formed at the same moment, the match stands (no double assignment). */
export async function cancel(qn: QueueName, cookie: string | undefined): Promise<MatchStatus> {
  const c = QUEUES[qn];
  return update(c, (q) => {
    const e = authEntry(q, cookie);
    if (!e) return { status: "none" } as MatchStatus;
    if (e.room) return statusOf(c, q, e);
    q.entries = q.entries.filter((x) => x.id !== e.id);
    return { status: "none" } as MatchStatus;
  });
}
