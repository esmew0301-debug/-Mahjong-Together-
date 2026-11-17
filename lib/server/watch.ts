import "server-only";
import crypto from "crypto";
import { kv } from "./kv";
import { HttpError, authPid, classRoomsKey, cleanName, cookieName, getRoom, presenceMap, uid, cleanAvatar } from "./room";
import { validClassCode } from "./match";
import { INVALID_CLASSROOM } from "../classroom";
import { loadSnap, snapshotOf } from "./feed";
import { displayName } from "../names";
import type { Room } from "../types";
import type { Discussion, GameSummary, Group, Groups, Practice, QRef, Question, Session, SpecView, Viewer } from "../watch/types";
import { classify } from "../watch/topics";
import { recommendGroups } from "../watch/groups";
import { SCENARIOS, scenarioOrder } from "../watch/scenarios";

/**
 * Mahjong Together 4.0 — Spectator Mode (server). Fully automatic (no host): every room matched in the classroom is a
 * teaching game from creation (disclosed to players before they join), is listed for spectators straight away, gets one
 * discussion session, and learning groups are recommended automatically when a hand / the game ends.
 * Completely separate from Player Mode:
 *  - Spectators authenticate with their own httpOnly session cookie (mt_w_<CLASS>); they are never room members, so
 *    every player-only action (/api/rooms/.../action) rejects them (401).
 *  - The all-hands educational projection is built here only, only for rooms in classroom teaching mode, and is
 *    refused to anyone holding a player session for that game (no hidden-hand leaks to active players).
 *  - Spectator questions, +1, groups and practice live under their own keys; players' responses never include them.
 *  - All shared documents are updated with the store's atomic compare-and-set (no lost +1 under concurrency).
 */
const TTL = 60 * 60 * 24;
const ONLINE_MS = 15_000;
const specKey = (c: string) => `mt:class:${c}:spec`;
const specPresKey = (c: string) => `mt:class:${c}:specp`;
const discKey = (s: string) => `mt:obs:${s}`;
const groupsKey = (s: string) => `mt:obs:${s}:groups`;
const pracKey = (g: string) => `mt:prac:${g}`;
export const watchCookie = (c: string) => `mt_w_${c}`;
const sha = (t: string) => crypto.createHash("sha256").update(t).digest("hex");


// ---------------------------------------------------------------- generic CAS document
async function readDoc<T>(key: string): Promise<T | null> {
  const raw = await kv.get(key);
  return raw ? (JSON.parse(raw) as T) : null;
}
async function casDoc<T extends { v: number }, R>(key: string, init: () => T, fn: (d: T) => R): Promise<{ doc: T; out: R }> {
  for (let i = 0; i < 14; i++) {
    const cur = await readDoc<T>(key);
    const d = cur ? structuredClone(cur) : init();
    const out = fn(d);
    d.v = (cur?.v ?? 0) + 1;
    if (await kv.cas(key, cur ? cur.v : -1, JSON.stringify(d), TTL)) return { doc: d, out };
    await new Promise((r) => setTimeout(r, 10 + Math.random() * 70));
  }
  throw new HttpError(409, "Lots of people are posting right now. Please try again.");
}

export function requireClass(raw: unknown) {
  const c = validClassCode(raw);
  if (!c) throw new HttpError(404, INVALID_CLASSROOM);
  return c;
}

// ---------------------------------------------------------------- spectator sessions
interface SpecRec { id: string; name: string; avatar: string; sh: string; joinedAt: number }
async function specMap(c: string): Promise<Record<string, SpecRec>> {
  const h = await kv.hgetall(specKey(c));
  const o: Record<string, SpecRec> = {};
  for (const [k, v] of Object.entries(h)) { try { o[k] = JSON.parse(v); } catch {} }
  return o;
}
export async function authSpectator(c: string, cookie: string | undefined): Promise<SpecRec | null> {
  if (!cookie) return null;
  const [id, secret] = cookie.split(".");
  if (!id || !secret) return null;
  const raw = (await kv.hgetall(specKey(c)))[id];
  if (!raw) return null;
  const rec = JSON.parse(raw) as SpecRec;
  const a = Buffer.from(rec.sh), b = Buffer.from(sha(secret));
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? rec : null;
}
/** Create (or resume — refresh never duplicates a viewer) a spectator session. Returns a new cookie value if created. */
export async function joinSpectator(c: string, cookie: string | undefined, rawName: unknown, rawAvatar: unknown) {
  const name = cleanName(rawName);
  if (!name) throw new HttpError(400, "Enter a name to continue.");
  const avatar = cleanAvatar(rawAvatar);
  const cur = await authSpectator(c, cookie);
  if (cur) {
    await kv.hset(specKey(c), cur.id, JSON.stringify({ ...cur, name, avatar }), TTL);
    return { id: cur.id, cookie: null as string | null };
  }
  const id = `s-${uid()}`, secret = crypto.randomBytes(18).toString("base64url");
  await kv.hset(specKey(c), id, JSON.stringify({ id, name, avatar, sh: sha(secret), joinedAt: Date.now() } satisfies SpecRec), TTL);
  await kv.hset(specPresKey(c), id, String(Date.now()), TTL);
  return { id, cookie: `${id}.${secret}` };
}
export async function requireSpectator(c: string, cookie: string | undefined) {
  const s = await authSpectator(c, cookie);
  if (!s) throw new HttpError(401, "Create your spectator profile to watch this classroom.");
  return s;
}

