import "server-only";
import crypto from "crypto";
import { kv } from "./kv";
import { REACTION_IDS, type Check, type Msg, type Player, type PublicPlayer, type PublicRoom, type ReactionId, type Room, type VariantId } from "../types";
import {
  VARIANTS, breakInstruction, fill, firstStep, nextStep, stepById, stepImage, variantById, visibleSteps, type Step,
} from "../variants";
import { entryForStage } from "../mahjong/intent-matcher";
import { applyGameAction, initGame } from "./game";
import { displayName } from "../names";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const TTL = 60 * 60 * 24; // rooms live 24h
const MAX_MSGS = 160;
export const roomKey = (c: string) => `mt:room:${c}`;
export const presenceKey = (c: string) => `mt:room:${c}:presence`;
export const privKey = (c: string, pid: string) => `mt:room:${c}:priv:${pid}`;
export const cookieName = (c: string) => `mt_${c}`;

const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const rand = (n: number) => Array.from(crypto.randomBytes(n), (b) => ALPHA[b % ALPHA.length]).join("");
export const normCode = (c: string) => {
  const s = String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = s.startsWith("MAH") ? s.slice(3) : s;
  return body.length === 4 ? `MAH-${body}` : "";
};
const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");
export const uid = () => crypto.randomBytes(6).toString("hex");
export const cleanName = (s: unknown, max = 24) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export function msg(m: Omit<Msg, "id" | "ts">): Msg {
  return { id: uid(), ts: Date.now(), ...m };
}
export function push(room: Room, ...ms: Msg[]) {
  room.messages.push(...ms);
  if (room.messages.length > MAX_MSGS) room.messages = room.messages.slice(-MAX_MSGS);
}
export const nameOf = (room: Room, pid: string) => displayName(room.players.find((p) => p.id === pid)?.name);

export async function getRoom(code: string): Promise<Room | null> {
  const raw = await kv.get(roomKey(code));
  return raw ? (JSON.parse(raw) as Room) : null;
}

export async function mutate(code: string, fn: (r: Room) => void): Promise<Room> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const cur = await getRoom(code);
    if (!cur) throw new HttpError(404, "Room not found");
    const next: Room = structuredClone(cur);
    fn(next);
    next.v = cur.v + 1;
    if (await kv.cas(roomKey(code), cur.v, JSON.stringify(next), TTL)) return next;
    await new Promise((r) => setTimeout(r, 20 + Math.random() * 60));
  }
  throw new HttpError(409, "The room is busy. Please try again.");
}

export const AVATARS = ["smile", "cool", "happy", "nerd", "cheer", "calm", "cat", "bear"] as const;
export const cleanAvatar = (a: unknown) => (AVATARS as readonly string[]).includes(String(a)) ? String(a) : AVATARS[0];
/** Virtual demo seats. Always labelled "AI Player" in the UI; never presented as real people. */
export const AI_NAMES = ["Esme", "Xinyi", "Xintong", "Frank"];
/** Fixed emoji avatar per demo seat (same everywhere in the app). */
export const AI_AVATAR: Record<string, string> = { Xinyi: "heart", Xintong: "dog", Frank: "bear", Esme: "happy" };

function baseRoom(code: string, hostId: string, name: string, players: Player[], text: string): Room {
  return {
    v: 1, code, name, createdAt: Date.now(), hostId, flow: "s3", lobbyReady: {},
    players, status: "lobby", variant: "sichuan", votes: {}, stepId: null, resp: {}, check: null, decisions: {}, dice: {},
    dealerId: null, breakRoll: null, finish: null, reflections: {},
    messages: [msg({ sender: "system", text })], lastSummaryTs: 0,
  };
}

