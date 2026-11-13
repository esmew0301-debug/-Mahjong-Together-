/**
 * Instructional scenes for the visual tutorial. Pure data: a scene is a set of items (tiles, seats, labels,
 * arrows, zones) with a position per phase. The renderer (components/tutorial/TutorialVisual.tsx) moves items
 * between phases with the shared motion tokens, so every variant animates the same way.
 *
 * Fixed top-down table: Player A top, Player B right, Player C bottom, Player D left. Where seats or winds are
 * known (e.g. East = dealer), they are labelled on these positions; screen positions are not real-world winds.
 */

export type TileSpec =
  | { k: "c" | "b" | "d"; n: number; red?: boolean }
  | { k: "wind"; v: "E" | "S" | "W" | "N"; latin?: boolean }
  | { k: "dragon"; v: "R" | "G" | "W" }
  | { k: "flower"; n: 1 | 2 | 3 | 4 }
  | { k: "season"; n: 1 | 2 | 3 | 4 }
  | { k: "joker" }
  | { k: "back" };

export type Pt = [number, number];
export type Seat = "A" | "B" | "C" | "D";

export interface SceneItem {
  id: string;
  kind: "tile" | "label" | "arrow" | "zone" | "seat" | "mark";
  at: Pt | Pt[]; // position per phase (last value repeats)
  tile?: TileSpec;
  faceFrom?: number; // tile shows its back until this phase
  scale?: number;
  text?: string;
  size?: number;
  weight?: number;
  anchor?: "start" | "middle" | "end";
  tone?: "ink" | "muted" | "brand";
  path?: string; // arrow (absolute coords; drawn at its own coordinates)
  w?: number;
  h?: number;
  show?: number; // first visible phase
  hide?: number; // phase from which hidden
  hl?: number[]; // phases in which the item is highlighted (brand green)
  dim?: number[]; // phases in which the item is dimmed
}

export interface Scene {
  id: string;
  title: string; // accessible description
  w: number;
  h: number;
  phases: number; // number of phases (0 = initial, 1 = highlight, 2.. = actions / final)
  long?: number[]; // phases whose movement uses the longer tileSequence duration
  items: SceneItem[];
}

// ---------- shared geometry ----------
export const TABLE = { x: 105, y: 52, s: 130 }; // table square on a 340×234 canvas
const W = 340, H = 234;
const HT = 276; // table scenes: two caption rows below seat C
const CAP1 = 252, CAP2 = 268;
export const SEAT: Record<Seat, Pt> = { A: [170, 22], B: [316, 117], C: [170, 212], D: [24, 117] };
const SPOT: Record<Seat, Pt> = { A: [170, 74], B: [214, 117], C: [170, 160], D: [126, 117] };
const CCW: Seat[] = ["C", "B", "A", "D"]; // counter-clockwise as seen from above (to each player's right)
const CW: Seat[] = ["C", "D", "A", "B"];

const T = (k: "c" | "b" | "d", n: number, red = false): TileSpec => ({ k, n, red });
const wind = (v: "E" | "S" | "W" | "N", latin = false): TileSpec => ({ k: "wind", v, latin });
const dragon = (v: "R" | "G" | "W"): TileSpec => ({ k: "dragon", v });
const back: TileSpec = { k: "back" };

function label(id: string, at: Pt | Pt[], text: string, o: Partial<SceneItem> = {}): SceneItem {
  return { id, kind: "label", at, text, size: 12, anchor: "middle", tone: "muted", ...o };
}
function tile(id: string, at: Pt | Pt[], t: TileSpec, o: Partial<SceneItem> = {}): SceneItem {
  return { id, kind: "tile", at, tile: t, ...o };
}
function seats(names: Partial<Record<Seat, string>> = {}, hl: Partial<Record<Seat, number[]>> = {}): SceneItem[] {
  return (Object.keys(SEAT) as Seat[]).map((s) => ({ id: `seat-${s}`, kind: "seat", at: SEAT[s], text: names[s] ?? s, hl: hl[s] }));
}
const table = (): SceneItem => ({ id: "table", kind: "zone", at: [TABLE.x, TABLE.y], w: TABLE.s, h: TABLE.s });
function curve(from: Pt, to: Pt, bend = 0.35): string {
  const mx = (from[0] + to[0]) / 2, my = (from[1] + to[1]) / 2;
  const cx = 170, cy = 117; // bend away from the table centre
  const dx = mx - cx, dy = my - cy;
  const len = Math.hypot(dx, dy) || 1;
  const k = bend * 60;
  return `M${from[0]} ${from[1]} Q ${mx + (dx / len) * k} ${my + (dy / len) * k} ${to[0]} ${to[1]}`;
}
function trim(from: Pt, to: Pt, r = 21): [Pt, Pt] {
  const dx = to[0] - from[0], dy = to[1] - from[1], len = Math.hypot(dx, dy) || 1;
  return [[from[0] + (dx / len) * r, from[1] + (dy / len) * r], [to[0] - (dx / len) * r, to[1] - (dy / len) * r]];
}
function arrow(id: string, from: Pt, to: Pt, o: Partial<SceneItem> = {}): SceneItem {
  const [a, b] = trim(from, to);
  return { id, kind: "arrow", at: [0, 0], path: curve(a, b, o.w ?? 0.35), tone: "brand", ...o };
}
function straight(id: string, from: Pt, to: Pt, o: Partial<SceneItem> = {}): SceneItem {
  return { id, kind: "arrow", at: [0, 0], path: `M${from[0]} ${from[1]} L ${to[0]} ${to[1]}`, tone: "brand", ...o };
}
function threeBacks(prefix: string, s: Seat, at: Pt[]): SceneItem[] {
  const vertical = s === "B" || s === "D";
  return [-1, 0, 1].map((i) => tile(`${prefix}-${s}-${i}`, at.map(([x, y]) => (vertical ? [x, y + i * 17] : [x + i * 17, y]) as Pt), back, { scale: 0.62 }));
}