/** Players in a teaching game may not open its all-hands projection (prevents hidden-hand leaks to active players). */
export function assertNotPlayer(room: Room, readCookie: (name: string) => string | undefined) {
  if (authPid(room, readCookie(cookieName(room.code))))
    throw new HttpError(403, "You're playing in this game, so you can't watch it as a spectator. Spectator Mode shows every hand.");
}

// ---------------------------------------------------------------- the educational projection
export function spectatorView(room: Room, fs: number): SpecView {
  const feed = room.feed || [];
  const m = room.mj;
  const snap = m ? snapshotOf(room, room.feedSeq || 0) : null;
  const scores: Record<string, number> = Object.fromEntries(room.players.map((p) => [p.id, 0]));
  for (const e of room.ledger || []) { scores[e.from] = (scores[e.from] || 0) - e.amount; scores[e.to] = (scores[e.to] || 0) + e.amount; }
  return {
    game: room.code, roomV: room.v, status: room.status,
    players: room.players.map((p) => ({ id: p.id, name: displayName(p.name), avatar: p.avatar, kind: p.kind, seat: p.seat })),
    live: snap && m ? { ...snap, claims: Object.fromEntries(Object.entries(m.claims).map(([k, v]) => [k, v.opts])), claimUntil: m.claimUntil, endReason: m.endReason } : null,
    feed: feed.filter((e) => e.seq > fs),
    feedMin: feed[0]?.seq ?? 0,
    feedMax: room.feedSeq || 0,
    scores,
  };
}

const summary = (r: Room): GameSummary => ({
  code: r.code, name: r.name, status: r.status === "complete" ? "Completed" : r.mj ? (r.mj.phase === "ended" ? `Playing · Hand ${r.mj.hand} over` : `Playing · Hand ${r.mj.hand}`) : "Waiting to start",
  players: r.players.map((p) => ({ name: displayName(p.name), avatar: p.avatar, kind: p.kind })),
  hand: r.mj?.hand ?? null, teaching: !!r.teaching, featured: false, classroom: r.classroom, createdAt: r.createdAt,
});
/** One discussion session per teaching game; it closes when the game is finished. */
export const sessionOf = (r: Room): Session => ({ id: `o-${r.code}`, game: r.code, status: r.status === "complete" ? "ended" : "live", startedAt: r.createdAt });
/** "The observed game ended": a hand is over, or the whole game is finished (the players may play another hand). */
const gameOver = (r: Room) => r.status === "complete" || r.status === "session_review" || r.mj?.phase === "ended";

const ABANDONED_MS = 120_000;
/** Rooms of this classroom a spectator may watch (newest first). The index lives in shared storage (Redis in
 *  production), written when matching creates the room; the status always comes from the room itself. Finished
 *  games and tables whose human players have all been gone for 2 minutes are not listed. */
async function classGames(c: string, includeDone = false) {
  const idx = await kv.hgetall(classRoomsKey(c));
  const rooms = (await Promise.all(Object.keys(idx).map((code) => getRoom(code)))).filter((r): r is Room => !!r && r.teaching?.classroom === c && (includeDone || r.status !== "complete"));
  const now = Date.now();
  const alive = await Promise.all(rooms.map(async (r) => {
    if (includeDone) return true;
    const pres = await presenceMap(r.code);
    return r.players.some((p) => p.kind !== "virtual" && now - Number(pres[p.id] || 0) < ABANDONED_MS) || now - r.createdAt < ABANDONED_MS;
  }));
  return rooms.filter((_, i) => alive[i]).sort((a, b) => b.createdAt - a.createdAt);
}
async function teachingRoom(c: string, game: string) {
  const room = game ? await getRoom(game) : null;
  if (!room || room.teaching?.classroom !== c) throw new HttpError(404, "This game isn't available for spectating.");
  return room;
}

