/**
 * Mahjong Together — instructional art for the three Sichuan preparation steps.
 *
 * ONE tile drawing system (same geometry, palette, thickness and soft shadow everywhere), used by:
 *  - the in-app animated scenes (components/tutorial/ArtVisual.tsx), and
 *  - the static asset files in /public/mahjong-tutorial/ (scripts/generate-tutorial-assets.mjs).
 * A scene is pure data: items whose position / visibility / highlight change per phase. No people, no hands,
 * no interface text baked in (captions live in the page DOM). Tile counts and faces follow the 108-tile
 * Sichuan set: Characters, Bamboo and Dots 1–9, four copies each.
 */

export type Pt = [number, number];
export type Suit = "c" | "b" | "d";
export type Face =
  | { s: Suit; n: number }
  | { wind: "E" | "S" | "W" | "N" }
  | { dragon: "R" | "G" | "Wh" }
  | { flower: 1 | 2 | 3 | 4 }
  | { season: 1 | 2 | 3 | 4 }
  | "back";

export interface Palette { brand: string; ink: string; muted: string; line: string; surface: string; bg: string }
export const STATIC_PALETTE: Palette = { brand: "#357528", ink: "#1C1C1E", muted: "#8E8E93", line: "#E3E3E8", surface: "#F5F5F7", bg: "#FFFFFF" };
export const CSS_PALETTE: Palette = { brand: "var(--brand)", ink: "var(--fg)", muted: "var(--muted)", line: "var(--line)", surface: "var(--surface)", bg: "var(--bg)" };

export interface ArtItem {
  id: string;
  art: string; // inner SVG markup drawn around (0,0)
  at: Pt | Pt[]; // position per phase (the last value repeats)
  scale?: number | number[];
  show?: number; // first visible phase
  hide?: number; // hidden from this phase
  dim?: number[]; // phases with reduced opacity (set aside / inactive)
  ring?: [number, number]; // brand outline drawn around the item in highlight phases
  hl?: number[];
}
export interface ArtScene { id: string; title: string; w: number; h: number; phases: number; long?: number[]; items: ArtItem[] }

// ---------------------------------------------------------------- tile drawing
const CJK = "'PingFang SC','Hiragino Sans GB','Noto Sans CJK SC','Source Han Sans SC','Microsoft YaHei',sans-serif";
const IVORY = "#FBF8F1", IVORY_EDGE = "#E6DFCD", IVORY_LINE = "#DDD5C1";
const BACK = "#2F6E28", BACK_DARK = "#1F4D1A", BACK_HI = "#3D8434"; // deep green, matching the brand green family
const RED = "#B8352A", GREEN = "#2D7A45", BLUE = "#1F4F8F", INK = "#1C2433";
const NUM = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
const WIND = { E: "東", S: "南", W: "西", N: "北" } as const;
const FLOWER = ["", "梅", "蘭", "菊", "竹"];
const SEASON = ["", "春", "夏", "秋", "冬"];
export const TILE_W = 30, TILE_H = 40, THICK = 5;

const r1 = (n: number) => Math.round(n * 10) / 10;

function stick(x: number, y: number, c: string, h = 9) {
  return `<rect x="${r1(x - 1.7)}" y="${r1(y - h / 2)}" width="3.4" height="${h}" rx="1.6" fill="${c}"/><rect x="${r1(x - 2.1)}" y="${r1(y - 0.6)}" width="4.2" height="1.2" rx=".6" fill="${c}"/>`;
}
function pip(x: number, y: number, r: number, c: string) {
  return `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r}" fill="${c}"/><circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r * 0.62)}" fill="${IVORY}"/><circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r * 0.3)}" fill="${c}"/>`;
}
function bird() {
  // 1 Bamboo is traditionally a bird: simplified silhouette (green body, red crest and wing accent)
  return `<path d="M-6 6 C-9 -1 -5 -9 2 -9 C6 -9 8 -6 7 -3 L10 -4 L8 0 C8 6 3 10 -2 10 C-4 10 -5 8 -6 6 Z" fill="${GREEN}"/>`
    + `<path d="M-3 -2 C0 -5 4 -3 4 1 C2 0 0 0 -3 -2 Z" fill="${RED}"/><circle cx="3.2" cy="-6.2" r="1.1" fill="${IVORY}"/>`
    + `<path d="M2 -9 L1 -12.5 L3.5 -10 L5 -12.5 L5 -9" fill="none" stroke="${RED}" stroke-width="1.1" stroke-linejoin="round"/>`
    + `<path d="M-6 6 L-11 12 M-5 8 L-8 13 M-3 9 L-4 14" stroke="${GREEN}" stroke-width="1.4" stroke-linecap="round"/>`;
}

