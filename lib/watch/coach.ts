/**
 * Spectator Private Coach — a free, deterministic rules assistant that runs entirely in the viewer's browser.
 * No network, no paid API, no LLM. When a move is selected it reasons ONLY from that move's authorized snapshot and
 * never claims to know a player's intention ("This may explain…", "There may be several reasons…").
 */
import { answerQuestion, FALLBACK } from "../mahjong/assistant";
import { SUITS, SUIT_NAME, connectivity, keyOf, numOf, suitOf, tileName, winInfo, type Suit } from "../mj/rules";
import type { QRef, SpecSnap } from "./types";

export interface CoachCtx { ref?: QRef | null; snap?: SpecSnap | null; names: Record<string, string> }

const DEF = {
  pung: "Pung means three identical tiles. A player can claim another player's discard when they already have two matching tiles and the claim is legal (the tile isn't their missing suit).",
  kong: "Kong means four identical tiles. You can claim a discard when you hold three matching tiles, or declare a concealed Kong with four you drew yourself. After a Kong you draw a replacement tile.",
  diff: "A Pung is three identical tiles; a Kong is four. Both can be made by claiming a discard (Pung: you hold two; Kong: you hold three). A Kong also gives you a replacement tile and scores extra points.",
  hu: "Hu means winning. In Sichuan Mahjong your tiles must form four sets (three of a kind or a run like 3-4-5 in one suit) plus one pair, or seven pairs, and you must hold no tiles of your missing suit.",
  dingque: "Ding Que means choosing a missing suit. After the exchange, each player picks one of the three suits (Characters, Bamboo, or Dots) to give up. They must discard those tiles first and can't win while holding any of them.",
  exchange: "Exchange Three Tiles: after the deal, every player passes three tiles of ONE suit to another player, all in the same direction (clockwise, counter-clockwise, or across).",
  turn: "Play moves to the next player in turn: draw one tile, then discard one. A Pung or Kong on a discard skips ahead to the claimer, who then discards.",
  tiles: "Sichuan Mahjong uses 108 tiles: Characters, Bamboo, and Dots, numbered 1 to 9, with four copies of each. There are no winds, dragons, or flowers.",
};
const has = (q: string, ...ws: string[]) => ws.some((w) => q.includes(w));

function playerIn(q: string, ctx: CoachCtx): string | undefined {
  for (const [id, n] of Object.entries(ctx.names)) if (n && q.includes(n.toLowerCase())) return id;
  return ctx.ref?.actor;
}
/** Tiles that would complete this player's hand right now (from the snapshot). */
function waits(s: SpecSnap, pid: string) {
  const hand = s.hands[pid] || [], dq = s.dq[pid] as Suit | undefined;
  const out: string[] = [];
  for (const su of SUITS) for (let n = 1; n <= 9; n++) {
    if (su === dq) continue;
    const t = "cbd".indexOf(su) * 36 + (n - 1) * 4;
    if (winInfo([...hand, t], s.melds[pid] || [], dq).ok) out.push(`${SUIT_NAME[su]} ${n}`);
  }
  return out;
}