// ---------- 1. tile identification / removal ----------
function tileSorting(variant: string): Scene {
  type Cat = { label: string; tiles: TileSpec[]; remove?: boolean };
  const cats: Record<string, Cat[]> = {
    sichuan: [
      { label: "Characters", tiles: [T("c", 1), T("c", 9)] },
      { label: "Bamboo", tiles: [T("b", 2), T("b", 8)] },
      { label: "Dots", tiles: [T("d", 1), T("d", 9)] },
      { label: "Set aside", tiles: [wind("E"), wind("N"), dragon("R"), dragon("G"), { k: "flower", n: 1 }, { k: "joker" }], remove: true },
    ],
    riichi: [
      { label: "Manzu", tiles: [T("c", 1), T("c", 9)] },
      { label: "Pinzu", tiles: [T("d", 1), T("d", 9)] },
      { label: "Souzu", tiles: [T("b", 2), T("b", 8)] },
      { label: "Honors", tiles: [wind("E"), wind("N"), dragon("R"), dragon("G")] },
      { label: "Set aside", tiles: [{ k: "flower", n: 1 }, { k: "season", n: 1 }, { k: "joker" }], remove: true },
    ],
    cantonese: [
      { label: "Suits", tiles: [T("c", 1), T("b", 5), T("d", 9)] },
      { label: "Honors", tiles: [wind("E"), wind("S"), dragon("R"), dragon("G")] },
      { label: "Flowers & Seasons — keep", tiles: [{ k: "flower", n: 1 }, { k: "flower", n: 2 }, { k: "season", n: 1 }, { k: "season", n: 2 }] },
      { label: "Set aside", tiles: [{ k: "joker" }], remove: true },
    ],
    american: [
      { label: "Craks · Bams · Dots", tiles: [T("c", 1), T("b", 5), T("d", 9)] },
      { label: "Winds & Dragons", tiles: [wind("N", true), wind("E", true), dragon("R"), dragon("W")] },
      { label: "Flowers — keep", tiles: [{ k: "flower", n: 1 }, { k: "flower", n: 2 }] },
      { label: "Jokers — keep", tiles: [{ k: "joker" }, { k: "joker" }] },
    ],
  };
  const totals: Record<string, string> = { sichuan: "108 tiles kept", riichi: "136 tiles kept", cantonese: "All 144 tiles kept", american: "All 152 tiles used" };
  const list = cats[variant] || cats.sichuan;
  const all = list.flatMap((c, ci) => c.tiles.map((t, ti) => ({ t, ci, ti, remove: !!c.remove })));
  // phase 0: mixed pile (deterministic shuffle)
  const order = all.map((_, i) => i).sort((a, b) => ((a * 7 + 3) % all.length) - ((b * 7 + 3) % all.length));
  const items: SceneItem[] = [];
  const sorted = list.filter((c) => !c.remove);
  const removeCat = list.find((c) => c.remove);
  all.forEach((x, i) => {
    const slot = order.indexOf(i);
    const mixed: Pt = [26 + (slot % 8) * 40, 46 + Math.floor(slot / 8) * 44];
    let final: Pt;
    if (x.remove) final = [244 + (x.ti % 3) * 28, 150 + Math.floor(x.ti / 3) * 36];
    else {
      const row = sorted.indexOf(list[x.ci]);
      final = [26 + x.ti * 28, 40 + row * 46];
    }
    items.push(tile(`t${i}`, [mixed, mixed, final], x.t, { scale: 0.85, hl: x.remove ? [1, 2] : list[x.ci].label.includes("keep") ? [2] : undefined, dim: x.remove ? [2] : undefined }));
  });
  sorted.forEach((c, row) => items.push(label(`cl${row}`, [26 + c.tiles.length * 28 + 6, 44 + row * 46], c.label, { anchor: "start", show: 2, tone: "ink", size: 12 })));
  if (removeCat) {
    items.push({ id: "aside", kind: "zone", at: [230, 128], w: 104, h: 96, show: 2, tone: "muted" });
    items.push(label("asideL", [282, 121], "Set aside", { show: 2, tone: "ink", weight: 600 }));
  }
  items.push(label("total", [W / 2 - (removeCat ? 50 : 0), H - 8], totals[variant] || totals.sichuan, { show: 2, tone: "brand", weight: 600, size: 13 }));
  return { id: `sort-${variant}`, title: "Sort the tiles into groups and set aside the unused ones", w: W, h: H, phases: 3, long: [2], items };
}