/** Private room (Join a Room → Create a Private Room). */
export async function createRoom(hostName: string, roomName: string, avatar?: string) {
  const token = crypto.randomBytes(24).toString("base64url");
  const pid = uid();
  for (let i = 0; i < 6; i++) {
    const code = `MAH-${rand(4)}`;
    const room = baseRoom(code, pid, roomName || "Sichuan Table",
      [{ id: pid, name: hostName, seat: 0, joinedAt: Date.now(), tokenHash: hash(token), kind: "human", avatar: cleanAvatar(avatar) }],
      `${hostName} created the room.`);
    if (await kv.cas(roomKey(code), -1, JSON.stringify(room), TTL)) return { room, pid, token };
  }
  throw new HttpError(500, "Could not allocate a room code");
}

/** Assign distinct AI demo identities that don't collide with anyone already seated. */
export function addVirtualSeats(r: Room, count: number) {
  const used = new Set(r.players.map((p) => p.name.toLowerCase()));
  const pool = AI_NAMES.filter((n) => !used.has(n.toLowerCase()));
  for (let i = 0; i < count && r.players.length < 4 && pool.length; i++) {
    const seats = new Set(r.players.map((p) => p.seat));
    const seat = [0, 1, 2, 3].find((x) => !seats.has(x))!;
    const name = pool.shift()!;
    r.players.push({ id: `ai-${uid()}`, name, seat, joinedAt: Date.now(), kind: "virtual", avatar: AI_AVATAR[name] });
  }
  r.players.sort((a, b) => a.seat - b.seat);
}

/** Random Match: one room for 1–4 humans; empty seats become labelled AI demo seats. Written atomically (must not exist). */
export async function createMatchedRoom(humans: { name: string; avatar?: string }[]) {
  if (!humans.length || humans.length > 4) throw new HttpError(500, "Invalid match size");
  const creds = humans.map(() => ({ pid: uid(), token: crypto.randomBytes(24).toString("base64url") }));
  const taken = new Set<string>();
  const players: Player[] = humans.map((h, i) => {
    let name = h.name;
    for (let k = 2; taken.has(name.toLowerCase()); k++) name = `${h.name} ${k}`; // never two seats with one name
    taken.add(name.toLowerCase());
    return { id: creds[i].pid, name, seat: i, joinedAt: Date.now(), tokenHash: hash(creds[i].token), kind: "human", avatar: cleanAvatar(h.avatar) };
  });
  for (let i = 0; i < 6; i++) {
    const code = `MAH-${rand(4)}`;
    const room = baseRoom(code, creds[0].pid, "Sichuan Table", players.map((p) => ({ ...p })), "Matched a table of four.");
    room.matched = true;
    addVirtualSeats(room, 4 - humans.length);
    autoVirtual(room);
    if (await kv.cas(roomKey(code), -1, JSON.stringify(room), TTL)) return { room, creds };
  }
  throw new HttpError(500, "Could not allocate a room code");
}

export function authPid(room: Room, cookie: string | undefined): string | null {
  if (!cookie) return null;
  const [pid, token] = cookie.split(".");
  if (!pid || !token) return null;
  const p = room.players.find((x) => x.id === pid);
  if (!p?.tokenHash) return null;
  const a = Buffer.from(p.tokenHash);
  const b = Buffer.from(hash(token));
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? pid : null;
}

export function joinPlayer(room: Room, name: string, avatar?: string) {
  if (room.status === "complete") throw new HttpError(409, "This room has ended.");
  if (room.players.length >= 4) throw new HttpError(409, "This room is full.");
  const token = crypto.randomBytes(24).toString("base64url");
  const pid = uid();
  const used = new Set(room.players.map((p) => p.seat));
  const seat = [0, 1, 2, 3].find((s) => !used.has(s))!;
  room.players.push({ id: pid, name, seat, joinedAt: Date.now(), tokenHash: hash(token), kind: "human", avatar: cleanAvatar(avatar) });
  room.players.sort((a, b) => a.seat - b.seat);
  push(room, msg({ sender: "system", text: room.status === "lobby" ? `${name} joined the room.` : `${name} took the open seat.` }));
  return { pid, token };
}

