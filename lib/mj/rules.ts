/**
 * Mahjong Together — online Sichuan Mahjong rules (shared by server engine, Coach and simulated players).
 * Rules profile: Sichuan "Blood Battle" (血战到底) beginner subset, as documented in lib/mj/README in the report:
 *  - 108 tiles: Characters (c), Bamboo (b), Dots (d) 1–9, four of each. No honors, no flowers.
 *  - Exchange 3 tiles of ONE suit, then choose a missing suit (Ding Que).
 *  - While you hold missing-suit tiles you must discard them first, and you cannot win.
 *  - Pung and Kong allowed (no Chow). Win = 4 sets + 1 pair (sets may be runs inside your hand) or seven pairs.
 *  - A winner leaves the hand; play continues until 3 players have won or the wall is empty.
 * Pure functions only — no randomness, no network, no AI.
 */
export type Suit = "c" | "b" | "d";
export const SUITS: Suit[] = ["c", "b", "d"];
export const SUIT_NAME: Record<Suit, string> = { c: "Characters", b: "Bamboo", d: "Dots" };

/** Tile ids 0..107: suit = floor(id/36), number = floor((id%36)/4)+1 (four copies of each). */
export const suitOf = (t: number): Suit => SUITS[Math.floor(t / 36)];
export const numOf = (t: number) => Math.floor((t % 36) / 4) + 1;
export const keyOf = (t: number) => `${suitOf(t)}${numOf(t)}`; // e.g. "b5"
export const tileName = (t: number) => `${SUIT_NAME[suitOf(t)]} ${numOf(t)}`;
export const keyName = (k: string) => `${SUIT_NAME[k[0] as Suit]} ${k.slice(1)}`;
export const sortTiles = (ts: number[]) => [...ts].sort((a, b) => a - b);
export const allTiles = () => Array.from({ length: 108 }, (_, i) => i);

export type Meld = { kind: "pung" | "kong" | "ckong"; key: string; tiles: number[]; from?: string };

function counts(keys: string[]) {
  const m: Record<string, number> = {};
  for (const k of keys) m[k] = (m[k] || 0) + 1;
  return m;
}

/** Can these keys be split exactly into `sets` sets (pungs or runs) and one pair? */
function standardShape(keys: string[], sets: number): boolean {
  if (keys.length !== sets * 3 + 2) return false;
  const c = counts(keys);
  const order = SUITS.flatMap((s) => Array.from({ length: 9 }, (_, i) => `${s}${i + 1}`));
  const solve = (need: number): boolean => {
    const k = order.find((x) => (c[x] || 0) > 0);
    if (!k) return need === 0;
    if (c[k] >= 3) { c[k] -= 3; if (solve(need - 1)) { c[k] += 3; return true; } c[k] += 3; }
    const s = k[0], n = Number(k.slice(1));
    const k2 = `${s}${n + 1}`, k3 = `${s}${n + 2}`;
    if (n <= 7 && (c[k2] || 0) > 0 && (c[k3] || 0) > 0) {
      c[k]--; c[k2]--; c[k3]--;
      const ok = solve(need - 1);
      c[k]++; c[k2]++; c[k3]++;
      if (ok) return true;
    }
    return false;
  };
  for (const p of order) {
    if ((c[p] || 0) >= 2) { c[p] -= 2; const ok = solve(sets); c[p] += 2; if (ok) return true; }
  }
  return false;
}

export interface WinInfo { ok: boolean; reason?: string; structure?: "standard" | "seven_pairs" | "all_pungs"; pureSuit?: boolean; roots?: number }

/** Deterministic win check for a COMPLETE hand (concealed tiles incl. the winning tile + melds). */
export function winInfo(concealed: number[], melds: Meld[], missing?: Suit): WinInfo {
  const keys = concealed.map(keyOf);
  const allKeys = [...keys, ...melds.flatMap((m) => m.tiles.map(keyOf))];
  if (missing && allKeys.some((k) => k[0] === missing)) return { ok: false, reason: `You still hold ${SUIT_NAME[missing]} (your missing suit). Clear it before winning.` };
  const suits = new Set(allKeys.map((k) => k[0]));
  if (suits.size > 2) return { ok: false, reason: "A winning hand may use at most two suits." };
  const pureSuit = suits.size === 1;
  const all = counts(allKeys);
  const roots = Object.values(all).filter((n) => n === 4).length;
  if (!melds.length && keys.length === 14) {
    const c = counts(keys);
    if (Object.values(c).every((n) => n % 2 === 0)) return { ok: true, structure: "seven_pairs", pureSuit, roots };
  }
  const sets = 4 - melds.length;
  if (!standardShape(keys, sets)) return { ok: false, reason: "Your tiles don't form four sets and a pair yet." };
  const c = counts(keys);
  const pungOnly = Object.values(c).filter((n) => n === 2).length === 1 && Object.values(c).every((n) => n === 2 || n === 3);
  return { ok: true, structure: pungOnly ? "all_pungs" : "standard", pureSuit, roots };
}