// ---------- 2. turn order ----------
function turnOrder(winds: boolean): Scene {
  const names: Record<Seat, string> = winds ? { C: "East", B: "South", A: "West", D: "North" } : { A: "A", B: "B", C: "C", D: "D" };
  const items: SceneItem[] = [table(), ...seats(names, { C: [0, 1, 5], B: [2], A: [3], D: [4] })];
  CCW.forEach((s, i) => {
    const next = CCW[(i + 1) % 4];
    items.push(arrow(`turn${i}`, SEAT[s], SEAT[next], { show: i + 2, w: 0.4 }));
  });
  items.push(label("first", [170, CAP1], winds ? "East (the dealer) goes first" : "C goes first in this example", { tone: "brand", weight: 600 }));
  items.push(label("dir", [170, 117], "Counter-clockwise", { show: 2, tone: "ink", weight: 600 }));
  items.push(label("dir2", [170, 133], "to each player's right", { show: 2 }));
  return { id: winds ? "turn-winds" : "turn", title: "Turn order goes counter-clockwise, to the player on your right", w: W, h: HT, phases: 6, items };
}

// ---------- 3. wall construction ----------
function wall(stacks: number, sub: string): Scene {
  const tw = Math.min(17, Math.floor(300 / stacks));
  const x0 = (W - stacks * tw) / 2;
  const items: SceneItem[] = [];
  for (let i = 0; i < stacks; i++) {
    const loose: Pt = [30 + ((i * 37) % 280), 40 + ((i * 53) % 50)];
    items.push(tile(`b${i}`, [loose, loose, [x0 + i * tw + tw / 2, 132], [x0 + i * tw + tw / 2, 132]], back, { scale: tw / 24, hl: [1] }));
    items.push(tile(`t${i}`, [[loose[0] + 8, loose[1] + 70], [loose[0] + 8, loose[1] + 70], [loose[0] + 8, loose[1] + 70], [x0 + i * tw + tw / 2, 132 - (tw / 24) * 30 * 0.62]], back, { scale: tw / 24, show: 0, hl: [3] }));
  }
  items.push(label("len", [W / 2, 176], `${stacks} stacks long`, { show: 2, tone: "ink", weight: 600, size: 13 }));
  items.push(label("high", [W / 2, 194], "2 tiles high — one wall in front of each player", { show: 3 }));
  items.push(label("sub", [W / 2, 216], sub, { show: 3, tone: "brand", weight: 600 }));
  return { id: `wall-${stacks}`, title: `Build a wall ${stacks} stacks long and two tiles high`, w: W, h: H, phases: 4, long: [2], items };
}

// ---------- 4. dealer by dice ----------
function dealerDice(): Scene {
  const rolls: Record<Seat, number> = { C: 9, B: 7, A: 5, D: 3 };
  const items: SceneItem[] = [table(), ...seats({}, { C: [2] })];
  (Object.keys(rolls) as Seat[]).forEach((s) => items.push(label(`r${s}`, SPOT[s], `🎲 ${rolls[s]}`, { show: 1, tone: "ink", weight: 600, size: 14 })));
  items.push(label("crown", [170, CAP1], "Highest total (C, 9) becomes the dealer", { show: 2, tone: "brand", weight: 600 }));
  items.push(label("ex", [170, CAP2], "Example rolls — use your real dice", { show: 1, size: 11 }));
  return { id: "dealer-dice", title: "Everyone rolls two dice; the highest total becomes the dealer", w: W, h: HT, phases: 3, items };
}

