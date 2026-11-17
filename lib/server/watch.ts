import "server-only";
import crypto from "crypto";
import { kv } from "./kv";
import { HttpError, authPid, classRoomsKey, cleanName, cookieName, getRoom, mutate, normCode, uid, cleanAvatar } from "./room";
import { validClassCode } from "./match";
import { FEED_MAX, loadSnap, snapshotOf } from "./feed";
import { displayName } from "../names";
import type { Room } from "../types";
import type { Discussion, GameSummary, Group, Groups, Practice, QRef, Question, Session, SpecView, Viewer } from "../watch/types";
import { classify } from "../watch/topics";
import { recommendGroups } from "../watch/groups";
import { SCENARIOS, scenarioOrder } from "../watch/scenarios";

/**
 * Mahjong Together 4.0 — Spectator Mode (server). Completely separate from Player Mode:
 *  - Spectators authenticate with their own httpOnly session cookie (mt_w_<CLASS>); they are never room members, so
 *    every player-only action (/api/rooms/.../action) rejects them (401).
 *  - The all-hands educational projection is built here only, only for rooms in classroom teaching mode, and is
 *    refused to anyone holding a player session for that game (no hidden-hand leaks to active players).
 *  - Spectator questions, +1, groups and practice live under their own keys; players' responses never include them.
 *  - All shared documents are updated with the store's atomic compare-and-set (no lost +1 under concurrency).
 */
const TTL = 60 * 60 * 24;
const ONLINE_MS = 15_000;
const classKey = (c: string) => `mt:class:${c}`;
const specKey = (c: string) => `mt:class:${c}:spec`;
const specPresKey = (c: string) => `mt:class:${c}:specp`;
const discKey = (s: string) => `mt:obs:${s}`;
const groupsKey = (s: string) => `mt:obs:${s}:groups`;
const pracKey = (g: string) => `mt:prac:${g}`;
export const watchCookie = (c: string) => `mt_w_${c}`;
const sha = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

export interface ClassDoc { v: number; code: string; featured: string | null; teachingRooms: string[]; sessions: Record<string, Session> }

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
  if (!c) throw new HttpError(404, "We couldn't find that classroom. Check your code and try again.");
  return c;
}
const emptyClass = (code: string): ClassDoc => ({ v: 0, code, featured: null, teachingRooms: [], sessions: {} });
export const getClass = async (c: string) => (await readDoc<ClassDoc>(classKey(c))) || emptyClass(c);

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

const summary = (r: Room, cls: ClassDoc): GameSummary => ({
  code: r.code, name: r.name, status: r.status, players: r.players.map((p) => ({ name: displayName(p.name), avatar: p.avatar, kind: p.kind })),
  hand: r.mj?.hand ?? null, teaching: !!r.teaching, featured: cls.featured === r.code, classroom: r.classroom, createdAt: r.createdAt,
});

/** Live teaching games a spectator may choose from. */
async function teachingGames(c: string, cls: ClassDoc) {
  const rooms = await Promise.all(cls.teachingRooms.map((code) => getRoom(code)));
  return rooms.filter((r): r is Room => !!r && r.teaching?.classroom === c && r.status !== "complete");
}

function onlineCount(pres: Record<string, string>) {
  const now = Date.now();
  return Object.values(pres).filter((t) => now - Number(t) < ONLINE_MS).length;
}

export interface WatchParams { game?: string | null; rv: number; fs: number; dv: number; gv: number; pv: number; pc: number }

/** One spectator poll. Sends only what changed since the client's versions. */
export async function watchState(c: string, me: SpecRec, p: WatchParams, readCookie: (n: string) => string | undefined) {
  const [cls, pres] = await Promise.all([getClass(c), kv.hgetall(specPresKey(c))]);
  if (Date.now() - Number(pres[me.id] || 0) > 4000) await kv.hset(specPresKey(c), me.id, String(Date.now()), TTL); // cheap presence
  pres[me.id] = String(Date.now());
  const base = { me: { id: me.id, name: me.name, avatar: me.avatar } as Viewer, classroom: c, watching: onlineCount(pres) };

  // which game? featured first; otherwise the viewer's explicit choice among live teaching games
  let game = cls.featured;
  if (!game) {
    const games = await teachingGames(c, cls);
    if (p.game && games.some((g) => g.code === p.game)) game = p.game;
    else if (games.length === 1) game = games[0].code;
    else if (games.length > 1) return { ...base, mode: "select" as const, games: games.map((g) => summary(g, cls)) };
    else {
      // a just-finished featured game keeps its summary available
      const ended = Object.values(cls.sessions).sort((a, b) => b.startedAt - a.startedAt)[0];
      if (!ended) return { ...base, mode: "waiting" as const };
      game = ended.game;
    }
  }
  const room = await getRoom(game);
  const session = cls.sessions[game] || null;
  if (room) assertNotPlayer(room, readCookie);
  const mode = !room || !room.teaching ? (session ? "summary" : "waiting") : session?.status === "ended" || room.status === "complete" ? "summary" : "live";

  const [disc, groups, specs] = await Promise.all([
    session ? readDoc<Discussion>(discKey(session.id)) : null,
    session ? readDoc<Groups>(groupsKey(session.id)) : null,
    Object.keys(pres).length !== p.pc ? specMap(c) : null,
  ]);
  const d = disc || { v: 0, questions: [] };
  const people = specs || (d.v !== p.dv || (groups?.v ?? 0) !== p.gv ? await specMap(c) : null);
  const myGroupId = groups?.assign[me.id];
  let practice: unknown = undefined;
  if (myGroupId) {
    const pr = await readDoc<Practice>(pracKey(myGroupId));
    if (pr && pr.v !== p.pv) practice = redactPractice(pr, me.id);
  }
  return {
    ...base, mode, game, featured: cls.featured === game, session,
    view: room && room.teaching && room.v !== p.rv ? spectatorView(room, p.fs) : undefined,
    disc: d.v !== p.dv ? d : undefined,
    groups: groups && groups.v !== p.gv ? groups : undefined,
    practice,
    people: people ? Object.fromEntries(Object.values(people).map((s) => [s.id, { id: s.id, name: s.name, avatar: s.avatar }])) : undefined,
    pc: Object.keys(pres).length,
  };
}