function bambooFace(n: number) {
  const g = GREEN, r = RED;
  const L: Record<number, [number, number, string][]> = {
    2: [[0, -7, g], [0, 7, g]],
    3: [[0, -7, g], [-6, 7, g], [6, 7, g]],
    4: [[-6, -7, g], [6, -7, g], [-6, 7, g], [6, 7, g]],
    5: [[-7, -8, g], [7, -8, g], [0, 0, r], [-7, 8, g], [7, 8, g]],
    6: [[-7, -7, g], [0, -7, g], [7, -7, g], [-7, 7, g], [0, 7, g], [7, 7, g]],
    7: [[0, -10, r], [-7, 0, g], [0, 0, g], [7, 0, g], [-7, 10, g], [0, 10, g], [7, 10, g]],
    8: [[-8.5, -7, g], [-3, -7, g], [3, -7, g], [8.5, -7, g], [-8.5, 7, g], [-3, 7, g], [3, 7, g], [8.5, 7, g]],
    9: [[-7, -10, g], [0, -10, r], [7, -10, g], [-7, 0, g], [0, 0, r], [7, 0, g], [-7, 10, g], [0, 10, r], [7, 10, g]],
  };
  if (n === 1) return bird();
  const h = n >= 7 ? 8 : 9;
  return (L[n] || []).map(([x, y, c]) => stick(x, y, c, h)).join("");
}
function dotsFace(n: number) {
  const L: Record<number, [number, number, number, string][]> = {
    2: [[0, -7, 5.4, GREEN], [0, 7, 5.4, BLUE]],
    3: [[-7, -9, 4.6, BLUE], [0, 0, 4.6, RED], [7, 9, 4.6, GREEN]],
    4: [[-6, -7, 4.6, BLUE], [6, -7, 4.6, GREEN], [-6, 7, 4.6, GREEN], [6, 7, 4.6, BLUE]],
    5: [[-7, -9, 4, BLUE], [7, -9, 4, GREEN], [0, 0, 4, RED], [-7, 9, 4, GREEN], [7, 9, 4, BLUE]],
    6: [[-6, -10, 3.8, GREEN], [6, -10, 3.8, GREEN], [-6, 1, 3.8, RED], [6, 1, 3.8, RED], [-6, 11, 3.8, RED], [6, 11, 3.8, RED]],
    7: [[-8, -12, 3.3, GREEN], [0, -9, 3.3, GREEN], [8, -6, 3.3, GREEN], [-6, 3, 3.3, RED], [6, 3, 3.3, RED], [-6, 12, 3.3, RED], [6, 12, 3.3, RED]],
    8: [[-6, -12, 3.2, BLUE], [6, -12, 3.2, BLUE], [-6, -4, 3.2, BLUE], [6, -4, 3.2, BLUE], [-6, 4, 3.2, BLUE], [6, 4, 3.2, BLUE], [-6, 12, 3.2, BLUE], [6, 12, 3.2, BLUE]],
    9: [[-8, -11, 3.4, BLUE], [0, -11, 3.4, BLUE], [8, -11, 3.4, BLUE], [-8, 0, 3.4, RED], [0, 0, 3.4, RED], [8, 0, 3.4, RED], [-8, 11, 3.4, GREEN], [0, 11, 3.4, GREEN], [8, 11, 3.4, GREEN]],
  };
  if (n === 1)
    return `<circle r="11" fill="${BLUE}"/><circle r="8.6" fill="${IVORY}"/><circle r="7" fill="${GREEN}"/><circle r="5" fill="${IVORY}"/><circle r="3.4" fill="${RED}"/><circle r="1.4" fill="${IVORY}"/>`;
  return (L[n] || []).map(([x, y, r, c]) => pip(x, y, r, c)).join("");
}
const cjk = (t: string, y: number, size: number, c: string, weight = 500) =>
  `<text x="0" y="${y}" text-anchor="middle" font-size="${size}" font-weight="${weight}" fill="${c}" font-family="${CJK}">${t}</text>`;

function faceMarkup(f: Exclude<Face, "back">) {
  if ("s" in f) {
    if (f.s === "c") return cjk(NUM[f.n], -3, 12.5, INK, 600) + cjk("萬", 15, 14, RED, 600);
    if (f.s === "b") return bambooFace(f.n);
    return dotsFace(f.n);
  }
  if ("wind" in f) return cjk(WIND[f.wind], 7, 19, INK, 600);
  if ("dragon" in f)
    return f.dragon === "Wh"
      ? `<rect x="-8" y="-11" width="16" height="22" rx="2" fill="none" stroke="${BLUE}" stroke-width="1.6"/><rect x="-5.5" y="-8.5" width="11" height="17" rx="1.2" fill="none" stroke="${BLUE}" stroke-width=".9"/>`
      : cjk(f.dragon === "R" ? "中" : "發", 7, 19, f.dragon === "R" ? RED : GREEN, 600);
  if ("flower" in f) return cjk(FLOWER[f.flower], 6, 15, RED) + `<text x="-9" y="-10" font-size="6.5" fill="${INK}" font-family="Inter,system-ui,sans-serif">${f.flower}</text>`;
  return cjk(SEASON[f.season], 6, 15, BLUE) + `<text x="-9" y="-10" font-size="6.5" fill="${INK}" font-family="Inter,system-ui,sans-serif">${f.season}</text>`;
}