function onlineCount(pres: Record<string, string>) {
  const now = Date.now();
  return Object.values(pres).filter((t) => now - Number(t) < ONLINE_MS).length;
}

export interface WatchParams { game?: string | null; rv: number; fs: number; dv: number; gv: number; pv: number; pc: number }

/** One spectator poll. Sends only what changed since the client's versions. */
export async function watchState(c: string, me: SpecRec, p: WatchParams, readCookie: (n: string) => string | undefined) {
  const pres = await kv.hgetall(specPresKey(c));
  if (Date.now() - Number(pres[me.id] || 0) > 4000) await kv.hset(specPresKey(c), me.id, String(Date.now()), TTL); // cheap presence
  pres[me.id] = String(Date.now());
  const base = { me: { id: me.id, name: me.name, avatar: me.avatar } as Viewer, classroom: c, watching: onlineCount(pres) };

  // which table? the viewer's explicit choice; otherwise the only live table; otherwise let them choose
  let room: Room | null = null;
  if (p.game) { const r = await getRoom(p.game); if (r && r.teaching?.classroom === c) room = r; }
  if (!room) {
    const games = await classGames(c);
    if (games.length === 1) room = games[0];
    else if (games.length > 1) return { ...base, mode: "select" as const, games: games.map(summary) };
    else return { ...base, mode: "waiting" as const };
  }
  assertNotPlayer(room, readCookie);
  const session = sessionOf(room);
  const mode = !room.mj ? "live" : gameOver(room) ? "summary" : "live";

  let groups = await readDoc<Groups>(groupsKey(session.id));
  if (mode === "summary") {
    const basis = `${room.mj?.hand ?? 0}:${room.status === "complete" ? "done" : "hand"}`;
    if (groups?.basis !== basis) groups = await recommend(c, session.id, basis); // automatic, idempotent per hand end
  }
  const [disc, specs] = await Promise.all([readDoc<Discussion>(discKey(session.id)), Object.keys(pres).length !== p.pc ? specMap(c) : null]);
  const d = disc || { v: 0, questions: [] };
  const people = specs || (d.v !== p.dv || (groups?.v ?? 0) !== p.gv ? await specMap(c) : null);
  const myGroupId = groups?.assign[me.id];
  let practice: unknown = undefined;
  if (myGroupId) {
    const pr = await readDoc<Practice>(pracKey(myGroupId));
    if (pr && pr.v !== p.pv) practice = redactPractice(pr, me.id);
  }
  return {
    ...base, mode, game: room.code, session, gameOver: room.status === "complete",
    tables: (await classGames(c)).length,
    view: room.v !== p.rv ? spectatorView(room, p.fs) : undefined,
    disc: d.v !== p.dv ? d : undefined,
    groups: groups && groups.v !== p.gv ? groups : undefined,
    practice,
    people: people ? Object.fromEntries(Object.values(people).map((s) => [s.id, { id: s.id, name: s.name, avatar: s.avatar }])) : undefined,
    pc: Object.keys(pres).length,
  };
}

/** Table list for "Choose a Table to Watch" (also used to switch tables). */
export async function tableList(c: string) { return (await classGames(c)).map(summary); }

export async function snapshotFor(c: string, game: string, seq: number, readCookie: (n: string) => string | undefined) {
  const room = await teachingRoom(c, game);
  assertNotPlayer(room, readCookie);
  const ev = (room.feed || []).find((e) => e.seq === seq);
  const snap = ev ? await loadSnap(game, seq) : null;
  if (!ev || !snap) throw new HttpError(404, "This move is no longer available for replay.");
  return { event: ev, snap };
}

