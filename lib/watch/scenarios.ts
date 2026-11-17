/**
 * Collaborative mini-scenarios (fixed example tiles). The correct answer of every scenario is COMPUTED with the same
 * rules engine the game uses (lib/mj/rules), so the explanation can never disagree with the real game.
 */
import { canPung, legalDiscards, suitOf, tileName, winInfo, type Suit } from "../mj/rules";
import type { Topic } from "./types";

/** tile id from "b3" + copy (0–3) */
export const T = (k: string, copy = 0) => "cbd".indexOf(k[0]) * 36 + (Number(k.slice(1)) - 1) * 4 + copy;
const hand = (s: string) => { const seen: Record<string, number> = {}; return s.split(" ").map((k) => T(k, (seen[k] = (seen[k] ?? -1) + 1))); };

export interface ScenarioOption { id: string; label: string; tiles?: number[] }
export interface Scenario { id: string; topic: Topic; title: string; prompt: string; context?: string; hand: number[]; highlight?: number[]; missing?: Suit; options: ScenarioOption[]; correct: string; explain: string }

function dingque(): Scenario {
  const h = hand("c2 c3 c4 d5 d5 b7 d8");
  const legal = legalDiscards(h, "b");
  return {
    id: "dingque", topic: "dingque", title: "Ding Que Practice", missing: "b", hand: h,
    prompt: "Your missing suit is Bamboo. Which tile should you discard?",
    options: h.filter((t, i) => h.findIndex((x) => tileName(x) === tileName(t)) === i).map((t) => ({ id: String(t), label: tileName(t), tiles: [t] })), // one option per tile type
    correct: String(legal[0]),
    explain: `Bamboo is your missing suit, so ${tileName(legal[0])} must go first. While you hold a missing-suit tile you must discard it before any other tile, and you can't win until the suit is cleared.`,
  };
}
function pung(): Scenario {
  const h = hand("b3 b3 c1 c2 c3 b5 b6 c7 c8 c9 b8 b8 c5");
  const tile = T("b3", 2);
  const ok = canPung(h, "b3", "d");
  return {
    id: "pung", topic: "pung", title: "Pung Practice", missing: "d", hand: h, highlight: [tile],
    context: "Frank discarded Bamboo 3.",
    prompt: "Your hand has two Bamboo 3 tiles and your missing suit is Dots. Can you Pung?",
    options: [{ id: "pung", label: "Pung", tiles: [tile] }, { id: "pass", label: "Pass" }],
    correct: ok ? "pung" : "pass",
    explain: "Yes. Pung means three identical tiles. You already hold two Bamboo 3 tiles, and Bamboo isn't your missing suit, so you can claim Frank's discard to complete the set. After a Pung you discard a tile, and play continues from you.",
  };
}
function exchange(): Scenario {
  const sets = { a: hand("d1 d4 d9"), b: [T("c2"), T("b5"), T("d7")], c: [T("b1"), T("b2"), T("c3")] };
  const valid = (ts: number[]) => new Set(ts.map(suitOf)).size === 1;
  const correct = (Object.keys(sets) as (keyof typeof sets)[]).find((k) => valid(sets[k]))!;
  return {
    id: "exchange", topic: "exchange", title: "Exchange Three Tiles Practice", hand: [],
    prompt: "Which set of three tiles can you pass in the exchange?",
    options: [{ id: "a", label: "Set A", tiles: sets.a }, { id: "b", label: "Set B", tiles: sets.b }, { id: "c", label: "Set C", tiles: sets.c }],
    correct,
    explain: "Set A. All three exchanged tiles must come from ONE suit (here, three Dots). Sets B and C mix suits, so they aren't allowed. Everyone passes in the same direction at the same time.",
  };
}
function hu(): Scenario {
  const h = hand("b1 b2 b3 b4 b5 b6 d2 d3 d4 d7 d7 d7 d6 d6");
  const ok = winInfo(h, [], "c").ok;
  return {
    id: "hu", topic: "hu", title: "Hu Recognition Practice", missing: "c", hand: h, highlight: [h[h.length - 1]],
    context: "You just drew Dots 6.",
    prompt: "Your missing suit is Characters. Is this a winning hand?",
    options: [{ id: "yes", label: "Yes, Hu" }, { id: "no", label: "No, not yet" }],
    correct: ok ? "yes" : "no",
    explain: "Yes. A winning hand is four sets plus one pair: Bamboo 1-2-3, Bamboo 4-5-6, Dots 2-3-4, Dots 7-7-7, and the pair of Dots 6. It has no Characters, your missing suit, so you can declare Hu.",
  };
}
export const SCENARIOS: Scenario[] = [dingque(), pung(), exchange(), hu()];
/** Start with the scenario that matches the group's shared topic, when there is one. */
export function scenarioOrder(topics: Topic[]): number[] {
  const first = SCENARIOS.findIndex((s) => topics.includes(s.topic));
  const idx = SCENARIOS.map((_, i) => i);
  return first > 0 ? [first, ...idx.filter((i) => i !== first)] : idx;
}