// ---------- 5. dice & wall break ----------
function wallBreak(method: "sichuan" | "seat-total" | "riichi" | "east-wall"): Scene {
  const d1 = 3, d2 = 5, total = 8;
  const target: Seat = method === "east-wall" ? "C" : CCW[(total - 1) % 4]; // 8 → D (dealer's left)
  const count = method === "sichuan" ? Math.min(d1, d2) : total;
  const n = 12; // shortened wall for clarity (labelled as example)
  const items: SceneItem[] = [table(), ...seats({ C: "Dealer" }, { C: [0, 1] })];
  const side = TABLE.s - 10;
  const wallTiles = (s: Seat) => {
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n;
      let p: Pt;
      // index 0 = that player's RIGHT end
      if (s === "C") p = [TABLE.x + 5 + side * (1 - f), TABLE.y + TABLE.s - 8];
      else if (s === "A") p = [TABLE.x + 5 + side * f, TABLE.y + 8];
      else if (s === "B") p = [TABLE.x + TABLE.s - 8, TABLE.y + 5 + side * f]; // B faces left: right end is at the top
      else p = [TABLE.x + 8, TABLE.y + 5 + side * (1 - f)]; // D faces right: right end is at the bottom
      const counted = s === target && i < count;
      items.push(tile(`w${s}${i}`, p, back, { scale: 0.36, hl: counted ? [3, 4] : s === target ? [] : undefined, dim: s !== target ? [2, 3, 4] : undefined }));
    }
  };
  (["A", "B", "C", "D"] as Seat[]).forEach(wallTiles);
  items.push(label("dice", [170, 108], `🎲 ${d1} + ${d2} = ${total}`, { show: 1, tone: "ink", weight: 700, size: 15 }));
  items.push(label("ex", [170, 126], "Example roll", { show: 1 }));
  const which = method === "east-wall" ? "East's own wall" : "Count 8 seats counter-clockwise → dealer's left";
  items.push(label("which", [170, CAP1], which, { show: 2, tone: "brand", weight: 600, size: 12 }));
  items.push(label("cnt", [170, CAP2], `Count ${count} stacks from that wall's right end, then break`, { show: 3, size: 11 }));
  return { id: `break-${method}`, title: "The dealer rolls two dice to find where the wall is broken", w: W, h: HT, phases: 5, items };
}

// ---------- 6. dealing ----------
function dealing(dealerLabel: string): Scene {
  const items: SceneItem[] = [table(), ...seats({ C: dealerLabel })];
  const wallPos: Pt = [170, 117];
  items.push(label("wallL", [170, 98], "Wall", { tone: "muted" }));
  CCW.forEach((s, i) => {
    for (let j = 0; j < 4; j++) {
      const off = (j - 1.5) * 9;
      const dest: Pt = s === "B" || s === "D" ? [SPOT[s][0], SPOT[s][1] + off] : [SPOT[s][0] + off, SPOT[s][1]];
      const at: Pt[] = [wallPos, wallPos];
      for (let p = 2; p <= 6; p++) at.push(p >= i + 2 ? dest : wallPos);
      items.push(tile(`g${s}${j}`, at, back, { scale: 0.4, show: 1, hl: [i + 2] }));
    }
  });
  items.push(label("rounds", [170, CAP1], "4 tiles each, in turn — repeat 3 times", { show: 2, tone: "ink", size: 12 }));
  const counts: Record<Seat, string> = { C: "14", B: "13", A: "13", D: "13" };
  (Object.keys(counts) as Seat[]).forEach((s) => {
    const p = SEAT[s];
    const lp: Pt = s === "C" || s === "A" ? [p[0] - 46, p[1] + 4] : [p[0], p[1] + 32];
    items.push(label(`n${s}`, lp, `${counts[s]} tiles`, { show: 6, tone: s === "C" ? "brand" : "ink", weight: 600 }));
  });
  items.push(label("extra", [170, CAP2], "Then the dealer takes 2 more, everyone else 1", { show: 6, tone: "brand", weight: 600, size: 12 }));
  return { id: "deal", title: "Deal four tiles at a time in turn order, three rounds, then the dealer takes one extra", w: W, h: HT, phases: 7, items };
}

