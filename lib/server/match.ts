import "server-only";
import crypto from "crypto";
import { kv } from "./kv";
import { HttpError, cleanAvatar, cleanName, createMatchedRoom, getRoom, roomKey, uid } from "./room";

/**
 * Random Match: server-side FIFO queues, updated only through the store's atomic compare-and-set.
 * - Full four-human tables are always formed first, as soon as four people are waiting.
 * - "default" queue (Random Match on one device / solo demo): after the oldest waiting person has waited
 *   DEMO_MATCH_TIMEOUT_MS, the remaining 1–3 people are seated with clearly labelled demo seats.
 * - "class" queue (the shared classroom QR code): NEVER fills seats automatically. Only after a waiting person has
 *   waited CLASS_MATCH_WINDOW_MS may that group explicitly choose to complete its table with demo seats.
 * - Each entry is assigned exactly once; a person refreshing keeps the same entry (httpOnly cookie per queue).
 * A room never has zero humans or more than four seats.
 */

const QTTL = 60 * 60;
const KEEP_ASSIGNED_MS = 10 * 60_000;
export const MATCH_TIMEOUT_MS = Math.max(1000, Math.min(120_000, Number(process.env.DEMO_MATCH_TIMEOUT_MS) || 10_000));
export const CLASS_WINDOW_MS = Math.max(5000, Math.min(600_000, Number(process.env.CLASS_MATCH_WINDOW_MS) || 45_000));

export type QueueName = "default" | "class";
interface QueueCfg { name: QueueName; key: string; cookie: string; autoFillMs: number | null; fillAfterMs: number | null; staleMs: number }
const QUEUES: Record<QueueName, QueueCfg> = {
  // pages poll every 1s; a closed tab drops out quickly
  default: { name: "default", key: "mt:match:queue", cookie: "mt_q", autoFillMs: MATCH_TIMEOUT_MS, fillAfterMs: null, staleMs: 8_000 },
  // classroom phones may briefly switch apps (camera, lock screen): keep their place a little longer
  class: { name: "class", key: "mt:match:queue:class", cookie: "mt_q_class", autoFillMs: null, fillAfterMs: CLASS_WINDOW_MS, staleMs: 45_000 },
};
export const queueName = (raw: unknown): QueueName => (raw === "class" ? "class" : "default");
export const queueCookie = (q: QueueName) => QUEUES[q].cookie;
// Every function below receives its queue config explicitly (no shared mutable state between concurrent requests).

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
  fill?: boolean; // class queue: this person asked to complete their table with demo seats
}
interface Queue { v: number; entries: Entry[] }

const sha = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

async function load(CFG: QueueCfg): Promise<Queue | null> {
  const raw = await kv.get(CFG.key);
  return raw ? (JSON.parse(raw) as Queue) : null;
}

async function update<T>(CFG: QueueCfg, fn: (q: Queue) => T): Promise<T> {
  for (let i = 0; i < 10; i++) {
    const cur = await load(CFG);
    const q: Queue = cur ? structuredClone(cur) : { v: 0, entries: [] };
    const out = fn(q);
    q.v = (cur?.v ?? 0) + 1;
    if (await kv.cas(CFG.key, cur ? cur.v : -1, JSON.stringify(q), QTTL)) return out;
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

function prune(CFG: QueueCfg, q: Queue, now: number) {
  q.entries = q.entries.filter((e) => (e.room ? now - (e.matchedAt || 0) < KEEP_ASSIGNED_MS : now - e.seen < CFG.staleMs));
}

/** Plan groups: as many full human tables as possible (human-first), then the remainder only if allowed:
 *  default queue → after the demo timeout; class queue → only when someone in it explicitly asked to fill. */
function plan(CFG: QueueCfg, q: Queue, now: number): Entry[][] {
  const waiting = q.entries.filter((e) => !e.room).sort((a, b) => a.at - b.at);
  const groups: Entry[][] = [];
  while (waiting.length >= 4) groups.push(waiting.splice(0, 4));
  if (!waiting.length) return groups;
  if (CFG.autoFillMs !== null && now - waiting[0].at >= CFG.autoFillMs) groups.push(waiting.splice(0, waiting.length));
  else if (CFG.autoFillMs === null && waiting.some((e) => e.fill)) groups.push(waiting.splice(0, waiting.length));
  return groups;
}

/** Form any tables that are due. Rooms are written first (unique code); the queue assignment is then committed
 *  atomically. If another request changed the queue meanwhile, the unused rooms are deleted and we retry. */
async function processQueue(CFG: QueueCfg) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const cur = await load(CFG);
    if (!cur) return;
    const now = Date.now();
    const draft = structuredClone(cur);
    prune(CFG, draft, now);
    const groups = plan(CFG, draft, now);
    if (!groups.length) {
      if (draft.entries.length !== cur.entries.length) await kv.cas(CFG.key, cur.v, JSON.stringify({ ...draft, v: cur.v + 1 }), QTTL);
      return;
    }
    const made = [];
    for (const g of groups) made.push({ g, ...(await createMatchedRoom(g.map((e) => ({ name: e.name, avatar: e.avatar })))) });
    for (const m of made)
      m.g.forEach((e, i) => {
        const d = draft.entries.find((x) => x.id === e.id)!;
        Object.assign(d, { room: m.room.code, pid: m.creds[i].pid, token: m.creds[i].token, matchedAt: now });
      });
    if (await kv.cas(CFG.key, cur.v, JSON.stringify({ ...draft, v: cur.v + 1 }), QTTL)) return;
    for (const m of made) await kv.del(roomKey(m.room.code)); // lost the race: nobody was assigned to these rooms
  }
}

