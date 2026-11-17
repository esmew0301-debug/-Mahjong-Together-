import "server-only";
import crypto from "crypto";
import type { GameEvent, LedgerEntry, Room } from "../types";
import { HttpError, msg, nameOf, push, uid } from "./room";
import { winFan } from "../scoring/sichuan";
import { emit } from "./feed";
import {
  type Meld, type Suit, SUITS, SUIT_NAME, allTiles, canKong, canPung, canWinWith, concealedKongKeys, keyOf, legalDiscards,
  pickExchange, pickMissing, sortTiles, suggestDiscard, suitOf, tileName, tilesOfKey, winInfo,
} from "../mj/rules";

/**
 * Online Sichuan Mahjong engine (classroom demo). Server-authoritative; every mutation runs inside the room's
 * atomic compare-and-set. Hands are never sent to other players (see redactMj). Simulated seats use the same
 * validated actions with simple deterministic choices. Timers are stored as due times and applied lazily
 * (on the next request), so it works on serverless hosting.
 */

export interface MjWin { pid: string; method: "self_draw" | "discard"; from?: string; tile: number; value: number; structure: string }
export interface MjState {
  hand: number;
  order: string[]; // player ids by seat; turn order goes to the next seat
  dealer: string;
  wall: number[];
  hands: Record<string, number[]>;
  melds: Record<string, Meld[]>;
  discards: Record<string, number[]>;
  phase: "exchange" | "dingque" | "play" | "claim" | "ended";
  turn: string | null;
  drew: boolean;
  exDir: "clockwise" | "counterclockwise" | "across";
  exchange: Record<string, number[]>;
  received: Record<string, number[]>;
  dq: Record<string, Suit>;
  last: { tile: number; from: string } | null;
  claims: Record<string, { opts: string[]; choice?: string }>;
  claimUntil: number | null;
  winners: MjWin[];
  due: number | null;
  log: { ts: number; text: string }[];
  endReason?: "wins" | "wall";
  nextReady?: Record<string, boolean>;
}