// ---------- presence ----------
export async function touch(code: string, pid: string) {
  await kv.hset(presenceKey(code), pid, String(Date.now()), TTL);
}
export async function presenceMap(code: string) {
  return kv.hgetall(presenceKey(code));
}
export function presenceOf(pres: Record<string, string>, pid: string): PublicPlayer["presence"] {
  const t = Number(pres[pid] || 0);
  const age = Date.now() - t;
  return age < 8000 ? "online" : age < 45000 ? "reconnecting" : "offline";
}
export function publicRoom(room: Room, pres: Record<string, string>): PublicRoom {
  return { ...room, players: room.players.map(({ tokenHash: _t, ...p }) => ({ ...p, presence: p.kind === "virtual" ? "online" : presenceOf(pres, p.id) })) };
}

// ---------- group engine ----------
const ids = (r: Room) => r.players.map((p) => p.id);
const allAnswered = (r: Room, rec: Record<string, unknown>) => r.players.length === 4 && ids(r).every((id) => rec[id] !== undefined);

function newCheck(adhoc: boolean, topic: string, topicId?: string): Check {
  return { round: 1, resp: {}, needs: [], adhoc, topic, topicId };
}
function stepNumber(r: Room, s: Step) {
  return visibleSteps(s.variant, r.decisions).findIndex((x) => x.id === s.id) + 1;
}

export function enterStep(r: Room, s: Step) {
  r.stepId = s.id;
  r.stepVersion = (r.stepVersion || 0) + 1;
  r.resp = {};
  r.viewing = {};
  if (s.kind === "dice-dealer") { r.dice = {}; delete r.decisions.dealerContenders; }
  if (s.kind === "dice-break") r.breakRoll = null;
  if (s.id === "sc-exchange" && !r.decisions.exchangeDir) {
    // One shared, random direction for the whole table (shown to everyone; never switched silently).
    r.decisions.exchangeDir = ["clockwise", "counterclockwise", "across"][crypto.randomInt(3)];
  }
  // Tutorial UX 2.0: ONE shared confirmation per step. No separate "does everyone understand" round.
  r.check = null;
  const total = visibleSteps(s.variant, r.decisions).length;
  // The step itself is shown as one shared, live-updating card; the chat only gets a compact marker.
  push(r, msg({ sender: "system", text: `Step ${stepNumber(r, s)} of ${total} · ${s.title}` }));
}

function advance(r: Room) {
  const s = stepById(r.stepId);
  if (!s) return;
  const n = s.kind === "begin" ? null : nextStep(s, r.decisions);
  if (!n) {
    r.status = "playing";
    initGame(r);
    r.stepId = null;
    r.resp = {};
    r.check = null;
    push(r, msg({ sender: "system", text: "Everyone is ready. Game in progress." }), msg({
      sender: "ai", aiMode: "demo", title: "Game in Progress",
      text: "You're ready to play! Continue with your physical Mahjong tiles. I'll be here whenever your group needs help.",
    }));
    return;
  }
  enterStep(r, n);
}

function resolveCheckIfDone(r: Room) {
  const c = r.check;
  if (!c || !allAnswered(r, c.resp) || !ids(r).every((id) => c.resp[id] === "yes")) return;
  r.check = null;
  push(r, msg({ sender: "system", text: c.round > 1 ? "Everyone understands now." : "Everyone understands." }));
  const s = stepById(r.stepId);
  if (r.status === "setup" && s?.kind === "review") advance(r);
}

/** Called after the AI explains something publicly: open a fresh understanding round if anyone needed help. */
/** After a public explanation. Tutorial steps are never reset by explanations; an understanding check exists
 *  only during play (started explicitly), and a fresh round opens only if someone asked for help in it. */
