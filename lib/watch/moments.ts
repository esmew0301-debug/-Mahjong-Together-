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

export interface MomentText { title: string; happened: string; why: string; takeaway: string; basis: "rule" | "possible" | "open"; prompt: string; label?: string }

/** A readable, specific question for a moment (the spectator's original wording stays in the record). */
export function momentTitle(ref: QRef, names: Record<string, string>) {
  const who = (ref.actor && names[ref.actor]) || ref.actorName || "this player";
  const t = ref.tile !== undefined ? tileName(ref.tile) : "";
  switch (ref.type) {
    case "discard": return `Why did ${who} discard ${t}?`;
    case "pung": return `Why did ${who} declare Pung on ${t}?`;
    case "kong": return `Why did ${who} declare a Kong of ${t}?`;
    case "hu": return `How did ${t} complete ${who}'s winning hand?`;
    case "dingque": return "Why did each player choose that missing suit?";
    case "exchange": return "Which three tiles were exchanged, and why those?";
    case "draw": return `What should ${who} look for after this draw?`;
    default: return `What happened in move ${ref.seq}?`;
  }
}
/** The spectator's own question, shown under the title only when it adds something beyond "why?". */
export const meaningfulQuestion = (q: string) => q.replace(/[^a-z0-9 ]/gi, " ").trim().split(/\s+/).filter(Boolean).length >= 4;

export function explainMoment(ref: QRef, snap: SpecSnap, names: Record<string, string>): MomentText {
  const who = (ref.actor && names[ref.actor]) || ref.actorName || "The player";
  const dq = ref.actor ? (snap.dq[ref.actor] as Suit | undefined) : undefined;
  const t = ref.tile;
  const title = momentTitle(ref, names);
  switch (ref.type) {
    case "discard": {
      const tn = tileName(t!);
      if (dq && suitOf(t!) === dq)
        return { title, basis: "rule", happened: `${who} discarded ${tn} during their turn. ${SUIT_NAME[dq]} was ${who}'s selected missing suit.`,
          why: `In Sichuan Mahjong, players must eliminate their chosen missing suit before winning. Since ${who} chose ${SUIT_NAME[dq]} as the missing suit, discarding ${tn} removes one of those tiles and brings the hand closer to meeting the winning requirements.`,
          takeaway: "To win, your hand cannot contain tiles from your chosen missing suit.",
          prompt: "Why do you think this move makes sense?" };
      const before = [...(snap.hands[ref.actor!] || []), t!];
      const iso = connectivity(before, t!) <= 0;
      const pairs = before.filter((x) => keyOf(x) === keyOf(t!)).length >= 2;
      return { title, basis: iso ? "possible" : "open",
        happened: `${who} discarded ${tn} during their turn.${dq ? ` ${who}'s missing suit (${SUIT_NAME[dq]}) was already cleared, so any tile could be discarded.` : ""}`,
        why: iso ? `${tn} had no matching or neighbouring tile in ${who}'s hand at that moment (no pair, nothing one or two numbers away), so it couldn't easily become part of a set. One possible reason for the discard is to keep the tiles that already work together.`
          : pairs ? `${tn} was part of a pair in ${who}'s hand, so the choice isn't obvious: a pair is useful for the final pair or a future Pung. There may be several reasons; the player's exact intention isn't recorded.`
          : `${tn} could still connect to nearby tiles in ${who}'s hand, so other discards were possible too. One possible reason is that ${who} preferred to keep other combinations; the exact intention isn't recorded.`,
        takeaway: "Once the missing suit is gone, players usually discard the tile that helps their sets the least.",
        prompt: "Why do you think the player chose this tile instead of another one?" };
    }
    case "pung": return { title, basis: "rule", happened: `${who} claimed ${names[ref.from || ""] || "another player"}'s discarded ${tileName(t!)} and placed a Pung face up.`,
      why: `${RULES.pung} ${who} held two ${tileName(t!)} tiles, so the discard completed a set of three. After a Pung, the claimer discards right away, and play continues from them (skipping the players in between).`,
      takeaway: "You can Pung a discard when you already hold two matching tiles that aren't your missing suit.", prompt: "Why do you think the player claimed this tile instead of waiting to draw?" };
    case "kong": return { title, basis: "rule", happened: `${who} declared a Kong of ${tileName(t!)}.`, why: `${RULES.kong} A Kong also earns extra points, which is one reason players declare it when they can.`,
      takeaway: "Four identical tiles form a Kong, and the player draws a replacement tile.", prompt: "Why might a Kong be worth more than a Pung?" };
    case "hu": {
      const hand = snap.hands[ref.actor!] || [];
      const ok = winInfo(hand, snap.melds[ref.actor!] || [], dq).ok;
      return { title, basis: "rule", happened: `${who} declared Hu with ${tileName(t!)}.`,
        why: `${RULES.goal} ${ok ? `With ${tileName(t!)}, ${who}'s tiles at that moment form exactly that shape, and none of them are from the missing suit (${dq ? SUIT_NAME[dq] : "none"}).` : RULES.huRule}`,
        takeaway: "A winning hand is four sets plus one pair, with no tiles of your missing suit.", prompt: "Can you find the four sets and the pair in this hand?" };
    }
    case "dingque": return { title, basis: "rule", happened: ref.text, why: `${RULES.dingque} Players usually choose the suit they hold the fewest tiles of, because it is the quickest to clear.`,
      takeaway: "Your missing suit must be completely discarded before you can win.", prompt: "Looking at each hand, why might each player have picked that suit?", label: "Missing suits chosen" };
    case "exchange": return { title, basis: "rule", happened: ref.text, why: RULES.exchange, takeaway: "The three exchanged tiles must all come from one suit.", prompt: "Which suit would you have passed from your hand?", label: "Three tiles exchanged" };
    default: return { title, basis: "rule", happened: ref.text, why: RULES.turn, takeaway: "Each turn: draw one tile, then discard one.", prompt: "What changed on the table at this moment?" };
  }
}
