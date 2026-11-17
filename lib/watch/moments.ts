/**
 * Practice "moments": real moves from the watched game that the group asked about. Explanations come only from the
 * recorded snapshot and the rules engine: confirmed rules are stated as rules; strategy is phrased as a possibility;
 * a player's private intention is never claimed.
 */
import { SUIT_NAME, connectivity, keyOf, suitOf, tileName, winInfo, type Suit } from "../mj/rules";
import type { QRef, SpecSnap, Topic } from "./types";
import { RULES } from "./basics";

export interface Moment { qid: string; seq: number; game: string; ref: QRef; topic: Topic; question: string; snap: SpecSnap }

/** Tiles to circle in red for this moment (the exact tile, or the meld it completed). */
export function momentTiles(m: { ref: QRef; snap: SpecSnap }): number[] {
  const { ref, snap } = m;
  if (ref.tile === undefined) return [];
  if ((ref.type === "pung" || ref.type === "kong") && ref.actor) {
    const meld = (snap.melds[ref.actor] || []).find((x) => x.tiles.includes(ref.tile!));
    if (meld) return meld.tiles;
  }
  return [ref.tile];
}

export interface MomentText { happened: string; why: string; basis: "rule" | "possible" | "open"; prompt: string; label?: string }

export function explainMoment(ref: QRef, snap: SpecSnap, names: Record<string, string>): MomentText {
  const who = (ref.actor && names[ref.actor]) || ref.actorName || "The player";
  const dq = ref.actor ? (snap.dq[ref.actor] as Suit | undefined) : undefined;
  const t = ref.tile;
  switch (ref.type) {
    case "discard": {
      const tn = tileName(t!);
      if (dq && suitOf(t!) === dq)
        return { happened: `${who} discarded ${tn}. ${SUIT_NAME[dq]} is ${who}'s missing suit.`, basis: "rule",
          why: `In Sichuan Mahjong, players must eliminate their Ding Que suit before winning. Discarding a ${SUIT_NAME[dq]} tile is required while any are left.`,
          prompt: "How does this move help the player get closer to a winning hand?" };
      const before = [...(snap.hands[ref.actor!] || []), t!];
      const iso = connectivity(before, t!) <= 0;
      const pairs = before.filter((x) => keyOf(x) === keyOf(t!)).length >= 2;
      return { happened: `${who} discarded ${tn}${dq ? ` (missing suit: ${SUIT_NAME[dq]}, already cleared)` : ""}.`, basis: iso ? "possible" : "open",
        why: iso ? `One possible reason: ${tn} had no matching or neighbouring tile in the hand at that moment, so it was unlikely to help build a set.`
          : pairs ? `${tn} was part of a pair, so this choice isn't obvious. There may be several reasons; the player's exact intention isn't recorded.`
          : `There may be several reasons for this discard. ${tn} could still connect to nearby tiles, so the player may have preferred other combinations.`,
        prompt: "Which tile would you have discarded here, and why?" };
    }
    case "pung": return { happened: `${who} claimed ${names[ref.from || ""] || "another player"}'s ${tileName(t!)} and made a Pung.`, basis: "rule",
      why: `${RULES.pung} After a Pung the claimer discards, and the turn continues from them.`, prompt: "What did the player give up by claiming this tile instead of drawing?" };
    case "kong": return { happened: `${who} declared a Kong of ${tileName(t!)}.`, basis: "rule", why: RULES.kong, prompt: "Why might a Kong be worth more than a Pung?" };
    case "hu": {
      const hand = snap.hands[ref.actor!] || [];
      const ok = winInfo(hand, snap.melds[ref.actor!] || [], dq).ok;
      return { happened: `${who} declared Hu with ${tileName(t!)}.`, basis: "rule",
        why: `${RULES.goal} ${ok ? `${who}'s tiles at that moment form exactly that shape, with no ${dq ? SUIT_NAME[dq] : "missing-suit"} tiles.` : RULES.huRule}`,
        prompt: "Can you find the four sets and the pair in this hand?" };
    }
    case "dingque": return { happened: ref.text, basis: "rule", why: RULES.dingque, prompt: "Looking at each hand, why might each player have picked that suit?", label: "Missing suits chosen" };
    case "exchange": return { happened: ref.text, basis: "rule", why: RULES.exchange, prompt: "Which suit would you have passed from your hand?", label: "Three tiles exchanged" };
    case "draw": return { happened: ref.text, basis: "rule", why: RULES.turn, prompt: "What should the player look for after drawing?" };
    default: return { happened: ref.text, basis: "rule", why: RULES.turn, prompt: "What changed on the table at this moment?" };
  }
}