// ---------------------------------------------------------------- discussion
const ACTS = ["ask", "reply", "same", "group-accept", "group-decline", "general-join", "group-leave", "prac-answer", "prac-reveal", "prac-next", "prac-chat", "prac-emoji"];
const lastPost = new Map<string, number>(); // best-effort per-instance spam guard; the document check below is authoritative
function liveSession(room: Room) {
  const s = sessionOf(room);
  if (s.status !== "live") throw new HttpError(409, "This game has finished. Questions are closed.");
  return s;
}
const cleanText = (t: unknown, max: number) => String(t ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export async function spectatorAct(c: string, me: SpecRec, a: Record<string, unknown>, readCookie: (n: string) => string | undefined) {
  let game = String(a.game || "");
  if (!game) { const live = await classGames(c); if (live.length === 1) game = live[0].code; } // same rule as the poll
  const type = String(a.type);
  if (!ACTS.includes(type)) throw new HttpError(400, "Unknown action"); // spectators have no game actions at all
  if (["ask", "reply", "same"].includes(type)) {
    const room = await teachingRoom(c, game);
    assertNotPlayer(room, readCookie);
    const s = liveSession(room);
    if (type === "ask" || type === "reply") {
      const text = cleanText(a.text, 280);
      if (text.length < 2) throw new HttpError(400, "Type your question first.");
      const k = `${s.id}:${me.id}`;
      if (Date.now() - (lastPost.get(k) || 0) < 1500) throw new HttpError(429, "One moment — you just posted.");
      lastPost.set(k, Date.now());
      if (type === "ask") {
        let ref: QRef | null = null;
        let missingSuit = false;
        if (a.seq !== undefined && a.seq !== null) {
          const ev = (room.feed || []).find((e) => e.seq === Number(a.seq));
          if (!ev) throw new HttpError(404, "This move is no longer available for replay.");
          const actor = room.players.find((pl) => pl.id === ev.actor);
          ref = { seq: ev.seq, game: ev.game, hand: ev.hand, type: ev.type, actor: ev.actor, actorName: actor ? displayName(actor.name) : undefined, actorAvatar: actor?.avatar, actorKind: actor?.kind, tile: ev.tile, text: ev.text, ts: ev.ts, rule: ev.rule };
          missingSuit = ev.rule === "missing-suit";
        }
        const q: Question = { id: `q-${uid()}`, classroom: c, game, session: s.id, ref, author: me.id, text, topic: classify(text, ref ? { ...ref, missingSuit } : null), ts: Date.now(), same: [me.id], replies: [] };
        return (await casDoc<Discussion, Question>(discKey(s.id), () => ({ v: 0, questions: [] }), (d) => {
          const recent = d.questions.filter((x) => x.author === me.id && Date.now() - x.ts < 1500);
          if (recent.length) throw new HttpError(429, "One moment — you just posted.");
          if (d.questions.length >= 400) throw new HttpError(409, "This discussion is full.");
          d.questions.push(q);
          return q;
        })).doc;
      }
      return (await casDoc<Discussion, void>(discKey(s.id), () => ({ v: 0, questions: [] }), (d) => {
        const q = d.questions.find((x) => x.id === a.qid);
        if (!q) throw new HttpError(404, "That question was not found.");
        if (q.replies.length >= 100) throw new HttpError(409, "This thread is full.");
        q.replies.push({ id: `r-${uid()}`, author: me.id, text, ts: Date.now() });
      })).doc;
    }
    // +1 Same Question: set semantics (one membership per viewer; the author is always a member)
    const on = a.on !== false;
    return (await casDoc<Discussion, void>(discKey(s.id), () => ({ v: 0, questions: [] }), (d) => {
      const q = d.questions.find((x) => x.id === a.qid);
      if (!q) throw new HttpError(404, "That question was not found.");
      if (q.author === me.id) return; // the author can't leave their own question
      q.same = on ? (q.same.includes(me.id) ? q.same : [...q.same, me.id]) : q.same.filter((x) => x !== me.id);
    })).doc;
  }
  const room = await teachingRoom(c, game);
  assertNotPlayer(room, readCookie);
  return groupAct(sessionOf(room), me, type, a);
}

// ---------------------------------------------------------------- groups & practice
const acceptedOf = (g: Group) => g.members.filter((m) => g.status[m] === "accepted");

async function groupAct(s: Session, me: SpecRec, type: string, a: Record<string, unknown>) {
  const init = (): Groups => ({ v: 0, computedAt: null, groups: [], assign: {} });
  if (type === "group-accept" || type === "group-decline" || type === "general-join" || type === "group-leave") {
    const { doc, out } = await casDoc<Groups, string | null>(groupsKey(s.id), init, (d) => {
      if (type === "general-join") {
        if (d.assign[me.id]) throw new HttpError(409, "You're already in a practice group.");
        let g = d.groups.find((x) => x.kind === "general" && acceptedOf(x).length < 4);
        if (!g) { g = { id: `g-${uid()}`, kind: "general", members: [], topics: [], status: {}, createdAt: Date.now() }; d.groups.push(g); }
        g.members.push(me.id); g.status[me.id] = "accepted"; d.assign[me.id] = g.id;
        return g.id;
      }
      const g = d.groups.find((x) => x.id === a.gid);
      if (!g || !g.members.includes(me.id)) throw new HttpError(404, "That group invitation was not found.");
      if (type === "group-accept") {
        if (d.assign[me.id] && d.assign[me.id] !== g.id) throw new HttpError(409, "You're already in another practice group. Leave it first.");
        g.status[me.id] = "accepted"; d.assign[me.id] = g.id;
        return g.id;
      }
      // decline / leave
      g.status[me.id] = "declined";
      if (g.kind === "general") { g.members = g.members.filter((m) => m !== me.id); delete g.status[me.id]; }
      if (d.assign[me.id] === g.id) delete d.assign[me.id];
      return null;
    });
    if (out) await casDoc<Practice, void>(pracKey(out), () => ({ v: 0, group: out, idx: 0, stage: "answer", answers: {}, chat: [], round: 1 }), () => {});
    return doc;
  }
  // practice actions: only accepted members of the viewer's own group
  const groups = await readDoc<Groups>(groupsKey(s.id));
  const gid = groups?.assign[me.id];
  const g = groups?.groups.find((x) => x.id === gid);
  if (!g || g.status[me.id] !== "accepted") throw new HttpError(403, "Join a learning group to practice together.");
  const members = acceptedOf(g);
  const order = scenarioOrder(g.topics);
  const { doc } = await casDoc<Practice, void>(pracKey(g.id), () => ({ v: 0, group: g.id, idx: 0, stage: "answer", answers: {}, chat: [], round: 1 }), (pr) => {
    const sc = SCENARIOS[order[pr.idx % order.length]];
    if (type === "prac-answer") {
      if (pr.stage !== "answer") return;
      const choice = String(a.choice);
      if (!sc.options.some((o) => o.id === choice)) throw new HttpError(400, "Choose one of the answers.");
      if (pr.answers[me.id]) return; // first answer stands
      pr.answers[me.id] = choice;
      if (members.every((m) => pr.answers[m])) pr.stage = "reveal";
    } else if (type === "prac-reveal") {
      if (!pr.answers[me.id]) throw new HttpError(409, "Choose your answer first.");
      pr.stage = "reveal";
    } else if (type === "prac-next") {
      if (pr.stage !== "reveal") return;
      if (Number(a.round) !== pr.round) return; // a second tap for the same round never skips a scenario
      pr.idx += 1; pr.stage = "answer"; pr.answers = {}; pr.round += 1;
    } else if (type === "prac-chat" || type === "prac-emoji") {
      const text = type === "prac-emoji" ? String(a.text) : cleanText(a.text, 200);
      if (type === "prac-emoji" && !["👍", "❤️", "😂", "👏", "🤔", "🎉"].includes(text)) throw new HttpError(400, "Unknown reaction");
      if (!text) throw new HttpError(400, "Type a message.");
      const mine = [...pr.chat].reverse().find((x) => x.sid === me.id);
      if (mine && Date.now() - mine.ts < 800) throw new HttpError(429, "One moment — you just sent a message.");
      pr.chat = [...pr.chat, { id: uid(), sid: me.id, kind: (type === "prac-emoji" ? "emoji" : "text") as "emoji" | "text", text, ts: Date.now() }].slice(-80);
    } else throw new HttpError(400, "Unknown action");
  });
  return redactPractice(doc, me.id);
}

/** Before the reveal, nobody sees other learners' choices — only that they have answered. */
export function redactPractice(pr: Practice, me: string) {
  return pr.stage === "reveal" ? { ...pr, answered: Object.keys(pr.answers) } : { ...pr, answers: pr.answers[me] ? { [me]: pr.answers[me] } : {}, answered: Object.keys(pr.answers) };
}

// ---------------------------------------------------------------- automatic learning groups
/** Recommend learning groups from REAL public questions and +1s (runs automatically when a hand / the game ends).
 *  Groups that already have an accepted member are kept as they are; everyone else is re-matched. */
async function recommend(c: string, sessionId: string, basis: string) {
  const disc = (await readDoc<Discussion>(discKey(sessionId))) || { v: 0, questions: [] };
  const viewers = Object.keys(await specMap(c));
  return (await casDoc<Groups, void>(groupsKey(sessionId), () => ({ v: 0, computedAt: null, groups: [], assign: {} }), (d) => {
    if (d.basis === basis) return; // another request already did it
    const keep = d.groups.filter((g) => g.kind === "general" || acceptedOf(g).length);
    const placed = new Set(keep.flatMap((g) => g.members.filter((m) => g.status[m] !== "declined")));
    const fresh = recommendGroups(disc, viewers.filter((v) => !placed.has(v)), Date.now(), () => `g-${uid()}`);
    d.groups = [...keep, ...fresh];
    d.computedAt = Date.now();
    d.basis = basis;
  })).doc;
}