export type MatchStatus =
  | { status: "none" }
  | { status: "waiting"; filled: number; waitedMs: number; timeoutMs: number; members: { name: string; avatar: string; me: boolean }[]; queue: QueueName; canFill: boolean; fillAfterMs: number | null; myWaitMs: number }
  | { status: "matched"; code: string; pid: string; token: string };

function statusOf(CFG: QueueCfg, q: Queue | null, e: Entry | null): MatchStatus {
  if (!q || !e) return { status: "none" };
  if (e.room && e.pid && e.token) return { status: "matched", code: e.room, pid: e.pid, token: e.token };
  const waiting = q.entries.filter((x) => !x.room).sort((a, b) => a.at - b.at);
  const p = Math.max(0, waiting.findIndex((x) => x.id === e.id));
  const start = p - (p % 4);
  const group = waiting.slice(start, start + 4); // the real people currently forming this table (FIFO)
  const myWaitMs = Date.now() - e.at;
  return {
    status: "waiting", filled: group.length, waitedMs: Date.now() - waiting[start].at, timeoutMs: CFG.autoFillMs ?? 0,
    members: group.map((x) => ({ name: x.name, avatar: x.avatar, me: x.id === e.id })),
    queue: CFG.name,
    canFill: CFG.fillAfterMs !== null && group.length < 4 && myWaitMs >= CFG.fillAfterMs,
    fillAfterMs: CFG.fillAfterMs, myWaitMs,
  };
}

/** Join the queue, or resume the caller's existing entry (refresh / second tab never duplicates). */
export async function enqueue(qn: QueueName, cookie: string | undefined, rawName: unknown, rawAvatar: unknown) {
  const CFG = QUEUES[qn];
  const name = cleanName(rawName);
  if (!name) throw new HttpError(400, "Enter a name to continue.");
  const existing = authEntry(await load(CFG), cookie);
  if (existing?.room) {
    const room = await getRoom(existing.room);
    if (room && room.status !== "complete") return { cookie: null as string | null }; // already seated: resume that room
  }
  const secret = crypto.randomBytes(18).toString("base64url");
  const id = uid();
  const fresh = await update(CFG, (q) => {
    const now = Date.now();
    prune(CFG, q, now);
    const mine = authEntry(q, cookie);
    if (mine && !mine.room) { mine.seen = now; mine.name = name; mine.avatar = cleanAvatar(rawAvatar); return false; }
    if (mine?.room) q.entries = q.entries.filter((x) => x.id !== mine.id); // finished game: start a new search
    q.entries.push({ id, sh: sha(secret), name, avatar: cleanAvatar(rawAvatar), at: now, seen: now });
    return true;
  });
  return { cookie: fresh ? `${id}.${secret}` : null };
}

/** Poll: refresh liveness, form due tables, report this caller's status. */
export async function poll(qn: QueueName, cookie: string | undefined): Promise<MatchStatus> {
  const CFG = QUEUES[qn];
  const q0 = await load(CFG);
  const e0 = authEntry(q0, cookie);
  if (!e0) return { status: "none" };
  if (!e0.room) await update(CFG, (q) => { const e = q.entries.find((x) => x.id === e0.id); if (e) e.seen = Date.now(); });
  await processQueue(CFG);
  const q = await load(CFG);
  return statusOf(CFG, q, authEntry(q, cookie));
}

/** Cancel: removes a waiting entry. If the table was formed at the same moment, the match stands (no double assignment). */
export async function cancel(qn: QueueName, cookie: string | undefined): Promise<MatchStatus> {
  const CFG = QUEUES[qn];
  return update(CFG, (q) => {
    const e = authEntry(q, cookie);
    if (!e) return { status: "none" } as MatchStatus;
    if (e.room) return statusOf(CFG, q, e);
    q.entries = q.entries.filter((x) => x.id !== e.id);
    return { status: "none" } as MatchStatus;
  });
}

/** Class queue only: after the waiting window, a person may choose to complete THEIR group with demo seats.
 *  Server-enforced (window + group size); the table is then formed atomically by the normal queue process. */
export async function requestFill(qn: QueueName, cookie: string | undefined): Promise<MatchStatus> {
  const CFG = QUEUES[qn];
  if (CFG.fillAfterMs === null) throw new HttpError(400, "This queue fills automatically.");
  await update(CFG, (q) => {
    const e = authEntry(q, cookie);
    if (!e || e.room) return;
    if (Date.now() - e.at < CFG.fillAfterMs!) throw new HttpError(409, "Still looking for classmates. Try again in a moment.");
    e.fill = true;
    e.seen = Date.now();
  });
  await processQueue(CFG);
  const q = await load(CFG);
  return statusOf(CFG, q, authEntry(q, cookie));
}