export function afterExplanation(r: Room, summary: boolean, topicId?: string, topicTitle?: string) {
  const inPlay = r.status === "playing" || r.status === "hand_review";
  if (!inPlay) return;
  if (r.check && r.check.needs.length) {
    r.check = { ...r.check, round: r.check.round + 1, resp: {}, needs: [], topicId: topicId || r.check.topicId };
  } else if (!r.check && summary) {
    r.check = newCheck(true, topicTitle || "Your group's questions", topicId);
  }
}

export function applyAction(r: Room, pid: string, a: { type: string; [k: string]: unknown }, pres: Record<string, string>) {
  applyActionInner(r, pid, a, pres);
  autoVirtual(r);
}

const isVirtual = (r: Room, id: string) => r.players.find((p) => p.id === id)?.kind === "virtual";

/**
 * Staggered demo responses (seconds after a confirmation opens). Deterministic so tests are reproducible; columns
 * follow the demo seat names; never longer than 5 seconds; a different pattern for every step / context.
 */
const DELAY_ORDER = ["Xinyi", "Xintong", "Frank", "Esme"];
const DELAYS: Record<string, number[]> = {
  lobby: [1, 3, 2, 5],
  "sc-tiles": [2, 3, 1, 5],
  "sc-wall": [3, 2, 5, 1],
  "sc-exchange": [1, 5, 2, 3],
  "sc-dingque": [5, 1, 3, 2],
  end: [2, 1, 3, 5],
  event: [3, 1, 5, 2],
  final: [1, 3, 2, 5],
};
function delayFor(r: Room, ctx: string, botId: string) {
  const row = DELAYS[ctx] || DELAYS.event;
  const name = r.players.find((p) => p.id === botId)?.name || "";
  const i = Math.max(0, DELAY_ORDER.indexOf(name));
  return Math.min(5, row[i]) * 1000;
}

/** Earliest pending demo response time, or null (used by polling to apply due responses). */
export function nextVirtualDue(r: Room): number | null {
  let min: number | null = null;
  for (const plan of Object.values(r.aiPlans || {})) for (const t of Object.values(plan)) if (min === null || t < min) min = t;
  return min;
}

/**
 * Server-side demo logic for AI seats. They only ever give software acknowledgements (ready, demo votes,
 * simulated verification) — never physical tile actions, wins, kongs or scores. Every simulated approval is
 * recorded so the UI can label it. Each confirmation context gets a deterministic schedule when it opens
 * (stored in the room, so refreshes/polls/duplicate requests never restart it); a seat acts at most once per
 * context, only when its time is due, and stale plans for finished contexts are discarded.
 */