export const hasSuit = (hand: number[], s?: Suit) => !!s && hand.some((t) => suitOf(t) === s);
export const tilesOfKey = (hand: number[], k: string) => hand.filter((t) => keyOf(t) === k);
export const canPung = (hand: number[], k: string, missing?: Suit) => k[0] !== missing && tilesOfKey(hand, k).length >= 2;
export const canKong = (hand: number[], k: string, missing?: Suit) => k[0] !== missing && tilesOfKey(hand, k).length >= 3;
export const concealedKongKeys = (hand: number[], missing?: Suit) =>
  [...new Set(hand.map(keyOf))].filter((k) => k[0] !== missing && tilesOfKey(hand, k).length === 4);
/** Would `tile` complete a win for this player (claimed from a discard)? */
export const canWinWith = (hand: number[], melds: Meld[], tile: number, missing?: Suit) =>
  suitOf(tile) !== missing && winInfo([...hand, tile], melds, missing).ok;

/** Legal discards: while missing-suit tiles remain, only those (common Sichuan rule enforced by most apps). */
export function legalDiscards(hand: number[], missing?: Suit) {
  const m = hand.filter((t) => suitOf(t) === missing);
  return m.length ? m : hand;
}

/** Choose 3 tiles of one suit for the exchange (simple: the suit you hold fewest of, but at least 3). */
export function pickExchange(hand: number[]): number[] {
  const bySuit = SUITS.map((s) => hand.filter((t) => suitOf(t) === s)).filter((g) => g.length >= 3).sort((a, b) => a.length - b.length);
  const g = bySuit[0] || [];
  // prefer loose tiles: highest "isolation" first
  return [...g].sort((a, b) => connectivity(g, a) - connectivity(g, b)).slice(0, 3);
}
/** Missing suit suggestion: the suit you hold fewest of. */
export function pickMissing(hand: number[]): Suit {
  return [...SUITS].sort((a, b) => hand.filter((t) => suitOf(t) === a).length - hand.filter((t) => suitOf(t) === b).length)[0];
}

/** How "connected" a tile is to the rest of the hand (pairs, neighbours). Lower = more isolated. */
export function connectivity(hand: number[], t: number) {
  const k = keyOf(t), s = suitOf(t), n = numOf(t);
  const same = hand.filter((x) => x !== t && keyOf(x) === k).length;
  const near = (d: number) => hand.some((x) => x !== t && suitOf(x) === s && numOf(x) === n + d);
  let score = same * 3;
  if (near(1)) score += 2;
  if (near(-1)) score += 2;
  if (near(2)) score += 1;
  if (near(-2)) score += 1;
  if (n === 1 || n === 9) score -= 0.5; // edge tiles connect less
  return score;
}

export type WhyCategory = "missing" | "isolated" | "pair" | "alternative";
export interface Suggestion { tile: number; title: string; category: WhyCategory; reason: string; alternatives: boolean; keepPair?: string; note?: string }
/** Free, deterministic Coach heuristic. Only ever returns a LEGAL discard; never claims to be optimal.
 *  Every suggestion carries the category of the rule/heuristic that produced it, and a matching explanation. */
export function suggestDiscard(hand: number[], missing?: Suit): Suggestion | null {
  if (!hand.length) return null;
  const legal = legalDiscards(hand, missing);
  const mHand = hand.filter((t) => suitOf(t) === missing);
  if (mHand.length && missing) {
    const t = [...mHand].sort((a, b) => connectivity(mHand, a) - connectivity(mHand, b))[0];
    return { tile: t, title: `Discard ${tileName(t)}`, category: "missing", reason: `Your missing suit is ${SUIT_NAME[missing]}. Clear these tiles before you can win.`, alternatives: mHand.length > 1,
      note: mHand.length > 1 ? `You still have ${mHand.length} ${SUIT_NAME[missing]} tiles; any of them is a legal choice.` : undefined };
  }
  const scored = legal.map((t) => ({ t, c: connectivity(hand, t) })).sort((a, b) => a.c - b.c || numOf(b.t) - numOf(a.t));
  const best = scored[0];
  const tie = scored.filter((x) => x.c === best.c).length > 1;
  // Pairs the heuristic deliberately kept (a pair scores high, so it is never the first choice).
  const pairs = [...new Set(hand.map(keyOf))].filter((k) => hand.filter((x) => keyOf(x) === k).length === 2);
  const keepPair = pairs.length ? keyName(pairs[0]) : undefined;
  if (best.c <= 0)
    return { tile: best.t, title: `Discard ${tileName(best.t)}`, category: tie ? "alternative" : "isolated",
      reason: tie ? "You have more than one legal option. This is one simple choice, not the only correct move."
        : "This tile has fewer connections to the rest of your hand. Discarding it may help preserve useful groups.",
      alternatives: tie, keepPair };
  if (keepPair && !tie)
    return { tile: best.t, title: `Discard ${tileName(best.t)}`, category: "pair", reason: `Keeping your pair of ${keepPair} may help you build a winning hand, so the Coach suggests a tile that helps less.`, alternatives: false, keepPair };
  return { tile: best.t, title: `Discard ${tileName(best.t)}`, category: tie ? "alternative" : "isolated",
    reason: tie ? "You have more than one legal option. This is one simple choice, not the only correct move." : "This tile helps your hand the least right now. Discarding it keeps your more useful groups.",
    alternatives: tie, keepPair };
}