// ---------- 7. passing three tiles (Sichuan exchange / American Charleston) ----------
function passing(dir: "clockwise" | "counterclockwise" | "across", title: string, caption: string, id: string): Scene {
  const order = dir === "clockwise" ? CW : CCW;
  const dest = (s: Seat): Seat => (dir === "across" ? ({ A: "C", C: "A", B: "D", D: "B" } as Record<Seat, Seat>)[s] : order[(order.indexOf(s) + 1) % 4]);
  const items: SceneItem[] = [table(), ...seats()];
  (["A", "B", "C", "D"] as Seat[]).forEach((s) => {
    items.push(...threeBacks("p", s, [SPOT[s], SPOT[s], SPOT[dest(s)]]).map((it) => ({ ...it, hl: [1] })));
    const from = SEAT[s], to = SEAT[dest(s)];
    if (dir === "across") {
      // two parallel straight arrows per axis, offset so both directions are visible
      const off: Record<Seat, [Pt, Pt]> = {
        A: [[from[0] - 9, from[1] + 16], [to[0] - 9, to[1] - 16]],
        C: [[from[0] + 9, from[1] - 16], [to[0] + 9, to[1] + 16]],
        B: [[from[0] - 18, from[1] - 9], [to[0] + 18, to[1] - 9]],
        D: [[from[0] + 18, from[1] + 9], [to[0] - 18, to[1] + 9]],
      };
      items.push(straight(`a${s}`, off[s][0], off[s][1], { show: 1 }));
    } else items.push(arrow(`a${s}`, from, to, { show: 1, w: 0.32 }));
  });
  items.push(label("cap", [170, CAP1], caption, { show: 1, tone: "brand", weight: 700, size: 13 }));
  items.push(label("cap2", [170, CAP2], "Three tiles each, face down, all at the same time", { show: 1, size: 11 }));
  return { id, title, w: W, h: HT, phases: 3, long: [2], items };
}

// ---------- 8. draw & discard ----------
function drawDiscard(): Scene {
  const items: SceneItem[] = [];
  const hand = [T("c", 2), T("c", 3), T("c", 7), T("b", 4), T("b", 5), T("d", 1), T("d", 1)];
  hand.forEach((t, i) => items.push(tile(`h${i}`, i === 2 ? [[60 + i * 30, 186], [60 + i * 30, 186], [60 + i * 30, 186], [60 + i * 30, 186], [170, 110]] : [60 + i * 30, 186], t, { scale: 0.95, hl: i === 2 ? [3, 4] : undefined })));
  for (let i = 0; i < 8; i++) items.push(tile(`w${i}`, [80 + i * 24, 34], back, { scale: 0.8, dim: [2, 3, 4] }));
  items.push(tile("drawn", [[80 + 7 * 24 + 24, 34], [80 + 7 * 24 + 24, 34], [60 + 7 * 30 + 10, 186]], T("b", 6), { scale: 0.95, faceFrom: 2, hl: [1, 2] }));
  items.push(label("wl", [40, 38], "Wall", { anchor: "start" }));
  items.push(label("draw", [280, 112], "1. Draw", { show: 2, tone: "brand", weight: 700, size: 14 }));
  items.push(label("disc", [170, 148], "2. Discard (face up)", { show: 4, tone: "brand", weight: 700, size: 14 }));
  items.push(label("you", [24, 190], "You", { anchor: "start", tone: "ink", weight: 600 }));
  return { id: "draw-discard", title: "On your turn: draw one tile, then discard one tile face up", w: W, h: H, phases: 5, items };
}

// ---------- 9. melds ----------
function melds(variant: string): Scene {
  type Row = { name: string; base: TileSpec[]; claim: TileSpec; from: string; claimIndex: number; note?: string };
  const pung = (name: string): Row => ({ name, base: [T("d", 5), T("d", 5)], claim: T("d", 5), from: "any player", claimIndex: 2 });
  const kong = (name: string): Row => ({ name, base: [T("b", 8), T("b", 8), T("b", 8)], claim: T("b", 8), from: "any player", claimIndex: 3 });
  const chi = (name: string): Row => ({ name, base: [T("c", 3), T("c", 5)], claim: T("c", 4), from: "left player only", claimIndex: 1 });
  const rows: Row[] =
    variant === "riichi" ? [chi("Chi"), pung("Pon"), kong("Kan")]
    : variant === "cantonese" ? [chi("Chow"), pung("Pung"), kong("Kong")]
    : variant === "american" ? [{ name: "Pung with a joker", base: [T("d", 5), { k: "joker" }], claim: T("d", 5), from: "any player", claimIndex: 2 }, { name: "Kong", base: [T("b", 8), T("b", 8), { k: "joker" }], claim: T("b", 8), from: "any player", claimIndex: 3 }]
    : [pung("Pung"), kong("Kong")];
  const items: SceneItem[] = [];
  rows.forEach((r, ri) => {
    const y = 44 + ri * (rows.length === 2 ? 80 : 62);
    const x0 = 120;
    const all = [...r.base];
    all.splice(r.claimIndex, 0, r.claim);
    let bi = 0;
    all.forEach((t, i) => {
      const final: Pt = [x0 + i * 30, y];
      if (i === r.claimIndex) items.push(tile(`m${ri}c`, [[300, y], [300, y], ...Array(ri).fill([300, y]), final], t, { scale: 0.95, hl: [ri + 2], show: 0 }));
      else items.push(tile(`m${ri}b${bi++}`, final, t, { scale: 0.95 }));
    });
    items.push(label(`mn${ri}`, [16, y + 4], r.name, { anchor: "start", tone: "ink", weight: 700, size: 13 }));
    items.push(label(`mf${ri}`, [16, y + 20], `from ${r.from}`, { anchor: "start", size: 11 }));
  });
  if (variant === "sichuan") items.push(label("nochow", [170, 214], "No chow in Sichuan — runs only from your own draws", { tone: "brand", weight: 600, size: 11 }));
  if (variant === "american") items.push(label("j", [170, 214], "Jokers: only in groups of 3+, never singles or pairs", { tone: "brand", weight: 600, size: 11 }));
  return { id: `melds-${variant}`, title: "Claiming a discard to complete a set", w: W, h: H, phases: rows.length + 2, items };
}