const BOT_MS = 1100; // simulated players act after a short, readable pause
// Server-controlled claim window: a human who doesn't answer a Pung/Kong/Hu offer passes automatically.
const CLAIM_MS = Math.max(3000, Math.min(30000, Number(process.env.MJ_CLAIM_MS) || 9000));
const isBot = (r: Room, id: string) => r.players.find((p) => p.id === id)?.kind === "virtual";
const log = (m: MjState, text: string) => { m.log.push({ ts: Date.now(), text }); if (m.log.length > 40) m.log = m.log.slice(-40); };
const active = (m: MjState) => m.order.filter((id) => !m.winners.some((w) => w.pid === id));
function nextActive(m: MjState, from: string) {
  const i = m.order.indexOf(from);
  for (let k = 1; k <= 4; k++) { const id = m.order[(i + k) % 4]; if (!m.winners.some((w) => w.pid === id)) return id; }
  return null;
}
function shuffle(ts: number[]) {
  const a = [...ts];
  for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Start a new hand: shuffle 108 tiles, deal 13 each (dealer 14), choose the exchange direction. */
export function dealMj(r: Room, dealer?: string) {
  const order = [...r.players].sort((a, b) => a.seat - b.seat).map((p) => p.id);
  const d = dealer && order.includes(dealer) ? dealer : order[0];
  const wall = shuffle(allTiles());
  const hands: Record<string, number[]> = {};
  const start = order.indexOf(d);
  for (let k = 0; k < 4; k++) { const id = order[(start + k) % 4]; hands[id] = sortTiles(wall.splice(0, k === 0 ? 14 : 13)); }
  const prev = r.mj;
  r.mj = {
    hand: (prev?.hand || 0) + 1, order, dealer: d, wall, hands,
    melds: Object.fromEntries(order.map((id) => [id, []])), discards: Object.fromEntries(order.map((id) => [id, []])),
    phase: "exchange", turn: null, drew: false,
    exDir: (["clockwise", "counterclockwise", "across"] as const)[crypto.randomInt(3)],
    exchange: {}, received: {}, dq: {}, last: null, claims: {}, claimUntil: null, winners: [], due: Date.now() + BOT_MS, log: [],
  };
  log(r.mj, `Hand ${r.mj.hand}: ${nameOf(r, d)} deals. Choose 3 tiles of one suit to exchange.`);
  emit(r, { type: "deal", actor: d, text: `Hand ${r.mj.hand} started. ${nameOf(r, d)} is the dealer.`, rule: "deal" });
}

// ---------------- turn flow ----------------
function endHand(r: Room, reason: "wins" | "wall") {
  const m = r.mj!;
  m.phase = "ended"; m.turn = null; m.endReason = reason; m.due = null; m.claims = {}; m.claimUntil = null; m.nextReady = {};
  log(m, reason === "wall" ? "The wall is empty. Hand over." : "Three players have won. Hand over.");
  emit(r, { type: "end", text: reason === "wall" ? `Hand ${m.hand} over: the wall is empty.` : `Hand ${m.hand} over: three players have won.`, rule: "hand-end" });
  push(r, msg({ sender: "system", text: `Hand ${m.hand} finished.` }));
}
function beginTurn(r: Room, pid: string | null) {
  const m = r.mj!;
  if (!pid || active(m).length <= 1) return endHand(r, "wins");
  if (!m.wall.length) return endHand(r, "wall");
  m.hands[pid] = sortTiles([...m.hands[pid], m.wall.shift()!]);
  m.turn = pid; m.drew = true; m.phase = "play"; m.last = null; m.claims = {}; m.claimUntil = null;
  m.due = isBot(r, pid) ? Date.now() + BOT_MS : null;
  emit(r, { type: "draw", actor: pid, text: `${nameOf(r, pid)} drew a tile.`, rule: "draw" });
}

function recordWin(r: Room, pid: string, method: "self_draw" | "discard", tile: number, from?: string) {
  const m = r.mj!;
  // multi-winner discard: only the first winner physically takes the tile; the others win with it too
  const info = winInfo(m.hands[pid].includes(tile) ? m.hands[pid] : [...m.hands[pid], tile], m.melds[pid], m.dq[pid]);
  const f = winFan({ method, structure: info.structure || "standard", pureSuit: info.pureSuit, roots: info.roots, missingSuitCleared: "yes" } as never);
  const payers = method === "self_draw" ? active(m).filter((id) => id !== pid) : from ? [from] : [];
  const amount = method === "self_draw" ? f.value + 1 : f.value;
  const transfers = payers.map((p) => ({ from: p, to: pid, amount }));
  m.winners.push({ pid, method, from, tile, value: f.value, structure: info.structure || "standard" });
  // Verified by the rules engine itself (the tiles are known to the server) → straight into the score ledger.
  const now = Date.now();
  const ev: GameEvent = {
    id: uid(), idem: `mj-${m.hand}-${pid}`, type: "win", hand: m.hand, by: pid, actor: pid,
    claim: { method, fromId: from, structure: info.structure, pureSuit: info.pureSuit, roots: info.roots, missingSuitCleared: "yes" },
    transfers, lines: f.lines, manual: false, ruleVersion: "online-sichuan-v1 (planet-blood-battle-v1 values)", source: "Mahjong Together online engine",
    status: "committed", rev: 1, approvals: Object.fromEntries(r.players.map((p) => [p.id, "confirm" as const])), notes: [], createdAt: now, committedAt: now,
  };
  (r.events ||= []).push(ev);
  const entries: LedgerEntry[] = transfers.map((t) => ({ id: uid(), eventId: ev.id, hand: m.hand, from: t.from, to: t.to, amount: t.amount, reason: `${nameOf(r, pid)} won (${method === "self_draw" ? "self-draw" : "discard"})`, ruleVersion: ev.ruleVersion, approvals: r.players.map((p) => p.id), ts: now }));
  (r.ledger ||= []).push(...entries);
  r.ledgerVersion = (r.ledgerVersion || 0) + 1;
  const total = transfers.reduce((s, t) => s + t.amount, 0);
  log(m, `${nameOf(r, pid)} wins ${method === "self_draw" ? "by self-draw" : `on ${nameOf(r, from!)}'s ${tileName(tile)}`} · +${total} pts`);
  emit(r, { type: "hu", actor: pid, tile, from, text: `${nameOf(r, pid)} declared Hu ${method === "self_draw" ? "by self-draw" : `on ${nameOf(r, from!)}'s ${tileName(tile)}`}.`, rule: method === "self_draw" ? "self-draw" : "discard-win" });
}

function openClaims(r: Room, from: string, tile: number) {
  const m = r.mj!;
  const k = keyOf(tile);
  m.claims = {};
  for (const q of active(m)) {
    if (q === from) continue;
    const opts: string[] = [];
    if (canWinWith(m.hands[q], m.melds[q], tile, m.dq[q])) opts.push("hu");
    // Pung/Kong: two (three) matching concealed tiles, and the tile is not the claimer's missing suit.
    // (Holding missing-suit tiles does NOT block a claim; after claiming you still discard the missing suit first.)
    if (canKong(m.hands[q], k, m.dq[q]) && m.wall.length) opts.push("kong");
    if (canPung(m.hands[q], k, m.dq[q])) opts.push("pung");
    if (opts.length) m.claims[q] = { opts };
  }
  const ids = Object.keys(m.claims);
  if (!ids.length) return beginTurn(r, nextActive(m, from));
  // simple documented bot policy: always Hu if possible, otherwise Kong, otherwise Pung
  for (const q of ids) if (isBot(r, q)) m.claims[q].choice = m.claims[q].opts[0];
  m.phase = "claim";
  m.claimUntil = ids.some((q) => !m.claims[q].choice) ? Date.now() + CLAIM_MS : Date.now();
  m.due = m.claimUntil;
  if (ids.every((q) => m.claims[q].choice)) resolveClaims(r);
}

function resolveClaims(r: Room) {
  const m = r.mj!;
  const last = m.last!;
  for (const q of Object.keys(m.claims)) if (!m.claims[q].choice) m.claims[q].choice = "pass"; // timeout = pass
  const order = m.order;
  const after = (q: string) => (order.indexOf(q) - order.indexOf(last.from) + 4) % 4;
  const by = (c: string) => Object.keys(m.claims).filter((q) => m.claims[q].choice === c).sort((a, b) => after(a) - after(b));
  const hu = by("hu"), kong = by("kong"), pung = by("pung");
  m.claims = {}; m.claimUntil = null;
  const takeDiscard = () => { const d = m.discards[last.from]; if (d[d.length - 1] === last.tile) d.pop(); };
  if (hu.length) {
    takeDiscard();
    hu.forEach((q, i) => { if (i === 0) m.hands[q] = sortTiles([...m.hands[q], last.tile]); recordWin(r, q, "discard", last.tile, last.from); });
    if (m.winners.length >= 3) return endHand(r, "wins");
    return beginTurn(r, nextActive(m, hu[hu.length - 1]));
  }
  const k = keyOf(last.tile);
  if (kong.length) {
    const q = kong[0]; takeDiscard();
    const mine = tilesOfKey(m.hands[q], k).slice(0, 3);
    m.hands[q] = m.hands[q].filter((t) => !mine.includes(t));
    m.melds[q].push({ kind: "kong", key: k, tiles: [...mine, last.tile], from: last.from });
    log(m, `${nameOf(r, q)} Kongs ${tileName(last.tile)}.`);
    emit(r, { type: "kong", actor: q, tile: last.tile, from: last.from, text: `${nameOf(r, q)} declared Kong on ${nameOf(r, last.from)}'s ${tileName(last.tile)}.`, rule: "exposed-kong" });
    if (!m.wall.length) return endHand(r, "wall");
    m.hands[q] = sortTiles([...m.hands[q], m.wall.pop()!]); // replacement tile
    m.turn = q; m.drew = true; m.phase = "play"; m.last = null; m.due = isBot(r, q) ? Date.now() + BOT_MS : null;
    return;
  }
  if (pung.length) {
    const q = pung[0]; takeDiscard();
    const mine = tilesOfKey(m.hands[q], k).slice(0, 2);
    m.hands[q] = m.hands[q].filter((t) => !mine.includes(t));
    m.melds[q].push({ kind: "pung", key: k, tiles: [...mine, last.tile], from: last.from });
    log(m, `${nameOf(r, q)} Pungs ${tileName(last.tile)}.`);
    emit(r, { type: "pung", actor: q, tile: last.tile, from: last.from, text: `${nameOf(r, q)} declared Pung on ${nameOf(r, last.from)}'s ${tileName(last.tile)}.`, rule: "pung" });
    m.turn = q; m.drew = true; m.phase = "play"; m.last = null; m.due = isBot(r, q) ? Date.now() + BOT_MS : null; // discard next (no draw)
    return;
  }
  beginTurn(r, nextActive(m, last.from));
}

// ---------------- validated player actions ----------------
function discard(r: Room, pid: string, tile: number) {
  const m = r.mj!;
  if (m.phase !== "play" || m.turn !== pid) throw new HttpError(409, "It's not your turn.");
  if (!m.drew) throw new HttpError(409, "Draw first.");
  if (!m.hands[pid].includes(tile)) throw new HttpError(400, "That tile isn't in your hand.");
  if (!legalDiscards(m.hands[pid], m.dq[pid]).includes(tile)) throw new HttpError(409, `You must discard your missing suit (${SUIT_NAME[m.dq[pid]]}) first.`);
  m.hands[pid] = m.hands[pid].filter((t) => t !== tile);
  m.discards[pid].push(tile);
  m.last = { tile, from: pid }; m.drew = false; m.turn = null;
  emit(r, { type: "discard", actor: pid, tile, text: `${nameOf(r, pid)} discarded ${tileName(tile)}.`, rule: m.dq[pid] && suitOf(tile) === m.dq[pid] ? "missing-suit" : "discard" });
  openClaims(r, pid, tile);
}
function selfHu(r: Room, pid: string) {
  const m = r.mj!;
  if (m.phase !== "play" || m.turn !== pid || !m.drew) throw new HttpError(409, "It's not your turn.");
  const info = winInfo(m.hands[pid], m.melds[pid], m.dq[pid]);
  if (!info.ok) throw new HttpError(409, `Not a Winning Hand Yet. ${info.reason || ""}`.trim());
  const tile = m.hands[pid][m.hands[pid].length - 1];
  recordWin(r, pid, "self_draw", tile);
  if (m.winners.length >= 3) return endHand(r, "wins");
  m.turn = null; m.drew = false;
  beginTurn(r, nextActive(m, pid));
}
function concealedKong(r: Room, pid: string, key: string) {
  const m = r.mj!;
  if (m.phase !== "play" || m.turn !== pid || !m.drew) throw new HttpError(409, "It's not your turn.");
  if (!concealedKongKeys(m.hands[pid], m.dq[pid]).includes(key)) throw new HttpError(409, "This action is not allowed in the selected rules.");
  if (!m.wall.length) throw new HttpError(409, "The wall is empty.");
  const four = tilesOfKey(m.hands[pid], key);
  m.hands[pid] = m.hands[pid].filter((t) => !four.includes(t));
  m.melds[pid].push({ kind: "ckong", key, tiles: four });
  m.hands[pid] = sortTiles([...m.hands[pid], m.wall.pop()!]);
  log(m, `${nameOf(r, pid)} declares a concealed Kong.`);
  emit(r, { type: "kong", actor: pid, tile: four[0], text: `${nameOf(r, pid)} declared a concealed Kong of ${tileName(four[0])}.`, rule: "concealed-kong" });
}

function botStep(r: Room) {
  const m = r.mj!;
  const now = Date.now();
  if (m.phase === "exchange") {
    for (const id of m.order) if (isBot(r, id) && !m.exchange[id]) m.exchange[id] = pickExchange(m.hands[id]);
    tryExchange(r);
  } else if (m.phase === "dingque") {
    for (const id of m.order) if (isBot(r, id) && !m.dq[id]) m.dq[id] = pickMissing(m.hands[id]);
    tryDingque(r);
  } else if (m.phase === "play" && m.turn && isBot(r, m.turn)) {
    const id = m.turn;
    if (winInfo(m.hands[id], m.melds[id], m.dq[id]).ok) return selfHu(r, id);
    const s = suggestDiscard(m.hands[id], m.dq[id]);
    if (s) discard(r, id, s.tile);
  } else if (m.phase === "claim" && m.claimUntil !== null && now >= m.claimUntil) {
    resolveClaims(r);
  }
}
function tryExchange(r: Room) {
  const m = r.mj!;
  if (!m.order.every((id) => m.exchange[id]?.length === 3)) { m.due = m.order.some((id) => isBot(r, id) && !m.exchange[id]) ? Date.now() + BOT_MS : null; return; }
  const off = m.exDir === "clockwise" ? 3 : m.exDir === "counterclockwise" ? 1 : 2; // pass left / right / across
  const give: Record<string, number[]> = {};
  m.order.forEach((id, i) => { give[m.order[(i + off) % 4]] = m.exchange[id]; });
  for (const id of m.order) {
    m.hands[id] = sortTiles([...m.hands[id].filter((t) => !m.exchange[id].includes(t)), ...give[id]]);
    m.received[id] = give[id];
  }
  m.phase = "dingque"; m.due = Date.now() + BOT_MS;
  log(m, "Tiles exchanged. Now choose your missing suit.");
  emit(r, { type: "exchange", text: `Everyone exchanged three tiles (${m.exDir === "across" ? "across the table" : m.exDir}).`, rule: "exchange" });
}
function tryDingque(r: Room) {
  const m = r.mj!;
  if (!m.order.every((id) => m.dq[id])) { m.due = m.order.some((id) => isBot(r, id) && !m.dq[id]) ? Date.now() + BOT_MS : null; return; }
  m.phase = "play"; m.turn = m.dealer; m.drew = true; // dealer starts with 14 tiles: discard first
  m.due = isBot(r, m.dealer) ? Date.now() + BOT_MS : null;
  log(m, `${nameOf(r, m.dealer)} discards first.`);
  emit(r, { type: "dingque", text: `Missing suits chosen: ${m.order.map((id) => `${nameOf(r, id)} ${SUIT_NAME[m.dq[id]]}`).join(", ")}.`, rule: "dingque" });
}

/** Apply any automatic step that is due (simulated seats, claim timeouts). One step per call keeps play readable. */
export function mjTick(r: Room, now = Date.now()) {
  const m = r.mj;
  if (!m || m.due === null || now < m.due || r.status !== "playing") return;
  try { botStep(r); } catch { m.due = Date.now() + BOT_MS; }
}

const SOCIAL_EMOJI = ["❤️", "👍", "😂", "👏", "😊"];
const QUICK = ["Nice Move!", "Good Game!", "Can You Explain?", "Thanks!", "Let's Play Again!"];

export function applyMjAction(r: Room, pid: string, a: Record<string, unknown>): boolean {
  switch (a.type) {
    case "mj-start": {
      if (r.status !== "playing" || r.mj) return true;
      r.playReady = { ...(r.playReady || {}), [pid]: true };
      if (r.players.length === 4 && r.players.every((p) => r.playReady![p.id])) dealMj(r);
      return true;
    }
    case "mj-exchange": {
      const m = r.mj; if (!m || m.phase !== "exchange") throw new HttpError(409, "The exchange is over.");
      const tiles = Array.isArray(a.tiles) ? a.tiles.map(Number) : [];
      if (tiles.length !== 3 || new Set(tiles).size !== 3 || !tiles.every((t) => m.hands[pid].includes(t))) throw new HttpError(400, "Choose exactly three of your tiles.");
      if (new Set(tiles.map(suitOf)).size !== 1) throw new HttpError(400, "The three tiles must share a suit.");
      if (m.exchange[pid]) return true; // locked once sent
      m.exchange[pid] = tiles;
      tryExchange(r);
      return true;
    }
    case "mj-dingque": {
      const m = r.mj; if (!m || m.phase !== "dingque") throw new HttpError(409, "Missing suits are already chosen.");
      const s = String(a.suit) as Suit; if (!SUITS.includes(s)) throw new HttpError(400, "Choose Characters, Bamboo or Dots.");
      if (!m.dq[pid]) m.dq[pid] = s;
      tryDingque(r);
      return true;
    }
    case "mj-discard": { if (!r.mj) throw new HttpError(409, "No game in progress."); discard(r, pid, Number(a.tile)); return true; }
    case "mj-hu": { if (!r.mj) throw new HttpError(409, "No game in progress."); selfHu(r, pid); return true; }
    case "mj-kong": { if (!r.mj) throw new HttpError(409, "No game in progress."); concealedKong(r, pid, String(a.key)); return true; }
    case "mj-claim": {
      const m = r.mj; if (!m || m.phase !== "claim" || !m.claims[pid]) throw new HttpError(409, "There is nothing to claim.");
      const c = String(a.choice);
      if (c !== "pass" && !m.claims[pid].opts.includes(c)) throw new HttpError(409, c === "hu" ? "Not a Winning Hand Yet." : "This action is not allowed in the selected rules.");
      if (m.claims[pid].choice) return true; // already answered (e.g. a repeated request after refresh) — first answer stands
      m.claims[pid].choice = c;
      if (Object.values(m.claims).every((x) => x.choice)) resolveClaims(r);
      return true;
    }
    case "mj-next": {
      const m = r.mj; if (!m || m.phase !== "ended" || r.status !== "playing") return true;
      m.nextReady = { ...(m.nextReady || {}), [pid]: true };
      if (r.players.every((p) => m.nextReady![p.id])) dealMj(r, m.winners[0]?.pid || m.order[(m.order.indexOf(m.dealer) + 1) % 4]);
      return true;
    }
    case "mj-test-setup": {
      // Deterministic test hands for automated tests ONLY (requires MT_E2E=1 on a test server).
      if (process.env.MT_E2E !== "1") throw new HttpError(404, "Unknown action");
      const m = r.mj; if (!m) throw new HttpError(409, "No game in progress.");
      const hands = a.hands as Record<string, number[]>, wall = (a.wall as number[]) || [];
      const all = [...Object.values(hands).flat(), ...wall];
      if (all.length !== 108 || new Set(all).size !== 108) throw new HttpError(400, "Test setup must use all 108 tiles exactly once.");
      m.hands = Object.fromEntries(Object.entries(hands).map(([k, v]) => [k, sortTiles(v)]));
      m.wall = [...wall]; m.dq = { ...(a.dq as Record<string, Suit>) };
      m.melds = Object.fromEntries(m.order.map((id) => [id, []])); m.discards = Object.fromEntries(m.order.map((id) => [id, []]));
      m.winners = []; m.claims = {}; m.claimUntil = null; m.last = null;
      m.phase = "play"; m.turn = String(a.turn); m.drew = true; m.due = isBot(r, m.turn) ? Date.now() + BOT_MS : null;
      emit(r, { type: "deal", actor: m.turn, text: `Test hands set up. ${nameOf(r, m.turn)} plays first.`, rule: "deal" });
      return true;
    }
    case "social": {
      const kind = String(a.kind);
      const text = String(a.text || "").replace(/\s+/g, " ").trim().slice(0, 140);
      if (kind === "emoji" && !SOCIAL_EMOJI.includes(text)) throw new HttpError(400, "Unknown reaction");
      if (kind === "quick" && !QUICK.includes(text)) throw new HttpError(400, "Unknown message");
      if ((kind === "ask" || kind === "reply") && !text) throw new HttpError(400, "Type a short message.");
      if (!["emoji", "quick", "ask", "reply"].includes(kind)) throw new HttpError(400, "Unknown message");
      // small per-player rate limit (the message is refused with a clear reason, never silently dropped)
      const mineLast = [...(r.social || [])].reverse().find((x) => x.pid === pid);
      if (mineLast && Date.now() - mineLast.ts < 1000) throw new HttpError(429, "Slow down a little — one message per second.");
      r.social = [...(r.social || []), { id: uid(), ts: Date.now(), pid, kind: kind as "emoji", text }].slice(-40);
      return true;
    }
  }
  return false;
}

/** What one viewer may see: their own hand and exchange; others only as counts. The wall is a count. */
export function redactMj(m: MjState | undefined, viewer: string) {
  if (!m) return undefined;
  const { wall, hands, exchange, received, claims, ...rest } = m; // (spectator feed lives on the room, not here)
  return {
    ...rest,
    wallCount: wall.length,
    myHand: hands[viewer] || [],
    handCounts: Object.fromEntries(Object.entries(hands).map(([id, h]) => [id, h.length])),
    myExchange: exchange[viewer] || null,
    exchanged: Object.fromEntries(Object.keys(exchange).map((id) => [id, true])),
    myReceived: received[viewer] || null,
    myClaim: claims[viewer] || null,
    claiming: Object.keys(claims),
    dq: m.phase === "dingque" ? (m.dq[viewer] ? { [viewer]: m.dq[viewer] } : {}) : m.dq, // missing suits revealed once everyone has chosen
    winnerHands: Object.fromEntries(m.winners.map((w) => [w.pid, hands[w.pid]])), // a winner's hand is shown face up
  };
}
export type PublicMj = ReturnType<typeof redactMj>;