/** Standing tile seen from the front, centred on (0,0). Face-down tiles show the green back. */
export function tileArt(f: Face) {
  const x = -TILE_W / 2, y = -TILE_H / 2;
  const shadow = `<rect x="${x + 1}" y="${y + 6}" width="${TILE_W}" height="${TILE_H}" rx="6" fill="#000" opacity=".06"/><rect x="${x + 0.5}" y="${y + 4}" width="${TILE_W}" height="${TILE_H}" rx="5.5" fill="#000" opacity=".07"/>`;
  if (f === "back")
    return shadow
      + `<rect x="${x}" y="${y + THICK}" width="${TILE_W}" height="${TILE_H}" rx="5" fill="${BACK_DARK}"/>`
      + `<rect x="${x}" y="${y}" width="${TILE_W}" height="${TILE_H}" rx="5" fill="${BACK}"/>`
      + `<rect x="${x + 2}" y="${y + 1.5}" width="${TILE_W - 4}" height="3" rx="1.5" fill="${BACK_HI}" opacity=".7"/>`;
  return shadow
    + `<rect x="${x}" y="${y + THICK}" width="${TILE_W}" height="${TILE_H}" rx="5" fill="${BACK}"/>`
    + `<rect x="${x}" y="${y + 2.4}" width="${TILE_W}" height="${TILE_H}" rx="5" fill="${IVORY_EDGE}"/>`
    + `<rect x="${x}" y="${y}" width="${TILE_W}" height="${TILE_H}" rx="5" fill="${IVORY}" stroke="${IVORY_LINE}" stroke-width=".8"/>`
    + `<g>${faceMarkup(f)}</g>`;
}

/** A face-down tile lying in a wall, seen from above (horizontal wall: 10 wide along the wall, 14 deep). */
/** One stack (墩) seen from above: TWO face-down tiles, one on top of the other. Same material for both tiles;
 *  the lower tile and the upper tile's ivory body show as a stepped edge so the two layers read clearly. */
function stackTop(vertical: boolean) {
  const w = vertical ? 14 : 10, h = vertical ? 10 : 14;
  const rect = (dx: number, dy: number, fill: string) => `<rect x="${r1(-w / 2 + dx)}" y="${r1(-h / 2 + dy)}" width="${w}" height="${h}" rx="2" fill="${fill}"/>`;
  return `<g data-stack="" data-tiles="2">`
    + rect(1.6, 2.4, BACK) // lower tile (green back)
    + rect(0.8, 1.2, IVORY_EDGE) // upper tile's ivory body edge
    + rect(0, 0, BACK) // upper tile (green back)
    + `<rect x="${r1(-w / 2 + 1.5)}" y="${r1(-h / 2 + 1)}" width="${w - 3}" height="2" rx="1" fill="${BACK_HI}" opacity=".6"/>`
    + `</g>`;
}
export const STACK_STEP = 10.6;
export const WALLS = { top: 14, bottom: 14, left: 13, right: 13 } as const; // (14+14+13+13) × 2 = 108 tiles

/** One wall of `n` two-tile stacks, centred; `vertical` for the left/right walls. */
export function wallArt(id: string, n: number, vertical: boolean) {
  let s = `<g data-wall="${id}" data-stacks="${n}">`;
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * STACK_STEP;
    const [x, y] = vertical ? [0, off] : [off, 0];
    s += `<g transform="translate(${r1(x)} ${r1(y)})">${stackTop(vertical)}</g>`;
  }
  return s + `</g>`;
}

/** A tile lying face down seen from the side (face layer below, green back above). */
function sideTile(row = "", layer = "") {
  return `<g data-side="${row}" data-layer="${layer}">`+`<rect x="-9.6" y="-7" width="19.2" height="14" rx="2.4" fill="${IVORY}" stroke="#CFC6B0" stroke-width=".9"/><rect x="-9.6" y="-7" width="19.2" height="6.4" rx="2.4" fill="${BACK}"/><rect x="-9.6" y="-2.2" width="19.2" height="1.6" fill="${BACK}"/></g>`;
}

