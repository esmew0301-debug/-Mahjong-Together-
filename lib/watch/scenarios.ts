/**
 * Learning-group practice: a bank of fixed-tile Sichuan scenarios. Every correct answer is COMPUTED with the same
 * rules engine the game uses (lib/mj/rules), so explanations can never disagree with the real game.
 * Each learner answers exactly FIVE distinct scenarios (practiceSet), at their own pace.
 */
import { canKong, canPung, legalDiscards, suitOf, tileName, winInfo, SUIT_NAME, type Suit } from "../mj/rules";
import type { Topic } from "./types";

/** tile id from "b3" + copy (0–3) */
export const T = (k: string, copy = 0) => "cbd".indexOf(k[0]) * 36 + (Number(k.slice(1)) - 1) * 4 + copy;
const hand = (s: string) => { const seen: Record<string, number> = {}; return s.split(" ").map((k) => T(k, (seen[k] = (seen[k] ?? -1) + 1))); };

export interface ScenarioOption { id: string; label: string; tiles?: number[]; why?: string /* shown when this WRONG option is chosen */ }
export interface Scenario { id: string; topic: Topic; title: string; prompt: string; context?: string; hand: number[]; highlight?: number[]; missing?: Suit; options: ScenarioOption[]; correct: string; explain: string }

const sameSuit = (ts: number[]) => new Set(ts.map(suitOf)).size === 1;