export function coachAnswer(question: string, ctx: CoachCtx): string {
  const q = ` ${question.toLowerCase().replace(/[?!.,]/g, " ").replace(/\s+/g, " ")} `;
  const s = ctx.snap, ref = ctx.ref;
  const nm = (id?: string) => (id && ctx.names[id]) || "This player";

  // What just happened?
  if (has(q, "what just happened", "what happened", "what did", "what was that")) {
    return ref ? `${ref.text} You can switch perspectives to see every hand at that moment.` : "Select a move on the table or in the move list, and I'll describe it.";
  }
  // Definitions
  if (has(q, "difference", "different") && has(q, "pung", "pong") && has(q, "kong", "gang")) return DEF.diff;
  if (has(q, " kong", "gang")) return DEF.kong;
  if (has(q, " pung", " pong", " peng")) return DEF.pung;
  if (has(q, "ding que", "dingque", "missing suit")) {
    const pid = playerIn(q, ctx);
    if (s && pid && s.dq[pid] && has(q, "his", "her", "their", nm(pid).toLowerCase())) return `${nm(pid)}'s missing suit is ${SUIT_NAME[s.dq[pid] as Suit]}. ${DEF.dingque}`;
    return DEF.dingque;
  }
  if (has(q, "exchange", "swap", "three tiles")) return DEF.exchange;

  // Can X win / Hu?
  if (has(q, " hu ", " win", "winning")) {
    const pid = playerIn(q, ctx);
    if (s && pid && s.hands[pid] && has(q, "can ", "could ", "close", "ready", "will ")) {
      const hand = s.hands[pid], dq = s.dq[pid] as Suit | undefined;
      const n = nm(pid);
      if (s.winners.some((w) => w.pid === pid)) return `${n} has already won this hand. In Sichuan "Blood Battle" play continues until three players have won.`;
      if (dq && hand.some((t) => suitOf(t) === dq)) return `Not yet. ${n} still holds ${SUIT_NAME[dq]} tiles, the missing suit, and can't win until they are all gone.`;
      if (winInfo(hand, s.melds[pid] || [], dq).ok) return `${n}'s tiles form a complete winning hand at this moment (four sets plus a pair). ${DEF.hu}`;
      const w = waits(s, pid);
      return w.length ? `${n} is one tile away. At this moment, ${w.join(" or ")} would complete the hand. That doesn't mean the tile will come.` : `Not yet. ${n}'s hand needs more than one tile to form four sets plus a pair.`;
    }
    return DEF.hu;
  }

  // Why this discard? (only from the selected move's authorized snapshot)
  if (ref?.type === "discard" && ref.tile !== undefined && has(q, "why", "reason", "discard", "throw")) {
    const pid = ref.actor!, n = nm(pid), tn = tileName(ref.tile);
    const dq = s?.dq[pid] as Suit | undefined;
    if (dq && suitOf(ref.tile) === dq) return `${SUIT_NAME[dq]} is ${n}'s missing suit. ${n} needs to clear ${SUIT_NAME[dq]} tiles before winning. This may explain the discard of ${tn}.`;
    if (s && s.hands[pid]) {
      const before = [...s.hands[pid], ref.tile];
      if (connectivity(before, ref.tile) <= 0) return `${tn} had no matching or neighbouring tiles in ${n}'s hand at that moment (no pair and nothing one or two numbers away), so it was less likely to help build a set. This may explain the discard, but there may be other reasons.`;
      const same = before.filter((t) => keyOf(t) === keyOf(ref.tile!) && t !== ref.tile).length;
      if (!same && numOf(ref.tile) !== 1 && numOf(ref.tile) !== 9) return "There may be several reasons for this move. Try asking other viewers what they think.";
    }
    return "There may be several reasons for this move. Try asking other viewers what they think.";
  }
  // What is this tile?
  if (ref?.tile !== undefined && has(q, "what tile", "which tile", "what is this", "what's this", "this tile")) {
    return `This is ${tileName(ref.tile)}: the ${SUIT_NAME[suitOf(ref.tile)]} suit, number ${numOf(ref.tile)}. ${DEF.tiles}`;
  }
  if (has(q, "turn", "whose", "order", "next")) return DEF.turn;
  if (has(q, "tiles", "suits", "bamboo", "dots", "characters")) return DEF.tiles;

  // General Sichuan rules from the existing local rule library (no AI).
  const r = answerQuestion(question, { variant: "sichuan", stepId: null, status: "playing", decisions: {}, history: [], scope: "private" });
  if (r.text && !r.text.startsWith(FALLBACK) && !/^Are you asking about/.test(r.text)) return r.text.replace(/\n\n（.*）$/, "");
  return ref ? "There may be several reasons for this move. Try asking other viewers what they think." : "I can explain Pung, Kong, Hu, Ding Que, the exchange, turn order, and the tiles. Try asking about one of those, or share your question with the group.";
}

export const COACH_STARTERS = ["What is Pung?", "What does Ding Que mean?", "What is the difference between Pung and Kong?", "What just happened?"];
