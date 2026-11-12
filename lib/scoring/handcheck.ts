/**
 * Optional manual tile check for three-suit (Sichuan) hands. Pure function — runs on the player's phone only.
 * Tile codes: "c1".."c9" Characters, "b1".."b9" Bamboo, "d1".."d9" Dots.
 */
export type Suit = "c" | "b" | "d";
export interface Meld { kind: "pung" | "kong" | "concealed_kong"; tile: string }
export interface HandInput { concealed: string[]; melds: Meld[]; winningTile?: string; missingSuit?: Suit }
export interface HandResult {
  ok: boolean;
  errors: string[];
  structure?: "standard" | "seven_pairs" | "all_pungs";
  pureSuit: boolean;
  roots: number;
  goldenHook: boolean;
}
const VALID = /^[cbd][1-9]$/;
export const SUIT_NAME: Record<Suit, string> = { c: "Characters", b: "Bamboo", d: "Dots" };
export const tileName = (t: string) => `${t[1]} ${SUIT_NAME[t[0] as Suit]}`;

function counts(tiles: string[]) {
  const m = new Map<string, number>();
  for (const t of tiles) m.set(t, (m.get(t) || 0) + 1);
  return m;
}
function canFormSets(cnt: Map<string, number>, sets: number, needPair: boolean, onlyPungs: boolean): boolean {
  const keys = [...cnt.keys()].filter((k) => (cnt.get(k) || 0) > 0).sort();
  if (!keys.length) return sets === 0 && !needPair;
  const t = keys[0];
  const n = cnt.get(t)!;
  if (needPair && n >= 2) {
    cnt.set(t, n - 2);
    if (canFormSets(cnt, sets, false, onlyPungs)) { cnt.set(t, n); return true; }
    cnt.set(t, n);
  }
  if (sets > 0 && n >= 3) {
    cnt.set(t, n - 3);
    if (canFormSets(cnt, sets - 1, needPair, onlyPungs)) { cnt.set(t, n); return true; }
    cnt.set(t, n);
  }
  if (!onlyPungs && sets > 0) {
    const v = Number(t[1]);
    const a = `${t[0]}${v + 1}`, b = `${t[0]}${v + 2}`;
    if (v <= 7 && (cnt.get(a) || 0) > 0 && (cnt.get(b) || 0) > 0) {
      cnt.set(t, n - 1); cnt.set(a, cnt.get(a)! - 1); cnt.set(b, cnt.get(b)! - 1);
      const ok = canFormSets(cnt, sets - 1, needPair, onlyPungs);
      cnt.set(t, n); cnt.set(a, cnt.get(a)! + 1); cnt.set(b, cnt.get(b)! + 1);
      if (ok) return true;
    }
  }
  return false;
}

export function checkHand(h: HandInput): HandResult {
  const errors: string[] = [];
  const res: HandResult = { ok: false, errors, pureSuit: false, roots: 0, goldenHook: false };
  const all = [...h.concealed, ...h.melds.flatMap((m) => Array(m.kind === "pung" ? 3 : 4).fill(m.tile))];
  const bad = all.filter((t) => !VALID.test(t));
  if (bad.length) { errors.push("Only Characters, Bamboo and Dots 1–9 are used in Sichuan."); return res; }
  const kongs = h.melds.filter((m) => m.kind !== "pung").length;
  const expected = 14 + kongs;
  if (all.length !== expected) errors.push(`A winning hand here has ${expected} tiles (14 + 1 per kong); you entered ${all.length}.`);
  const total = counts(all);
  for (const [t, n] of total) if (n > 4) errors.push(`There are only 4 of each tile — you entered ${n} × ${tileName(t)}.`);
  if (h.winningTile && !h.concealed.includes(h.winningTile)) errors.push("Include the winning tile in your concealed tiles.");
  if (h.missingSuit && all.some((t) => t[0] === h.missingSuit)) errors.push(`You still hold ${SUIT_NAME[h.missingSuit]}, your declared missing suit.`);
  if (errors.length) return res;
  res.pureSuit = new Set(all.map((t) => t[0])).size === 1;
  res.roots = [...total.values()].filter((n) => n === 4).length;
  const setsNeeded = 4 - h.melds.length;
  const c = counts(h.concealed);
  if (!h.melds.length && h.concealed.length === 14 && [...c.values()].every((n) => n % 2 === 0)) {
    res.structure = "seven_pairs";
  } else if (canFormSets(new Map(c), setsNeeded, true, true)) {
    res.structure = "all_pungs";
  } else if (canFormSets(new Map(c), setsNeeded, true, false)) {
    res.structure = "standard";
  } else {
    errors.push("These tiles don't form four sets and a pair, or seven pairs.");
    return res;
  }
  res.goldenHook = h.melds.length === 4 && h.concealed.length === 2;
  res.ok = true;
  return res;
}