function tilesSuit(): Scenario {
  const opts = [T("c5"), T("b1"), T("d3")];
  const correct = opts.find((t) => suitOf(t) === "b")!;
  return {
    id: "tiles-bamboo", topic: "tile", title: "Know Your Tiles", hand: [],
    prompt: "Which of these tiles is a Bamboo tile?",
    options: opts.map((t) => ({ id: String(t), label: tileName(t), tiles: [t], why: `${tileName(t)} belongs to the ${SUIT_NAME[suitOf(t)]} suit, not Bamboo.` })),
    correct: String(correct),
    explain: "Bamboo 1 is traditionally drawn as a bird; Bamboo 2–9 show green sticks. Sichuan Mahjong uses only three suits: Characters, Bamboo and Dots, numbered 1 to 9.",
  };
}
function exchangeA(): Scenario {
  const sets = { a: hand("d1 d4 d9"), b: [T("c2"), T("b5"), T("d7")], c: [T("b1"), T("b2"), T("c3")] };
  const correct = (Object.keys(sets) as (keyof typeof sets)[]).find((k) => sameSuit(sets[k]))!;
  return {
    id: "exchange-dots", topic: "exchange", title: "Exchange Three Tiles", hand: [],
    prompt: "Which set of three tiles can you pass in the exchange?",
    options: [
      { id: "a", label: "Set A", tiles: sets.a },
      { id: "b", label: "Set B", tiles: sets.b, why: "Set B has one Characters, one Bamboo and one Dots tile. The three exchanged tiles must all come from the same suit." },
      { id: "c", label: "Set C", tiles: sets.c, why: "Set C mixes two Bamboo tiles with a Characters tile. All three must share one suit." },
    ],
    correct,
    explain: "Set A: these three tiles belong to the same suit (Dots), so they can be exchanged together. The numbers can be different. Everyone passes in the same direction at the same time.",
  };
}
function exchangeB(): Scenario {
  const sets = { a: [T("c2"), T("c7"), T("b4")], b: hand("b2 b5 b9"), c: [T("d1"), T("d1", 1), T("c1")] };
  const correct = (Object.keys(sets) as (keyof typeof sets)[]).find((k) => sameSuit(sets[k]))!;
  return {
    id: "exchange-bamboo", topic: "exchange", title: "Exchange Three Tiles", hand: [],
    prompt: "You must pass three tiles to the player on your left. Which set is allowed?",
    options: [
      { id: "a", label: "Set A", tiles: sets.a, why: "Set A has two Characters and one Bamboo tile. Mixed suits can't be exchanged." },
      { id: "b", label: "Set B", tiles: sets.b },
      { id: "c", label: "Set C", tiles: sets.c, why: "Set C has a pair of Dots 1 plus a Characters tile. Matching numbers don't matter: all three must share a suit." },
    ],
    correct,
    explain: "Set B: Bamboo 2, 5 and 9 are all Bamboo, so they're a legal exchange. The rule is about the suit, not the numbers.",
  };
}
function dingque(): Scenario {
  const h = hand("c2 c3 c4 d5 d5 b7 d8");
  const legal = legalDiscards(h, "b");
  const uniq = h.filter((t, i) => h.findIndex((x) => tileName(x) === tileName(t)) === i);
  return {
    id: "dingque-discard", topic: "dingque", title: "Ding Que (Missing Suit)", missing: "b", hand: h,
    prompt: "Your missing suit is Bamboo. Which tile must you discard?",
    options: uniq.map((t) => ({ id: String(t), label: tileName(t), tiles: [t], why: `${tileName(t)} isn't your missing suit. While you still hold a Bamboo tile, you must discard Bamboo first.` })),
    correct: String(legal[0]),
    explain: `Bamboo is your missing suit, so ${tileName(legal[0])} must go first. While you hold a missing-suit tile you must discard it before any other tile.`,
  };
}
function dingqueHu(): Scenario {
  const h = hand("b1 b2 b3 b4 b5 b6 c7 c8 c9 c2 c3 c4 d3 d3");
  const ok = winInfo(h, [], "d").ok; // Dots is the missing suit
  return {
    id: "dingque-no-win", topic: "dingque", title: "Ding Que and Winning", missing: "d", hand: h, highlight: [h[12], h[13]],
    prompt: "Your missing suit is Dots, and you still hold two Dots 3. Can you declare Hu?",
    options: [
      { id: "yes", label: "Yes, Hu", why: "You still hold Dots tiles, and Dots is your missing suit. You can't declare Hu while holding any tile of your missing suit, however complete the hand looks." },
      { id: "no", label: "No, not yet" },
    ],
    correct: ok ? "yes" : "no",
    explain: "No. Even though the tiles form four sets and a pair, the pair is Dots, your missing suit. In Sichuan Mahjong you must clear every missing-suit tile before you can win.",
  };
}
function pung(): Scenario {
  const h = hand("b3 b3 c1 c2 c3 b5 b6 c7 c8 c9 b8 b8 c5");
  const tile = T("b3", 2);
  return {
    id: "pung-yes", topic: "pung", title: "Pung", missing: "d", hand: h, highlight: [tile],
    context: "Frank discarded Bamboo 3.",
    prompt: "You hold two Bamboo 3 tiles and your missing suit is Dots. Can you Pung?",
    options: [{ id: "pung", label: "Pung", tiles: [tile] }, { id: "pass", label: "Pass", why: "You could have claimed it: you hold two matching tiles and Bamboo isn't your missing suit." }],
    correct: canPung(h, "b3", "d") ? "pung" : "pass",
    explain: "Yes. Pung means three identical tiles. You already hold two Bamboo 3 tiles and Bamboo isn't your missing suit, so you can claim the discard. After a Pung you discard, and play continues from you.",
  };
}
function pungMissing(): Scenario {
  const h = hand("b4 b4 c1 c2 c3 c5 c6 c7 d2 d3 d4 d8 d8");
  const tile = T("b4", 2);
  return {
    id: "pung-missing-suit", topic: "pung", title: "Pung and the Missing Suit", missing: "b", hand: h, highlight: [tile],
    context: "Xinyi discarded Bamboo 4.",
    prompt: "Your missing suit is Bamboo. You hold two Bamboo 4. Can you Pung?",
    options: [{ id: "pung", label: "Pung", tiles: [tile], why: "Bamboo is your missing suit. You can't claim a Pung or Kong in your missing suit; you're trying to get rid of those tiles." }, { id: "pass", label: "Pass" }],
    correct: canPung(h, "b4", "b") ? "pung" : "pass",
    explain: "Pass. Bamboo is your missing suit, so you can't Pung it, even with a matching pair. You still have to discard your Bamboo tiles before you can win.",
  };
}
function kong(): Scenario {
  const h = hand("d6 d6 d6 c1 c2 c3 c4 c5 c6 b7 b8 b9 c9");
  const tile = T("d6", 3);
  return {
    id: "kong-claim", topic: "kong", title: "Kong", missing: "b", hand: h, highlight: [tile],
    context: "Esme discarded Dots 6.",
    prompt: "You hold three Dots 6 and your missing suit is Bamboo. What can you do with Esme's Dots 6?",
    options: [{ id: "kong", label: "Kong", tiles: [tile] }, { id: "pass", label: "Pass", why: "You could claim it: three matching tiles plus the discard make a Kong (four of a kind)." }],
    correct: canKong(h, "d6", "b") ? "kong" : "pass",
    explain: "Kong. With three Dots 6 in your hand, the fourth from a discard completes a Kong (four identical tiles). You then draw a replacement tile and discard.",
  };
}
function huYes(): Scenario {
  const h = hand("b1 b2 b3 b4 b5 b6 d2 d3 d4 d7 d7 d7 d6 d6");
  return {
    id: "hu-yes", topic: "hu", title: "Recognize a Winning Hand", missing: "c", hand: h, highlight: [h[h.length - 1]],
    context: "You just drew Dots 6.",
    prompt: "Your missing suit is Characters. Is this a winning hand?",
    options: [{ id: "yes", label: "Yes, Hu" }, { id: "no", label: "No, not yet", why: "It is complete: four sets plus one pair, and no Characters tiles." }],
    correct: winInfo(h, [], "c").ok ? "yes" : "no",
    explain: "Yes. A winning hand is four sets plus one pair: Bamboo 1-2-3, Bamboo 4-5-6, Dots 2-3-4, Dots 7-7-7, and the pair of Dots 6. It has no Characters, your missing suit.",
  };
}
function huNo(): Scenario {
  const h = hand("b1 b2 b4 b5 b6 b7 c7 c8 c9 c2 c3 c4 c6 c6");
  return {
    id: "hu-not-yet", topic: "hu", title: "Recognize a Winning Hand", missing: "d", hand: h,
    prompt: "Your missing suit is Dots. Is this a winning hand?",
    options: [{ id: "yes", label: "Yes, Hu", why: "Bamboo 1 and 2 need a Bamboo 3 to become a set, and Bamboo 7 is left over. It isn't four sets plus a pair yet." }, { id: "no", label: "No, not yet" }],
    correct: winInfo(h, [], "d").ok ? "yes" : "no",
    explain: "Not yet. Characters 7-8-9, Characters 2-3-4, Bamboo 4-5-6 and the pair of Characters 6 are fine, but Bamboo 1, 2 and 7 don't form a set. You need four sets plus a pair.",
  };
}

export const SCENARIOS: Scenario[] = [tilesSuit(), exchangeA(), dingque(), pung(), huYes(), kong(), exchangeB(), dingqueHu(), pungMissing(), huNo()];
export const scenarioById = (id: string) => SCENARIOS.find((s) => s.id === id);
export const PRACTICE_LENGTH = 5;

/** The group's five DISTINCT questions: up to two per shared topic first, then the default order. Deterministic. */
export function practiceSet(topics: Topic[]): string[] {
  const out: string[] = [];
  for (const t of topics) for (const s of SCENARIOS.filter((x) => x.topic === t).slice(0, 2)) if (!out.includes(s.id)) out.push(s.id);
  for (const s of SCENARIOS) if (!out.includes(s.id)) out.push(s.id);
  return out.slice(0, PRACTICE_LENGTH);
}