// ---------- 10. winning hand ----------
function winning(variant: string): Scene {
  const sets: TileSpec[][] = variant === "sichuan"
    ? [[T("c", 1), T("c", 2), T("c", 3)], [T("c", 7), T("c", 7), T("c", 7)], [T("d", 3), T("d", 4), T("d", 5)], [T("d", 6), T("d", 7), T("d", 8)], [T("d", 9), T("d", 9)]]
    : [[T("c", 1), T("c", 2), T("c", 3)], [T("b", 5), T("b", 5), T("b", 5)], [T("d", 4), T("d", 5), T("d", 6)], [dragon("R"), dragon("R"), dragon("R")], [T("b", 9), T("b", 9)]];
  const items: SceneItem[] = [];
  let k = 0;
  const flat: Pt[] = [];
  sets.forEach((g, gi) => g.forEach((_, ti) => flat.push([0, 0])));
  sets.forEach((g, gi) => {
    const gx = gi < 4 ? 26 + gi * 78 : 0;
    g.forEach((t, ti) => {
      const row: Pt = [18 + k * 22.5, 70];
      const grouped: Pt = gi < 4 ? [gx + ti * 22, 110] : [143 + ti * 26, 170];
      items.push(tile(`w${k}`, [row, row, grouped], t, { scale: 0.88, hl: [2 + gi] }));
      k++;
    });
    items.push(label(`gl${gi}`, gi < 4 ? [gx + 22, 140] : [170, 200], gi < 4 ? "set" : "pair", { show: 2 + gi, tone: "brand", weight: 600 }));
  });
  const note = variant === "riichi" ? "4 sets + a pair, AND at least one yaku" : variant === "cantonese" ? "4 sets + a pair, worth your minimum faan" : variant === "sichuan" ? "4 sets + a pair — two suits only (no missing suit)" : "4 sets + a pair";
  items.push(label("note", [170, 30], note, { show: 7, tone: "ink", weight: 700, size: 13 }));
  return { id: `win-${variant}`, title: "A winning hand: four sets and a pair", w: W, h: H, phases: 8, items };
}

// ---------- 11. special scenes ----------
function deadWall(): Scene {
  const n = 17, tw = 17, x0 = (W - n * tw - 14) / 2;
  const items: SceneItem[] = [];
  for (let i = 0; i < n; i++) {
    const dead = i >= 9 && i < 16;
    const x = x0 + i * tw + tw / 2;
    const shifted = dead || i === 16 ? x + 14 : x;
    items.push(tile(`b${i}`, [[x, 120], [x, 120], [shifted, 120]], back, { scale: 0.7, hl: dead ? [2, 3] : undefined }));
    if (i === 11) items.push(tile("dora", [[x, 108], [x, 108], [shifted, 108], [shifted, 98]], T("c", 4), { scale: 0.7, faceFrom: 3, hl: [3] }));
    else items.push(tile(`t${i}`, [[x, 108], [x, 108], [shifted, 108]], back, { scale: 0.7, hl: dead ? [2, 3] : undefined }));
  }
  items.push(label("brk", [x0 + 9 * tw + 7, 82], "break", { show: 1, tone: "brand", weight: 600 }));
  items.push(straight("draw", [x0 + 9 * tw - 6, 158], [x0 + 8, 158], { show: 2, tone: "ink" }));
  items.push(label("drawL", [x0 + 4.5 * tw, 176], "Live wall: draw from here", { show: 2, tone: "ink", weight: 600, size: 11 }));
  items.push(label("deadL", [x0 + 12.5 * tw + 14, 158], "Dead wall: 7 stacks", { show: 2, tone: "brand", weight: 600, size: 11 }));
  items.push(label("doraL", [x0 + 11 * tw + 14, 60], "Dora indicator: 3rd stack, top tile", { show: 3, tone: "brand", weight: 600, size: 11 }));
  items.push(label("ex", [170, 208], "Indicator 4 Characters → dora is 5 Characters", { show: 3, size: 11 }));
  return { id: "dead-wall", title: "Set aside the 7-stack dead wall and flip the dora indicator", w: W, h: H, phases: 4, items };
}