export function autoVirtual(r: Room, now = Date.now()) {
  const bots = r.players.filter((p) => p.kind === "virtual").map((p) => p.id);
  if (!bots.length || r.flow !== "s3") return;
  const humans = r.players.filter((p) => p.kind !== "virtual").map((p) => p.id);
  for (let guard = 0; guard < 16; guard++) {
    const snap = () => JSON.stringify([r.status, r.stepId, r.stepVersion, r.lobbyReady, r.resp, r.endProposal, r.finalReview, r.nextDealerVotes, (r.events || []).map((e) => [e.id, e.rev, e.status, e.approvals])]);
    const v0 = snap();
    const plans: Record<string, Record<string, number>> = r.aiPlans || {};
    const active = new Set<string>();
    // Ensure a plan for a context (created when first seen = when it opened); return true if `b` is due now.
    const due = (key: string, ctx: string, b: string, pending: boolean) => {
      active.add(key);
      if (!plans[key]) plans[key] = Object.fromEntries(bots.map((id) => [id, now + delayFor(r, ctx, id)]));
      if (!pending) { delete plans[key][b]; return false; }
      const t = plans[key][b];
      if (t === undefined || t > now) return false;
      delete plans[key][b]; // acts at most once per context
      return true;
    };
    for (const b of bots) {
      const run = (a: { type: string; [k: string]: unknown }) => { try { applyActionInner(r, b, a, {}); } catch { /* demo seat action not applicable */ } };
      if (r.status === "lobby" && due("lobby", "lobby", b, !r.lobbyReady?.[b])) run({ type: "lobby-ready" });
      if (r.status === "setup" && r.stepId && due(`step:${r.stepId}:${r.stepVersion}`, r.stepId, b, r.resp[b] !== "ready")) {
        // Demo seats pick a valid missing suit (varied by seat) when the step requires a choice.
        const suit = r.stepId === "sc-dingque" ? (["b", "d", "c"] as const)[(r.players.find((p) => p.id === b)?.seat ?? 0) % 3] : undefined;
        run({ type: "respond", stepId: r.stepId, value: "ready", suit });
      }
      if (r.endProposal && due(`end:${r.endProposal.id}`, "end", b, !r.endProposal.votes[b])) run({ type: "end-vote", proposalId: r.endProposal.id, value: "agree" });
      for (const e of (r.events || []).filter((x) => x.status === "pending")) {
        if (!due(`ev:${e.id}:${e.rev}`, "event", b, e.approvals[b] !== "confirm")) continue;
        e.simulated = [...new Set([...(e.simulated || []), b])];
        run({ type: "event-respond", eventId: e.id, rev: e.rev, value: "confirm" });
      }
      if (r.status === "session_review" && r.finalReview && due(`final:${r.finalReview.ledgerVersion}`, "final", b, !r.finalReview.resp[b]))
        run({ type: "final-respond", ledgerVersion: r.ledgerVersion || 0, value: "confirm" });
      if (r.status === "hand_review" && !r.nextDealerVotes?.[b]) {
        const humanVote = humans.map((h) => r.nextDealerVotes?.[h]).find(Boolean); // follow a real player's choice
        if (humanVote) run({ type: "next-dealer", dealerId: humanVote });
      }
    }
    // Drop plans for contexts that have finished (a late, obsolete response is never applied) and empty plans.
    for (const k of Object.keys(plans)) if (!active.has(k) || !Object.keys(plans[k]).length) delete plans[k];
    r.aiPlans = plans;
    if (v0 === snap()) return;
  }
}