function arrowArt(from: Pt, ctrl: Pt | null, to: Pt, color: string, width = 2) {
  const d = ctrl ? `M${from[0]} ${from[1]} Q${ctrl[0]} ${ctrl[1]} ${to[0]} ${to[1]}` : `M${from[0]} ${from[1]} L${to[0]} ${to[1]}`;
  const [px, py] = ctrl || from;
  const a = Math.atan2(to[1] - py, to[0] - px);
  const L = 8, sp = 0.45;
  const h1: Pt = [to[0] - L * Math.cos(a - sp), to[1] - L * Math.sin(a - sp)];
  const h2: Pt = [to[0] - L * Math.cos(a + sp), to[1] - L * Math.sin(a + sp)];
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/><path d="M${r1(h1[0])} ${r1(h1[1])} L${to[0]} ${to[1]} L${r1(h2[0])} ${r1(h2[1])}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

const S = (s: Suit, n: number): Face => ({ s, n });
const T = (id: string, f: Face, at: Pt | Pt[], o: Partial<ArtItem> = {}): ArtItem => ({ id, art: tileArt(f), at, ...o });

// ---------------------------------------------------------------- scenes
/** Step 1 main: suited tiles sort into Characters · Bamboo · Dots (captions below in the DOM, in that order). */
function s1Main(): ArtScene {
  const groups: Face[][] = [[S("c", 1), S("c", 5), S("c", 9)], [S("b", 2), S("b", 5), S("b", 8)], [S("d", 1), S("d", 5), S("d", 9)]];
  const cx = [57, 170, 283];
  const start: Pt[] = [[150, 52], [62, 108], [262, 58], [232, 112], [36, 54], [120, 110], [298, 106], [196, 56], [176, 112]];
  const items: ArtItem[] = [];
  let k = 0;
  groups.forEach((g, gi) => g.forEach((f, i) => {
    items.push(T(`t${gi}${i}`, f, [start[k], start[k], [cx[gi] + (i - 1) * 32, 80]]));
    k++;
  }));
  return { id: "step-1-prepare-tiles", title: "Characters, Bamboo and Dots tiles sorted into three groups.", w: 340, h: 150, phases: 3, long: [2], items };
}

/** Step 1 help A: the complete set of 27 suited tile types (×4 each = 108). */
function s1Types(pal: Palette): ArtScene {
  const items: ArtItem[] = [];
  (["c", "b", "d"] as Suit[]).forEach((s, row) => {
    for (let n = 1; n <= 9; n++) items.push(T(`${s}${n}`, S(s, n), [42 + (n - 1) * 29, 34 + row * 54], { scale: 0.86 }));
    items.push({ id: `x${s}`, art: `<text x="0" y="5" text-anchor="middle" font-size="14" font-weight="600" fill="${pal.muted}" font-family="Inter,system-ui,sans-serif">×4</text>`, at: [314, 34 + row * 54] });
  });
  return { id: "step-1-help-27-types", title: "All 27 suited tile types: Characters, Bamboo and Dots 1 to 9. Four of each make 108 tiles.", w: 340, h: 176, phases: 1, items };
}

/** Step 1 help B: keep the three suits (left), set aside Winds, Dragons, Flowers and Seasons (right). */
function s1Select(pal: Palette): ArtScene {
  const keep: Face[] = [S("c", 2), S("c", 5), S("c", 8), S("b", 3), S("b", 6), S("b", 9), S("d", 2), S("d", 4), S("d", 7)];
  const out: Face[] = [{ wind: "E" }, { wind: "S" }, { wind: "W" }, { wind: "N" }, { dragon: "R" }, { dragon: "G" }, { dragon: "Wh" }, { flower: 1 }, { season: 1 }];
  const mixed = [0, 9, 1, 10, 2, 11, 3, 12, 4, 13, 5, 14, 6, 15, 7, 16, 8, 17]; // interleave keep / out
  const slot = (i: number): Pt => [34 + (i % 6) * 54.4, 40 + Math.floor(i / 6) * 52];
  const items: ArtItem[] = [
    { id: "zone-keep", art: `<rect x="-104" y="-80" width="208" height="160" rx="14" fill="none" stroke="${pal.line}" stroke-width="1.2"/>`, at: [116, 92], show: 2 },
    { id: "zone-out", art: `<rect x="-52" y="-80" width="104" height="160" rx="14" fill="none" stroke="${pal.line}" stroke-width="1.2" stroke-dasharray="5 4"/>`, at: [278, 92], show: 2 },
    { id: "mark", art: `<circle r="9" fill="${pal.bg}" stroke="${pal.muted}" stroke-width="1.2"/><path d="M-3.4 -3.4 L3.4 3.4 M3.4 -3.4 L-3.4 3.4" stroke="${pal.muted}" stroke-width="1.6" stroke-linecap="round"/>`, at: [324, 14], show: 3 },
  ];
  const all = [...keep.map((f, i) => ({ f, id: `k${i}`, final: [50 + (i % 3) * 33, 40 + Math.floor(i / 3) * 52] as Pt, out: false })),
    ...out.map((f, i) => ({ f, id: `o${i}`, final: [248 + (i % 3) * 30, 40 + Math.floor(i / 3) * 52] as Pt, out: true }))];
  mixed.forEach((idx, pos) => {
    const t = all[idx];
    items.push(T(t.id, t.f, [slot(pos), slot(pos), t.final], { scale: 0.8, dim: t.out ? [2, 3] : undefined }));
  });
  return { id: "step-1-help-tile-selection", title: "Suited tiles stay together; Winds, Dragons, Flowers and Seasons are moved aside.", w: 340, h: 186, phases: 4, long: [2], items };
}

/** Step 2 main: four walls, each 13 two-tile stacks + 1 single tile (27), arranged around an empty centre. */
function s2Main(pal: Palette): ArtScene {
  // Staggered (pinwheel) square: each wall starts at one outer corner and runs along its side until it meets the
  // next wall. Top/bottom: 14 stacks; left/right: 13 stacks; all stacks two tiles high → 108 tiles.
  const c: Pt = [170, 140], D = 14, Lh = WALLS.top * STACK_STEP, Lv = WALLS.left * STACK_STEP;
  const W = Lh + D, H = Lv + D, left = c[0] - W / 2, right = c[0] + W / 2, top = c[1] - H / 2, bottom = c[1] + H / 2;
  const walls: { id: keyof typeof WALLS; v: boolean; at: Pt; out: Pt }[] = [
    { id: "top", v: false, at: [left + Lh / 2, top + D / 2], out: [0, -30] },
    { id: "right", v: true, at: [right - D / 2, top + Lv / 2], out: [30, 0] },
    { id: "bottom", v: false, at: [right - Lh / 2, bottom - D / 2], out: [0, 30] },
    { id: "left", v: true, at: [left + D / 2, bottom - Lv / 2], out: [-30, 0] },
  ];
  const items: ArtItem[] = [
    { id: "table", art: `<rect x="-112" y="-112" width="224" height="224" rx="18" fill="${pal.surface}" stroke="${pal.line}" stroke-width="1"/>`, at: c },
    // Walls start slightly outside (faint), then slide into their staggered positions and stay there.
    ...walls.map((w) => {
      const from: Pt = [r1(w.at[0] + w.out[0]), r1(w.at[1] + w.out[1])];
      return { id: `wall-${w.id}`, art: wallArt(w.id, WALLS[w.id], w.v), at: [from, from, [r1(w.at[0]), r1(w.at[1])]] as Pt[], dim: [0, 1] };
    }),
  ];
  return { id: "step-2-build-wall", title: "Four walls of two-tile stacks: 14 at the top and bottom, 13 on the left and right — 108 tiles in total.", w: 340, h: 280, phases: 3, long: [2], items };
}

/** Step 2 help (side view): single tiles are stacked into two-tile stacks — a 14-stack wall and a 13-stack wall. */
function s2Stack(pal: Palette): ArtScene {
  const items: ArtItem[] = [];
  const rows: { id: string; n: number; y: number }[] = [{ id: "long", n: 14, y: 76 }, { id: "short", n: 13, y: 168 }];
  for (const row of rows) {
    items.push({ id: `ground-${row.id}`, art: `<line x1="-152" y1="0" x2="152" y2="0" stroke="${pal.line}" stroke-width="1.2"/>`, at: [170, row.y + 8] });
    const x = (i: number) => r1(170 + (i - (row.n - 1) / 2) * 21);
    for (let i = 0; i < row.n; i++) {
      items.push({ id: `${row.id}-b${i}`, art: sideTile(`${row.id}`, "bottom"), at: [x(i), row.y] });
      items.push({ id: `${row.id}-t${i}`, art: sideTile(`${row.id}`, "top"), at: [[x(i), row.y - 44], [x(i), row.y - 44], [x(i), row.y - 13]] });
    }
  }
  return { id: "step-2-help-wall-stacking", title: "Single tiles are stacked two high: a top or bottom wall has 14 stacks, a left or right wall has 13.", w: 340, h: 190, phases: 3, long: [2], items };
}

const NEXT: Record<string, Record<string, string>> = {
  clockwise: { C: "D", D: "A", A: "B", B: "C" }, // pass to the player on your left
  counterclockwise: { C: "B", B: "A", A: "D", D: "C" }, // pass to the player on your right
  across: { C: "A", A: "C", B: "D", D: "B" },
};
export const DIR_TEXT: Record<string, { short: string; who: string }> = {
  clockwise: { short: "Pass left", who: "the player on your left" },
  counterclockwise: { short: "Pass right", who: "the player on your right" },
  across: { short: "Pass across", who: "the player across from you" },
};

/** Step 3 main (your view): three Bamboo tiles are chosen as one group and passed together. */
function s3Main(dir: string, pal: Palette): ArtScene {
  const hand: Face[] = [S("c", 3), S("c", 7), S("b", 2), S("b", 5), S("b", 8), S("d", 4), S("d", 6)];
  const target: Pt = dir === "clockwise" ? [66, 58] : dir === "counterclockwise" ? [274, 58] : [170, 44];
  const items: ArtItem[] = [];
  const arrowCtrl: Pt = dir === "across" ? [170, 100] : dir === "clockwise" ? [110, 120] : [230, 120];
  const arrowTo: Pt = dir === "across" ? [170, 78] : dir === "clockwise" ? [72, 92] : [268, 92];
  items.push({ id: "arrow", art: arrowArt([170, 122], arrowCtrl, arrowTo, pal.brand), at: [0, 0], show: 1 });
  hand.forEach((f, i) => {
    const x = 170 + (i - 3) * 32;
    if (f !== "back" && "s" in f && f.s === "b") {
      const k = i - 3; // -1, 0, 1
      items.push(T(`h${i}`, f, [[x, 160], [x, 148], [target[0] + k * 29, target[1]]], { scale: [1, 1, 0.9] }));
    } else items.push(T(`h${i}`, f, [x, 160], { dim: [2] }));
  });
  items.push({ id: "group", art: `<rect x="-52" y="-27" width="104" height="58" rx="10" fill="none" stroke="${pal.brand}" stroke-width="1.6"/>`, at: [[170, 150], [170, 148], [target[0], target[1]]], scale: [1, 1, 0.9], show: 1 });
  return { id: `step-3-exchange-tiles-${dir}`, title: `Three Bamboo tiles chosen as one group and passed together: ${DIR_TEXT[dir]?.who || "in the direction shown"}.`, w: 340, h: 196, phases: 3, long: [2], items };
}

/** Step 3 help: correct (same suit) or incorrect (mixed suits) example group. */
function s3Example(ok: boolean, pal: Palette): ArtScene {
  const faces: Face[] = ok ? [S("b", 2), S("b", 5), S("b", 8)] : [S("c", 3), S("b", 5), S("d", 7)];
  const items: ArtItem[] = [
    { id: "ring", art: `<rect x="-58" y="-30" width="116" height="64" rx="12" fill="none" stroke="${ok ? pal.brand : pal.muted}" stroke-width="1.6" ${ok ? "" : 'stroke-dasharray="5 4"'}/>`, at: [80, 44] },
    ...faces.map((f, i) => T(`t${i}`, f, [80 + (i - 1) * 34, 42])),
  ];
  return { id: ok ? "step-3-help-same-suit" : "step-3-help-mixed-suits", title: ok ? "Correct: three Bamboo tiles, one suit." : "Incorrect: a Character, a Bamboo and a Dot — mixed suits.", w: 160, h: 86, phases: 1, items };
}

/** Step 3 help: overhead table, four groups of three move together to the next seat in the drawn direction. */
function s3Dir(dir: string, pal: Palette): ArtScene {
  const c: Pt = [170, 136];
  const seat: Record<string, Pt> = { A: [170, 26], B: [312, 136], C: [170, 246], D: [28, 136] };
  const across = dir === "across";
  const slot: Record<string, Pt> = across
    ? { A: [150, 80], B: [226, 116], C: [190, 192], D: [114, 156] }
    : { A: [170, 80], B: [226, 136], C: [170, 192], D: [114, 136] };
  const next = NEXT[dir] || NEXT.counterclockwise;
  const land = (from: string): Pt => {
    const to = next[from];
    if (!across) return slot[to];
    // parallel lanes so packets crossing the table never overlap
    return from === "A" ? [150, 192] : from === "C" ? [190, 80] : from === "B" ? [114, 116] : [226, 156];
  };
  const items: ArtItem[] = [
    { id: "table", art: `<rect x="-96" y="-96" width="192" height="192" rx="18" fill="${pal.surface}" stroke="${pal.line}" stroke-width="1"/>`, at: c },
  ];
  for (const s of ["A", "B", "C", "D"]) {
    const me = s === "C";
    items.push({ id: `seat-${s}`, art: `<circle r="10" fill="${me ? pal.brand : pal.bg}" stroke="${me ? pal.brand : pal.muted}" stroke-width="1.4"/>`
      + (me ? `<text x="0" y="27" text-anchor="middle" font-size="12" font-weight="600" fill="${pal.ink}" font-family="Inter,system-ui,sans-serif">You</text>` : ""), at: seat[s] });
  }
  for (const s of ["A", "B", "C", "D"]) {
    const from = slot[s], to = land(s);
    const ctrl: Pt | null = across ? null : [(from[0] + to[0]) / 2 + (from[0] + to[0] - 2 * c[0]) * 0.55, (from[1] + to[1]) / 2 + (from[1] + to[1] - 2 * c[1]) * 0.55];
    const shrink = (p: Pt, q: Pt, d: number): Pt => { const L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1; return [r1(p[0] + ((q[0] - p[0]) * d) / L), r1(p[1] + ((q[1] - p[1]) * d) / L)]; };
    const a0 = shrink(from, ctrl || to, 26), a1 = shrink(to, ctrl || from, 26);
    items.push({ id: `arrow-${s}`, art: arrowArt(a0, ctrl, a1, pal.brand, 1.8), at: [0, 0], show: 1 });
    for (let i = 0; i < 3; i++) {
      const dx = (i - 1) * 15;
      items.push(T(`p${s}${i}`, "back", [[from[0] + dx, from[1]], [from[0] + dx, from[1]], [to[0] + dx, to[1]]], { scale: 0.5 }));
    }
  }
  return { id: `step-3-help-exchange-${dir}`, title: `Overhead view: every player passes a group of three tiles to ${DIR_TEXT[dir]?.who || "the next player"} at the same time.`, w: 340, h: 276, phases: 3, long: [2], items };
}

/** Step 4 main: three suits; one example missing suit (Bamboo) is outlined and set apart. */
function s4Main(pal: Palette): ArtScene {
  const groups: Face[][] = [[S("c", 2), S("c", 5), S("c", 8)], [S("b", 3), S("b", 6), S("b", 9)], [S("d", 2), S("d", 5), S("d", 8)]];
  const cx = [57, 170, 283];
  const items: ArtItem[] = [
    { id: "ring", art: `<rect x="-54" y="-31" width="108" height="66" rx="12" fill="none" stroke="${pal.brand}" stroke-width="1.6" stroke-dasharray="5 4"/>`, at: [[170, 80], [170, 72], [170, 72]], show: 1 },
  ];
  groups.forEach((g, gi) => g.forEach((f, i) => {
    const x = cx[gi] + (i - 1) * 32;
    items.push(T(`t${gi}${i}`, f, gi === 1 ? [[x, 80], [x, 72], [x, 72]] : [x, 80], { dim: gi === 1 ? [2] : undefined }));
  }));
  return { id: "step-4-ding-que", title: "Three suits: Characters, Bamboo and Dots. Bamboo is outlined as the example missing suit.", w: 340, h: 150, phases: 3, long: [2], items };
}

/** Step 4 help: Bamboo is the missing suit; its tiles leave the hand ONE PER TURN, then the hand has none left. */
function s4Help(pal: Palette): ArtScene {
  const hand: Face[] = [S("c", 3), S("c", 4), S("c", 5), S("b", 2), S("d", 2), S("d", 3), S("d", 4), S("b", 6), S("d", 7), S("d", 7), S("b", 9)];
  const step = 28, y = 150, sc = 0.82;
  const x0 = 170 - ((hand.length - 1) * step) / 2;
  const keep = hand.map((f, i) => ({ f, i })).filter(({ f }) => !(f !== "back" && "s" in f && f.s === "b"));
  const k0 = 170 - ((keep.length - 1) * step) / 2;
  const items: ArtItem[] = [
    { id: "pond", art: `<rect x="-78" y="-28" width="156" height="56" rx="12" fill="none" stroke="${pal.line}" stroke-width="1.2" stroke-dasharray="5 4"/>`, at: [170, 52] },
  ];
  let turn = 0;
  hand.forEach((f, i) => {
    const x = x0 + i * step;
    const bamboo = f !== "back" && "s" in f && f.s === "b";
    if (bamboo) {
      const t = turn++; // discarded on successive turns: phase 2, 3, 4
      const at: Pt[] = [];
      for (let ph = 0; ph <= 5; ph++) at.push(ph === 0 ? [x, y] : ph < 2 + t ? [x, y - 10] : [124 + t * 46, 52]);
      items.push(T(`h${i}`, f, at, { scale: sc }));
    } else {
      const k = keep.findIndex((e) => e.i === i);
      items.push(T(`h${i}`, f, [[x, y], [x, y], [x, y], [x, y], [x, y], [k0 + k * step, y]], { scale: sc, dim: [1] }));
    }
  });
  return { id: "step-4-help-ding-que", title: "Bamboo is the missing suit: its tiles are discarded one per turn until none remain in the hand.", w: 340, h: 186, phases: 6, items };
}

/** Winning-hand examples for the Win flow (two suits at most; no missing-suit tiles). */
export const WIN_EXAMPLES: Record<string, { title: string; groups: Face[][] }> = {
  standard: { title: "Standard Hand: four sets and a pair.", groups: [[S("c", 2), S("c", 3), S("c", 4)], [S("c", 5), S("c", 6), S("c", 7)], [S("d", 3), S("d", 4), S("d", 5)], [S("d", 7), S("d", 7), S("d", 7)], [S("c", 9), S("c", 9)]] },
  seven_pairs: { title: "Seven Pairs: seven different pairs.", groups: [[S("c", 1), S("c", 1)], [S("c", 3), S("c", 3)], [S("c", 5), S("c", 5)], [S("d", 2), S("d", 2)], [S("d", 4), S("d", 4)], [S("d", 6), S("d", 6)], [S("d", 8), S("d", 8)]] },
  all_pungs: { title: "All Pungs: four sets of three identical tiles and a pair.", groups: [[S("c", 2), S("c", 2), S("c", 2)], [S("c", 5), S("c", 5), S("c", 5)], [S("d", 7), S("d", 7), S("d", 7)], [S("d", 9), S("d", 9), S("d", 9)], [S("d", 3), S("d", 3)]] },
};
function winScene(key: string): ArtScene {
  const ex = WIN_EXAMPLES[key];
  const step = 21.5, gap = 7, scale = 0.68;
  const n = ex.groups.reduce((a, g) => a + g.length, 0);
  const width = (n - 1) * step + (ex.groups.length - 1) * gap;
  let x = 170 - width / 2;
  const items: ArtItem[] = [];
  ex.groups.forEach((g, gi) => {
    g.forEach((f, i) => { items.push(T(`w${gi}${i}`, f, [r1(x), 32], { scale })); x += step; });
    x += gap; // small gap between sets
  });
  return { id: `win-${key.replace("_", "-")}`, title: ex.title, w: 340, h: 66, phases: 1, items };
}

export function buildArtScene(id: string, pal: Palette, dir = "counterclockwise"): ArtScene | null {
  switch (id) {
    case "step-1-prepare-tiles": return s1Main();
    case "step-1-help-27-types": return s1Types(pal);
    case "step-1-help-tile-selection": return s1Select(pal);
    case "step-2-build-wall": return s2Main(pal);
    case "step-2-help-wall-stacking": return s2Stack(pal);
    case "step-3-exchange-tiles": return s3Main(dir, pal);
    case "step-3-help-same-suit": return s3Example(true, pal);
    case "step-3-help-mixed-suits": return s3Example(false, pal);
    case "step-3-help-exchange": return s3Dir(dir, pal);
    case "step-4-ding-que": return s4Main(pal);
    case "step-4-help-ding-que": return s4Help(pal);
    case "win-standard": return winScene("standard");
    case "win-seven-pairs": return winScene("seven_pairs");
    case "win-all-pungs": return winScene("all_pungs");
  }
  return null;
}

// ---------------------------------------------------------------- static rendering (asset files)
export const posAt = (it: ArtItem, phase: number): Pt => (Array.isArray(it.at[0]) ? (it.at as Pt[])[Math.min(phase, (it.at as Pt[]).length - 1)] : (it.at as Pt));
export const scaleAt = (it: ArtItem, phase: number) => (Array.isArray(it.scale) ? it.scale[Math.min(phase, it.scale.length - 1)] : it.scale ?? 1);
export const visibleAt = (it: ArtItem, phase: number) => phase >= (it.show ?? 0) && (it.hide === undefined || phase < it.hide);

export function renderStatic(scene: ArtScene, phase = scene.phases - 1, opts: { dx?: number; dy?: number; s?: number; wrap?: boolean } = {}): string {
  const body = scene.items.filter((it) => visibleAt(it, phase)).map((it) => {
    const [x, y] = posAt(it, phase);
    const op = it.dim?.includes(phase) ? ' opacity=".45"' : "";
    return `<g transform="translate(${x} ${y}) scale(${scaleAt(it, phase)})"${op}>${it.art}</g>`;
  }).join("");
  const inner = `<g transform="translate(${opts.dx || 0} ${opts.dy || 0}) scale(${opts.s || 1})">${body}</g>`;
  if (opts.wrap === false) return inner;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${scene.w} ${scene.h}" width="${scene.w * 2}" height="${scene.h * 2}" role="img" aria-label="${scene.title}"><title>${scene.title}</title>${inner}</svg>`;
}

/** Asset manifest: which visual each page and help view uses (in-app scenes and their static files). */
export const ASSET_MANIFEST = {
  "step-1": { main: "step-1-prepare-tiles", help: ["step-1-help-27-types", "step-1-help-tile-selection"] },
  "step-2": { main: "step-2-build-wall", help: ["step-2-help-wall-stacking", "step-2-build-wall"], file: "step-2-help-wall-construction" },
  "step-3": { main: "step-3-exchange-tiles", help: ["step-3-help-same-suit", "step-3-help-mixed-suits", "step-3-help-exchange"] },
  "step-4": { main: "step-4-ding-que", help: ["step-4-ding-que", "step-4-help-ding-que"] },
  win: { standard: "win-standard", seven_pairs: "win-seven-pairs", all_pungs: "win-all-pungs" },
} as const;