export async function snapshotFor(c: string, game: string, seq: number, readCookie: (n: string) => string | undefined) {
  const room = await getRoom(game);
  if (!room || room.teaching?.classroom !== c) throw new HttpError(404, "This game isn't available for spectating.");
  assertNotPlayer(room, readCookie);
  const ev = (room.feed || []).find((e) => e.seq === seq);
  const snap = ev ? await loadSnap(game, seq) : null;
  if (!ev || !snap) throw new HttpError(404, "This move is no longer available for replay.");
  return { event: ev, snap };
}

// ---------------------------------------------------------------- discussion
const ACTS = ["ask", "reply", "same", "group-accept", "group-decline", "general-join", "group-leave", "prac-answer", "prac-reveal", "prac-next", "prac-chat", "prac-emoji"];
const lastPost = new Map<string, number>(); // best-effort per-instance spam guard; the document check below is authoritative
function liveSession(cls: ClassDoc, game: string) {
  const s = cls.sessions[game];
  if (!s || s.status !== "live") throw new HttpError(409, "The observation session has ended. Questions are closed.");
  return s;
}
const cleanText = (t: unknown, max: number) => String(t ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export async function spectatorAct(c: string, me: SpecRec, a: Record<string, unknown>, readCookie: (n: string) => string | undefined) {
  const cls = await getClass(c);
  const game = String(a.game || cls.featured || "");
  const type = String(a.type);
  if (!ACTS.includes(type)) throw new HttpError(400, "Unknown action"); // spectators have no game actions at all
  if (["ask", "reply", "same"].includes(type)) {
    const room = await getRoom(game);
    if (!room || room.teaching?.classroom !== c) throw new HttpError(404, "This game isn't available for spectating.");
    assertNotPlayer(room, readCookie);
    const s = liveSession(cls, game);
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
  return groupAct(c, cls, game, me, type, a);
}

// ---------------------------------------------------------------- groups & practice
const sessionFor = (cls: ClassDoc, game: string) => {
  const s = cls.sessions[game];
  if (!s) throw new HttpError(409, "There is no observation session yet.");
  return s;
};
const acceptedOf = (g: Group) => g.members.filter((m) => g.status[m] === "accepted");

async function groupAct(c: string, cls: ClassDoc, game: string, me: SpecRec, type: string, a: Record<string, unknown>) {
  const s = sessionFor(cls, game);
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

// ---------------------------------------------------------------- host (classroom organizer)
const HOST_KEY = process.env.CLASSROOM_HOST_KEY || (process.env.NODE_ENV !== "production" ? "teach-cogs123" : "");
export const hostCookieName = "mt_host";
const hostToken = () => crypto.createHmac("sha256", HOST_KEY).update("mahjong-together-host-v1").digest("base64url");
export function hostLogin(key: unknown) {
  if (!HOST_KEY) throw new HttpError(503, "Host controls aren't configured. Set CLASSROOM_HOST_KEY on the server.");
  const a = Buffer.from(sha(String(key ?? ""))), b = Buffer.from(sha(HOST_KEY));
  if (!crypto.timingSafeEqual(a, b)) throw new HttpError(403, "That host key isn't correct.");
  return hostToken();
}
export function requireHost(cookie: string | undefined) {
  if (!HOST_KEY || !cookie) throw new HttpError(401, "Host sign-in required.");
  const a = Buffer.from(cookie), b = Buffer.from(hostToken());
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new HttpError(401, "Host sign-in required.");
}

export async function hostState(c: string) {
  const cls = await getClass(c);
  const idx = await kv.hgetall(classRoomsKey(c));
  const codes = [...new Set([...Object.keys(idx), ...cls.teachingRooms])];
  const rooms = (await Promise.all(codes.map((x) => getRoom(x)))).filter((r): r is Room => !!r).sort((a, b) => b.createdAt - a.createdAt);
  const s = cls.featured ? cls.sessions[cls.featured] : null;
  const [disc, groups, pres] = await Promise.all([s ? readDoc<Discussion>(discKey(s.id)) : null, s ? readDoc<Groups>(groupsKey(s.id)) : null, kv.hgetall(specPresKey(c))]);
  const topics: Record<string, number> = {};
  for (const q of disc?.questions || []) topics[q.topic] = (topics[q.topic] || 0) + q.same.length;
  return {
    classroom: c, featured: cls.featured, session: s, games: rooms.filter((r) => r.status !== "complete").map((r) => summary(r, cls)),
    stats: { watching: onlineCount(pres), viewers: Object.keys(pres).length, questions: disc?.questions.length || 0, replies: (disc?.questions || []).reduce((n, q) => n + q.replies.length, 0), topics,
      groups: groups?.groups.length || 0, accepted: Object.keys(groups?.assign || {}).length, computedAt: groups?.computedAt ?? null },
  };
}

export async function hostAct(c: string, a: Record<string, unknown>) {
  const type = String(a.type);
  if (type === "feature") {
    const code = normCode(String(a.room || ""));
    if (!code) throw new HttpError(400, "Enter a game room code like MAH-AB12.");
    const room = await getRoom(code);
    if (!room) throw new HttpError(404, "That game room wasn't found.");
    if (room.status === "complete") throw new HttpError(409, "That game has already finished.");
    if (room.teaching && room.teaching.classroom !== c) throw new HttpError(409, "That game is a teaching game in another classroom.");
    if (!room.teaching) {
      // Disclosure before play: teaching mode can only be enabled before the first hand is dealt.
      if (room.mj) throw new HttpError(409, "This game has already started. Enable teaching mode before the first hand, so the players are told first.");
      await mutate(code, (r) => {
        if (r.mj) throw new HttpError(409, "This game has already started. Enable teaching mode before the first hand, so the players are told first.");
        r.teaching = { classroom: c, since: Date.now() };
      });
    }
    await casDoc<ClassDoc, void>(classKey(c), () => emptyClass(c), (d) => {
      d.featured = code;
      if (!d.teachingRooms.includes(code)) d.teachingRooms.push(code);
      if (!d.sessions[code] || d.sessions[code].status === "ended") d.sessions[code] = { id: `o-${uid()}`, game: code, status: "live", startedAt: Date.now() };
    });
  } else if (type === "unfeature") {
    await casDoc<ClassDoc, void>(classKey(c), () => emptyClass(c), (d) => { d.featured = null; });
  } else if (type === "start-session" || type === "end-session") {
    await casDoc<ClassDoc, void>(classKey(c), () => emptyClass(c), (d) => {
      if (!d.featured) throw new HttpError(409, "Select a featured teaching game first.");
      const cur = d.sessions[d.featured];
      if (type === "start-session") { if (!cur || cur.status === "ended") d.sessions[d.featured] = { id: `o-${uid()}`, game: d.featured, status: "live", startedAt: Date.now() }; }
      else if (cur && cur.status === "live") d.sessions[d.featured] = { ...cur, status: "ended", endedAt: Date.now() };
    });
    if (type === "end-session") await recommend(c); // the summary shows recommendations straight away
  } else if (type === "recommend") {
    await recommend(c);
  } else throw new HttpError(400, "Unknown action");
  return hostState(c);
}

/** Compute (or refresh) learning-group recommendations from REAL public questions and +1s. Groups that already have
 *  an accepted member are kept as they are; everyone else is re-matched. */
async function recommend(c: string) {
  const cls = await getClass(c);
  const s = cls.featured ? cls.sessions[cls.featured] : null;
  if (!s) throw new HttpError(409, "There is no observation session yet.");
  const disc = (await readDoc<Discussion>(discKey(s.id))) || { v: 0, questions: [] };
  const viewers = Object.keys(await specMap(c));
  await casDoc<Groups, void>(groupsKey(s.id), () => ({ v: 0, computedAt: null, groups: [], assign: {} }), (d) => {
    const keep = d.groups.filter((g) => g.kind === "general" || acceptedOf(g).length);
    const placed = new Set(keep.flatMap((g) => g.members.filter((m) => g.status[m] !== "declined")));
    const fresh = recommendGroups(disc, viewers.filter((v) => !placed.has(v)), Date.now(), () => `g-${uid()}`);
    d.groups = [...keep, ...fresh];
    d.computedAt = Date.now();
  });
}
export { FEED_MAX };
