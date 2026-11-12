import "server-only";
import crypto from "crypto";
import { kv } from "./kv";
import { REACTION_IDS, type Check, type Msg, type PublicPlayer, type PublicRoom, type ReactionId, type Room, type VariantId } from "../types";
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

export async function createRoom(hostName: string, roomName: string) {
  const token = crypto.randomBytes(24).toString("base64url");
  const pid = uid();
  for (let i = 0; i < 6; i++) {
    const code = `MAH-${rand(4)}`;
    const room: Room = {
      v: 1, code, name: roomName || "Mahjong Night", createdAt: Date.now(), hostId: pid,
      players: [{ id: pid, name: hostName, seat: 0, joinedAt: Date.now(), tokenHash: hash(token) }],
      status: "lobby", variant: null, votes: {}, stepId: null, resp: {}, check: null, decisions: {}, dice: {},
      dealerId: null, breakRoll: null, finish: null, reflections: {},
      messages: [msg({ sender: "system", text: `${hostName} created the room.` })],
      lastSummaryTs: 0,
    };
    if (await kv.cas(roomKey(code), -1, JSON.stringify(room), TTL)) return { room, pid, token };
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

export function joinPlayer(room: Room, name: string) {
  if (room.status === "complete") throw new HttpError(409, "This session has ended.");
  if (room.players.length >= 4) throw new HttpError(409, "This room already has four players.");
  const token = crypto.randomBytes(24).toString("base64url");
  const pid = uid();
  const used = new Set(room.players.map((p) => p.seat));
  const seat = [0, 1, 2, 3].find((s) => !used.has(s))!;
  room.players.push({ id: pid, name, seat, joinedAt: Date.now(), tokenHash: hash(token) });
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
  return { ...room, players: room.players.map(({ tokenHash: _t, ...p }) => ({ ...p, presence: presenceOf(pres, p.id) })) };
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
  r.resp = {};
  if (s.kind === "dice-dealer") { r.dice = {}; delete r.decisions.dealerContenders; }
  if (s.kind === "dice-break") r.breakRoll = null;
  r.check = s.understand || s.kind === "review" ? newCheck(false, s.title, entryForStage(s.id)?.id) : null;
  const total = visibleSteps(s.variant, r.decisions).length;
  const dealer = r.dealerId ? nameOf(r, r.dealerId) : null;
  let short = fill(s.short, r.decisions);
  if (dealer && (s.kind === "dice-break" || s.id.endsWith("-deal"))) short += ` Dealer: ${dealer}.`;
  push(r, msg({
    sender: "ai", aiMode: "demo", kind: "guide",
    title: `Step ${stepNumber(r, s)} of ${total} — ${s.title}`,
    text: [s.intro, short, s.why ? `Why: ${s.why}` : "", s.doSteps?.length ? `Do this:\n${s.doSteps.map((d, i) => `${i + 1}. ${d}`).join("\n")}` : ""].filter(Boolean).join("\n\n"),
    topicId: entryForStage(s.id)?.id,
    detail: fill(s.detail, r.decisions),
    source: s.source,
    image: stepImage(s, r.decisions),
    imageAlt: s.imageAlt,
  }));
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
export function afterExplanation(r: Room, summary: boolean, topicId?: string, topicTitle?: string) {
  if (r.check && (r.check.needs.length || summary)) {
    r.check = { ...r.check, round: r.check.round + 1, resp: {}, needs: [], topicId: topicId || r.check.topicId };
  } else if (!r.check && summary && (r.status === "setup" || r.status === "playing")) {
    r.check = newCheck(true, topicTitle || "Your group's questions", topicId);
  }
}

export function applyAction(r: Room, pid: string, a: { type: string; [k: string]: unknown }, pres: Record<string, string>) {
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
    case "start": {
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
      if (r.status !== "setup" && r.status !== "playing") throw new HttpError(409, "Not available now.");
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
      if (r.status !== "setup" || !step) throw new HttpError(409, "No active step.");
      if (r.check) throw new HttpError(409, "Finish the understanding check first.");
      if (step.kind === "dice-break" && !r.breakRoll) throw new HttpError(409, "Enter the dice first.");
      const val = String(a.value);
      if (step.kind === "consensus") {
        if (!step.options!.some((o) => o.id === val)) throw new HttpError(400, "Invalid option");
      } else if (val !== "done" && val !== "notyet") throw new HttpError(400, "Invalid response");
      r.resp[pid] = val;
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
      } else if (vals.every((x) => x === "done")) {
        push(r, msg({ sender: "system", text: step.kind === "begin" ? "All 4 players are ready." : `All 4 players completed: ${step.title}.` }));
        advance(r);
      }
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
      delete r.votes[target]; delete r.resp[target]; delete r.dice[target];
      if (r.check) { delete r.check.resp[target]; r.check.needs = r.check.needs.filter((x) => x !== target); }
      push(r, msg({ sender: "system", text: `${name}'s seat is now open. A new player can join with the room code.` }));
      return;
    }
    default:
      if (applyGameAction(r, pid, a)) return;
      throw new HttpError(400, "Unknown action");
  }
}