function applyActionInner(r: Room, pid: string, a: { type: string; [k: string]: unknown }, pres: Record<string, string>) {
  const me = nameOf(r, pid);
  const isHost = r.hostId === pid;
  const step = stepById(r.stepId);
  if (r.status === "complete" && a.type !== "reflect" && a.type !== "react") throw new HttpError(409, "This session has ended.");
  // After the group agreed to end, play is stopped: only chat, reactions, reconciliation and final review remain.
  const STOPPED_OK = ["message", "react", "event-respond", "event-revise", "event-submit", "final-respond", "final-review-start", "finish-cancel", "remove"];
  if ((r.status === "reconciling" || (r.status === "session_review" && r.endedEarly)) && !STOPPED_OK.includes(String(a.type)))
    throw new HttpError(409, "The game has stopped. Finish reviewing the scores.");

  switch (a.type) {
    case "message": {
      const text = cleanName(a.text, 1000);
      if (!text) throw new HttpError(400, "Empty message");
      push(r, msg({ sender: pid, name: me, text }));
      return;
    }
    case "lobby-ready": {
      if (r.status !== "lobby") return; // already started — no-op
      r.lobbyReady = { ...(r.lobbyReady || {}), [pid]: true };
      if (r.players.length === 4 && ids(r).every((id) => r.lobbyReady![id])) {
        r.variant = "sichuan";
        r.status = "setup";
        push(r, msg({ sender: "system", text: "Everyone's ready." }));
        enterStep(r, firstStep("sichuan"));
      }
      return;
    }
    case "lobby-unready": {
      if (r.status !== "lobby" || isVirtual(r, pid)) return;
      if (r.lobbyReady) delete r.lobbyReady[pid];
      return;
    }
    case "start": {
      if (r.flow === "s3") throw new HttpError(409, "Everyone taps I'm Ready to start.");
      if (!isHost) throw new HttpError(403, "Only the host can start.");
      if (r.status !== "lobby") return;
      if (r.players.length < 4) throw new HttpError(409, "Four players are needed to start.");
      r.status = "variant";
      push(r, msg({
        sender: "ai", aiMode: "demo", title: "Welcome to Mahjong Together!",
        text: "I'm the Mahjong Rule Assistant. I can help explain common Mahjong rules, setup steps, and differences between variants, and I'll guide your group one step at a time.\n\nFirst, which Mahjong variant would your group like to learn?",
      }));
      return;
    }
    case "vote": {
      if (r.status !== "variant") throw new HttpError(409, "Voting is closed.");
      const v = String(a.variant) as VariantId;
      if (!variantById(v)) throw new HttpError(400, "Unknown variant");
      r.votes[pid] = v;
      if (!allAnswered(r, r.votes)) return;
      const vals = ids(r).map((id) => r.votes[id]);
      if (vals.every((x) => x === vals[0])) {
        const vv = variantById(vals[0])!;
        r.variant = vv.id;
        r.status = "setup";
        push(r, msg({ sender: "ai", aiMode: "demo", title: "Everyone Has Agreed!", text: `Your group has selected ${vv.name}. We'll follow the ${vv.rulesetName}.` }));
        enterStep(r, firstStep(vv.id));
      } else {
        const key = "v:" + vals.join(",");
        if (r.decisions.__lastDisagree === key) return;
        r.decisions.__lastDisagree = key;
        const counts = VARIANTS.map((x) => ({ x, n: vals.filter((y) => y === x.id).length })).filter((c) => c.n).sort((p, q) => q.n - p.n);
        const parts = counts.map((c) => `${c.n === 1 ? "one player" : `${c.n} players`} selected ${c.x.name}`);
        const sentence = parts.join(parts.length > 2 ? ", " : " and ");
        push(r, msg({
          sender: "ai", aiMode: "demo", title: "Different Preferences Detected",
          text: `${sentence.charAt(0).toUpperCase() + sentence.slice(1)}.\n\nPlease discuss your preferences and make a shared choice.\n\n${counts.map((c) => `• ${c.x.name}: ${c.x.intro}`).join("\n")}`,
        }));
      }
      return;
    }
    case "check-start": {
      if (r.status !== "playing" && r.status !== "hand_review") throw new HttpError(409, "Understanding checks are available during play. Tutorial steps use their own single confirmation.");
      if (r.check) return;
      const lastTopic = [...r.messages].reverse().find((m) => m.sender === "ai" && m.topicId)?.topicId;
      r.check = newCheck(true, step?.title || "Our discussion", step ? entryForStage(step.id)?.id || lastTopic : lastTopic);
      push(r, msg({ sender: "system", text: `${me} asked the group: does everyone understand?` }));
      return;
    }
    case "check": {
      if (!r.check) throw new HttpError(409, "No understanding check is active.");
      const val = a.value === "yes" ? "yes" : "no";
      r.check.resp[pid] = val;
      if (val === "no") {
        if (!r.check.needs.includes(pid)) {
          r.check.needs.push(pid);
          push(r, msg({ sender: "ai", aiMode: "demo", title: "Let's Clarify This Together", text: `No problem, ${me}. Which part would you like to review? Ask another question below, or choose Explain More Simply or Show an Example.` }));
        }
      } else {
        r.check.needs = r.check.needs.filter((x) => x !== pid);
      }
      resolveCheckIfDone(r);
      return;
    }
    case "respond": {
      if (r.status !== "setup" || !step) return; // step already finished (e.g. a late duplicate) — no-op
      // Confirmations belong to one step: a late tap for a previous step never counts toward the next one.
      if (a.stepId !== undefined && a.stepId !== r.stepId) return;
      if (step.kind === "dice-break" && !r.breakRoll) throw new HttpError(409, "Enter the dice first.");
      let val = String(a.value);
      if (step.kind === "consensus") {
        if (!step.options!.some((o) => o.id === val)) throw new HttpError(400, "Invalid option");
      } else {
        if (val === "done") val = "ready";
        if (val !== "ready") throw new HttpError(400, "Invalid response");
        if (r.resp[pid] === "ready") return; // repeated taps / retries: no duplicate confirmation
        if (step.id === "sc-dingque") {
          // Each player's own choice: saved with their single confirmation, locked afterwards.
          const suit = a.suit !== undefined ? String(a.suit) : r.dingQue?.[pid];
          if (suit !== "c" && suit !== "b" && suit !== "d") throw new HttpError(400, "Choose your missing suit first.");
          r.dingQue = { ...(r.dingQue || {}), [pid]: suit };
        }
      }
      r.resp[pid] = val;
      if (r.viewing) delete r.viewing[pid];
      if (!allAnswered(r, r.resp)) return;
      const vals = ids(r).map((id) => r.resp[id]);
      if (step.kind === "consensus") {
        let decided: string | null = null;
        if (step.veto && vals.includes("no")) decided = "no";
        else if (vals.every((x) => x === vals[0])) decided = vals[0];
        if (!decided) {
          const key = step.id + ":" + vals.join(",");
          if (r.decisions.__lastDisagree !== key) {
            r.decisions.__lastDisagree = key;
            push(r, msg({ sender: "ai", aiMode: "demo", title: "Agreement Needed", text: "Your group has different preferences. Let's discuss before moving forward. Share your reasons in the chat, then change your choice if you like." }));
          }
          return;
        }
        r.decisions[step.decisionKey!] = decided;
        const label = step.options!.find((o) => o.id === decided)!.label;
        const text =
          step.decisionKey === "exchange" ? (decided === "yes" ? "Your group has agreed to include Exchange Three Tiles." : "Your group has agreed to skip Exchange Three Tiles. Next: Ding Que.")
          : step.veto && decided === "no" ? `At least one player chose No, so your group will skip this. (Under these rules any player may stop it.)`
          : `Your group has agreed: ${label}.`;
        push(r, msg({ sender: "ai", aiMode: "demo", text }));
        advance(r);
      } else if (vals.every((x) => x === "ready")) {
        push(r, msg({ sender: "system", text: step.kind === "begin" ? "All 4 players are ready." : `All 4 players completed: ${step.title}.` }));
        advance(r);
      }
      return;
    }
    case "dingque-pick": {
      // Pre-selection (kept across refresh) — not a confirmation. Locked once the player has confirmed.
      if (r.status !== "setup" || r.stepId !== "sc-dingque" || a.stepId !== r.stepId) return;
      if (r.resp[pid] === "ready") return;
      const suit = String(a.suit);
      if (suit !== "c" && suit !== "b" && suit !== "d") throw new HttpError(400, "Unknown suit");
      r.dingQue = { ...(r.dingQue || {}), [pid]: suit };
      return;
    }
    case "step-help": {
      // Informational status only; it never changes anyone's confirmation.
      if (r.status !== "setup" || !step || a.stepId !== r.stepId) return;
      r.viewing = { ...(r.viewing || {}) };
      if (a.open) r.viewing[pid] = true;
      else delete r.viewing[pid];
      return;
    }
    case "dice": {
      if (r.status !== "setup" || step?.kind !== "dice-dealer") throw new HttpError(409, "Not a dice step.");
      const n = Math.round(Number(a.value));
      if (!(n >= 2 && n <= 12)) throw new HttpError(400, "Enter a total from 2 to 12.");
      const contenders = r.decisions.dealerContenders ? r.decisions.dealerContenders.split(",") : ids(r);
      if (!contenders.includes(pid)) throw new HttpError(409, "Only tied players re-roll.");
      r.dice[pid] = n;
      if (!contenders.every((id) => r.dice[id] !== undefined)) return;
      const max = Math.max(...contenders.map((id) => r.dice[id]));
      const top = contenders.filter((id) => r.dice[id] === max);
      if (top.length > 1) {
        r.decisions.dealerContenders = top.join(",");
        top.forEach((id) => delete r.dice[id]);
        push(r, msg({ sender: "ai", aiMode: "demo", text: `${top.map((id) => nameOf(r, id)).join(" and ")} tied with ${max}. Tied players, please roll again and enter your new total.` }));
        return;
      }
      r.dealerId = top[0];
      delete r.decisions.dealerContenders;
      const lines = ids(r).filter((id) => r.dice[id] !== undefined).map((id) => `${nameOf(r, id)}: ${r.dice[id]}`).join("\n");
      push(r, msg({ sender: "ai", aiMode: "demo", text: `${lines}\n\n${nameOf(r, top[0])} has the highest total and will be the dealer under this ruleset.` }));
      advance(r);
      return;
    }
    case "break": {
      if (r.status !== "setup" || step?.kind !== "dice-break") throw new HttpError(409, "Not a dice step.");
      if (r.dealerId && r.dealerId !== pid) throw new HttpError(403, `Only the dealer (${nameOf(r, r.dealerId)}) enters this roll.`);
      const d1 = Math.round(Number(a.d1));
      const d2 = Math.round(Number(a.d2));
      if (!(d1 >= 1 && d1 <= 6 && d2 >= 1 && d2 <= 6)) throw new HttpError(400, "Each die is 1–6.");
      r.breakRoll = { d1, d2, by: pid };
      r.resp = {};
      const dealerName = r.dealerId ? nameOf(r, r.dealerId) : "the dealer";
      push(r, msg({ sender: "ai", aiMode: "demo", title: `Dice: ${d1} + ${d2}`, text: breakInstruction(step.breakMethod!, d1, d2, dealerName), source: step.source }));
      return;
    }
    case "react": {
      // Tapback-style reaction: one reaction per player per message; same reaction again or null removes it.
      const m = r.messages.find((x) => x.id === a.msgId);
      if (!m) throw new HttpError(404, "Message not found");
      // Reactions are for human messages only — never the Rule Assistant, system notes, or panels.
      if (!r.players.some((p) => p.id === m.sender) && !m.name) throw new HttpError(400, "Only messages from players can receive reactions.");
      if (m.sender === "ai" || m.sender === "system") throw new HttpError(400, "Only messages from players can receive reactions.");
      const val = a.reaction === null ? null : String(a.reaction);
      if (val !== null && !REACTION_IDS.includes(val as ReactionId)) throw new HttpError(400, "Unknown reaction");
      const next = { ...(m.reactions || {}) };
      if (val === null || next[pid] === val) delete next[pid];
      else next[pid] = val as ReactionId;
      m.reactions = next;
      return;
    }
    case "reflect": {
      r.reflections[pid] = cleanName(a.text, 600);
      return;
    }
    case "remove": {
      if (!isHost) throw new HttpError(403, "Only the host can free a seat.");
      const target = String(a.target);
      if (target === r.hostId || !r.players.some((p) => p.id === target)) throw new HttpError(400, "Invalid player");
      if (r.status !== "lobby" && presenceOf(pres, target) !== "offline") throw new HttpError(409, "You can only free the seat of a player who is offline.");
      const name = nameOf(r, target);
      r.players = r.players.filter((p) => p.id !== target);
      delete r.votes[target]; delete r.resp[target]; delete r.dice[target]; if (r.lobbyReady) delete r.lobbyReady[target];
      if (r.check) { delete r.check.resp[target]; r.check.needs = r.check.needs.filter((x) => x !== target); }
      push(r, msg({ sender: "system", text: `${name}'s seat is now open. A new player can join with the room code.` }));
      return;
    }
    default:
      if (applyGameAction(r, pid, a)) return;
      throw new HttpError(400, "Unknown action");
  }
}