function flowerReplace(): Scene {
  const items: SceneItem[] = [];
  const hand: TileSpec[] = [T("c", 2), T("c", 3), T("b", 5), { k: "flower", n: 2 }, T("b", 7), T("d", 4), T("d", 4), wind("E")];
  hand.forEach((t, i) => {
    const p: Pt = [50 + i * 32, 190];
    if (i === 3) items.push(tile("flower", [p, p, [90, 112]], t, { scale: 0.95, hl: [1, 2] }));
    else items.push(tile(`h${i}`, p, t, { scale: 0.95 }));
  });
  for (let i = 0; i < 8; i++) items.push(tile(`w${i}`, [96 + i * 24, 40], back, { scale: 0.8 }));
  items.push(tile("rep", [[96 + 8 * 24, 40], [96 + 8 * 24, 40], [96 + 8 * 24, 40], [146, 190]], T("d", 7), { scale: 0.95, faceFrom: 3, hl: [3] }));
  items.push(label("faceup", [90, 146], "Bonus: face up in front of you", { show: 2, tone: "ink", weight: 600, size: 11 }));
  items.push(label("end", [268, 74], "Replace from the END of the wall", { show: 3, tone: "brand", weight: 600, size: 11 }));
  items.push(label("you", [20, 194], "You", { anchor: "start", tone: "ink", weight: 600 }));
  return { id: "flower-replace", title: "Put a flower or season face up and draw a replacement from the end of the wall", w: W, h: H, phases: 4, items };
}

function dingQue(): Scene {
  const items: SceneItem[] = [];
  const hand: TileSpec[] = [T("c", 2), T("c", 3), T("c", 4), T("c", 7), T("c", 7), T("b", 3), T("b", 6), T("d", 1), T("d", 2), T("d", 3), T("d", 5), T("d", 5), T("d", 9)];
  let bi = 0;
  hand.forEach((t, i) => {
    const p: Pt = [22 + i * 24.5, 150];
    if (t.k === "b") { items.push(tile(`b${i}`, [p, p, [150 + bi * 26, 62]], t, { scale: 0.85, hl: [1, 2] })); bi++; }
    else items.push(tile(`h${i}`, p, t, { scale: 0.85 }));
  });
  items.push(label("ex", [170, 196], "Example: Bamboo chosen as the missing suit", { show: 1, tone: "ink", weight: 600, size: 12 }));
  items.push(label("disc", [176, 98], "Discard these first", { show: 2, tone: "brand", weight: 600, size: 12 }));
  items.push(label("win", [170, 214], "Win using only the other two suits", { show: 2, size: 11 }));
  return { id: "ding-que", title: "Choose one suit to give up and discard it first", w: W, h: H, phases: 3, items };
}

function charlestonCard(): Scene {
  const items: SceneItem[] = [
    { id: "card", kind: "zone", at: [60, 24], w: 220, h: 120, tone: "muted" },
    label("ct", [170, 44], "Your NMJL card (current year)", { tone: "ink", weight: 700, size: 12 }),
    label("cn", [170, 132], "Hands are not shown here — use your own card", { size: 10 }),
  ];
  for (let i = 0; i < 4; i++) items.push({ id: `line${i}`, kind: "zone", at: [78, 56 + i * 17], w: 184 - (i % 2) * 40, h: 8, tone: "muted", hl: i === 1 || i === 2 ? [1, 2] : undefined });
  const rack: TileSpec[] = [T("d", 5), T("d", 5), T("d", 6), dragon("R"), dragon("R"), { k: "flower", n: 1 }, { k: "joker" }, wind("N", true)];
  rack.forEach((t, i) => items.push(tile(`r${i}`, [56 + i * 32, 182], t, { scale: 0.9, hl: i < 5 ? [2] : undefined })));
  items.push({ id: "rack", kind: "zone", at: [36, 200], w: 268, h: 10, tone: "muted" });
  items.push(label("pick", [170, 226], "Pick 2–3 card hands your tiles could become", { show: 2, tone: "brand", weight: 600, size: 11 }));
  return { id: "american-card", title: "Look over your card and pick target hands", w: W, h: H, phases: 3, items };
}

function jokers(): Scene {
  const items: SceneItem[] = [];
  const ok: TileSpec[] = [T("d", 5), T("d", 5), { k: "joker" }];
  const bad: TileSpec[] = [{ k: "flower", n: 1 }, { k: "joker" }];
  ok.forEach((t, i) => items.push(tile(`o${i}`, [110 + i * 32, 70], t, { hl: i === 2 ? [1] : undefined })));
  bad.forEach((t, i) => items.push(tile(`x${i}`, [126 + i * 32, 160], t, { hl: i === 1 ? [2] : undefined, dim: [2] })));
  items.push(label("ol", [20, 74], "Pung", { anchor: "start", tone: "ink", weight: 700, size: 13 }));
  items.push(label("ov", [230, 74], "✓ joker allowed", { anchor: "start", show: 1, tone: "brand", weight: 700 }));
  items.push(label("xl", [20, 164], "Pair", { anchor: "start", tone: "ink", weight: 700, size: 13 }));
  items.push(label("xv", [210, 164], "✗ no joker in a pair", { anchor: "start", show: 2, tone: "ink", weight: 700 }));
  return { id: "jokers", title: "Jokers work in groups of three or more, never in pairs or singles", w: W, h: H, phases: 3, items };
}

function redFives(): Scene {
  const items: SceneItem[] = [T("c", 5, true), T("d", 5, true), T("b", 5, true)].map((t, i) => tile(`r${i}`, [120 + i * 50, 100], t, { scale: 1.2, hl: [1] }));
  items.push(label("l", [170, 160], "Red fives (if your set has them) count as bonus dora", { show: 1, tone: "ink", weight: 600, size: 12 }));
  return { id: "red-fives", title: "Red fives are optional bonus tiles", w: W, h: H, phases: 2, items };
}

// ---------- registry ----------
export function buildScene(id: string, decisions: Record<string, string> = {}): Scene | null {
  switch (id) {
    case "sort-sichuan": return tileSorting("sichuan");
    case "sort-riichi": return tileSorting("riichi");
    case "sort-cantonese": return tileSorting("cantonese");
    case "sort-american": return tileSorting("american");
    case "turn": return turnOrder(false);
    case "turn-winds": return turnOrder(true);
    case "wall-sichuan": return wall(14, "Sichuan: two walls of 14, two of 13");
    case "wall-17": return wall(17, "Riichi: 4 walls × 17 = 136 tiles");
    case "wall-18": return wall(18, "Hong Kong: 4 walls × 18 = 144 tiles");
    case "wall-19": return wall(19, "American: 4 walls × 19 = 152 tiles");
    case "dealer-dice": return dealerDice();
    case "break-sichuan": return wallBreak("sichuan");
    case "break-riichi": return wallBreak("riichi");
    case "break-hk": return wallBreak("seat-total");
    case "break-american": return wallBreak("east-wall");
    case "deal": return dealing("Dealer");
    case "deal-east": return dealing("East");
    case "exchange": {
      const d = (decisions.exchangeDir || "clockwise") as "clockwise" | "counterclockwise" | "across";
      const cap = d === "across" ? "Pass across the table" : d === "clockwise" ? "Pass clockwise" : "Pass counter-clockwise";
      return passing(d, "Everyone passes three tiles of one suit, face down, at the same time", cap, `exchange-${d}`);
    }
    case "exchange-preview": return passing("counterclockwise", "Example: everyone passes three tiles in one shared direction", "One shared direction", "exchange-preview");
    case "charleston-right": return passing("counterclockwise", "Charleston: pass three tiles to the player on your right", "Pass RIGHT", "ch-right");
    case "charleston-across": return passing("across", "Charleston: pass three tiles to the player across", "Pass ACROSS", "ch-across");
    case "charleston-left": return passing("clockwise", "Charleston: pass three tiles to the player on your left", "Pass LEFT", "ch-left");
    case "draw-discard": return drawDiscard();
    case "melds-sichuan": return melds("sichuan");
    case "melds-riichi": return melds("riichi");
    case "melds-cantonese": return melds("cantonese");
    case "melds-american": return melds("american");
    case "win-sichuan": return winning("sichuan");
    case "win-riichi": return winning("riichi");
    case "win-cantonese": return winning("cantonese");
    case "dead-wall": return deadWall();
    case "flower-replace": return flowerReplace();
    case "ding-que": return dingQue();
    case "american-card": return charlestonCard();
    case "jokers": return jokers();
    case "red-fives": return redFives();
  }
  return null;
}
