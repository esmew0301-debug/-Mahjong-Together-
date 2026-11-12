import fs from "fs";
import { fileURLToPath } from "url";
const out = process.argv[2] || fileURLToPath(new URL("../public/illustrations", import.meta.url));
const FONT = `font-family="Inter, -apple-system, 'Segoe UI', Roboto, 'PingFang SC', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif"`;
const CJK = `font-family="'PingFang SC', 'Noto Sans CJK SC', 'Hiragino Sans GB', 'Microsoft YaHei', serif"`;
const INK = "#171717", MUTED = "#6B6B6B", LINE = "#CFCFCF", OK = "#16866A", GREEN_BADGE = "#2F7A3A";

function tile(x, y, inner, removed = false) {
  return `<g transform="translate(${x},${y})"${removed ? ' opacity="0.55"' : ""}>
  <rect x="0.75" y="0.75" width="30.5" height="40.5" rx="4.5" fill="#FFFFFF" stroke="${LINE}" stroke-width="1.5"/>
  ${inner}
  ${removed ? `<line x1="4" y1="37" x2="28" y2="4" stroke="${MUTED}" stroke-width="2" stroke-linecap="round"/>` : ""}
</g>`;
}
const glyph = (t, color = INK, size = 17, dy = 27) => `<text x="16" y="${dy}" text-anchor="middle" font-size="${size}" fill="${color}" ${CJK}>${t}</text>`;
const wan = (num) => `<text x="16" y="17" text-anchor="middle" font-size="12" fill="${INK}" ${CJK}>${num}</text><text x="16" y="34" text-anchor="middle" font-size="13" fill="#8A3B33" ${CJK}>万</text>`;
function dots(n) {
  const pos = { 1: [[16, 21]], 5: [[9, 10], [23, 10], [16, 21], [9, 32], [23, 32]], 9: [[8, 9], [16, 9], [24, 9], [8, 21], [16, 21], [24, 21], [8, 33], [16, 33], [24, 33]] }[n];
  const r = n === 1 ? 8 : n === 5 ? 4.2 : 3.2;
  return pos.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#2F5D50" stroke-width="1.6"/>`).join("");
}
function bamboo(n) {
  const cols = n === 2 ? [16] : n === 5 ? [9, 16, 23] : [9, 16, 23];
  const rows = n === 2 ? [[8, 19], [22, 33]] : n === 5 ? [[7, 19], [23, 35]] : [[6, 14], [17, 25], [28, 36]];
  let s = "";
  let count = 0;
  for (const [y1, y2] of rows) for (const x of cols) { if (count >= n) break; s += `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="#2F5D50" stroke-width="3" stroke-linecap="round"/>`; count++; }
  return s;
}
function row(y, label, sub, tiles, removed = false) {
  let s = `<text x="16" y="${y + 18}" font-size="14" font-weight="600" fill="${removed ? MUTED : INK}" ${FONT}>${label}</text>`;
  s += `<text x="16" y="${y + 35}" font-size="12" fill="${MUTED}" ${FONT}>${sub}</text>`;
  tiles.forEach((t, i) => (s += t === "…" ? `<text x="${160 + i * 38 + 15}" y="${y + 26}" text-anchor="middle" font-size="16" fill="${MUTED}" ${FONT}>…</text>` : tile(160 + i * 38, y, t, removed)));
  return s;
}
const check = (x, y) => `<circle cx="${x}" cy="${y}" r="9" fill="${OK}"/><path d="M${x - 4} ${y} l3 3 l5 -6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
const cross = (x, y) => `<circle cx="${x}" cy="${y}" r="9" fill="#8E8E8E"/><path d="M${x - 3.5} ${y - 3.5} l7 7 M${x + 3.5} ${y - 3.5} l-7 7" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`;

const keepY = 54, remY = 268;
const s1 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 500" width="360" height="500" role="img" aria-labelledby="t d">
<title id="t">Sichuan tile preparation</title>
<desc id="d">Keep 108 tiles: Characters (Wan), Bamboo (Tiao), and Dots (Tong), numbered 1 to 9, four of each. Remove East, South, West, North winds, Red, Green and White dragons, flowers and seasons, and jokers if present.</desc>
<rect width="360" height="500" rx="12" fill="#FFFFFF"/>
${check(25, 26)}<text x="42" y="31" font-size="15" font-weight="600" fill="${INK}" ${FONT}>KEEP — 108 TILES</text>
<text x="344" y="31" text-anchor="end" font-size="12" fill="${MUTED}" ${FONT}>1–9 × 4 each</text>
${row(keepY, "Characters 万", "Wan · 36 tiles", [wan("一"), wan("五"), "…", wan("九")])}
${row(keepY + 62, "Bamboo 条", "Tiao · 36 tiles", [bamboo(2), bamboo(5), "…", bamboo(9)])}
${row(keepY + 124, "Dots 筒", "Tong · 36 tiles", [dots(1), dots(5), "…", dots(9)])}
<line x1="16" y1="${remY - 28}" x2="344" y2="${remY - 28}" stroke="#E5E5E5"/>
${cross(25, remY - 2)}<text x="42" y="${remY + 3}" font-size="15" font-weight="600" fill="${INK}" ${FONT}>REMOVE</text>
${row(remY + 20, "Winds", "E · S · W · N", [glyph("東"), glyph("南"), glyph("西"), glyph("北")], true)}
${row(remY + 76, "Dragons", "Red · Green · White", [glyph("中", "#8A3B33"), glyph("發", "#2F5D50"), `<rect x="7" y="8" width="18" height="25" rx="2" fill="none" stroke="#5B7083" stroke-width="1.6"/>`], true)}
${row(remY + 132, "Flowers &amp; Seasons", "All bonus tiles", [glyph("梅", INK, 15), glyph("春", INK, 15)], true)}
${row(remY + 188 - 0, "Jokers", "If your set has them", [glyph("J", INK, 16)], true)}
</svg>`;
fs.writeFileSync(`${out}/sichuan-tile-selection.svg`, s1);

// ---------- Exchange three tiles ----------
const CX = 180, CY = 222;
const seat = { A: [CX, CY + 98], B: [CX + 98, CY], C: [CX, CY - 98], D: [CX - 98, CY] };
function faceDown(cx, cy, vertical) {
  let s = "";
  for (let i = -1; i <= 1; i++) {
    const x = vertical ? cx - 9 : cx + i * 17 - 7;
    const y = vertical ? cy + i * 17 - 7 : cy - 10;
    const w = vertical ? 18 : 14, h = vertical ? 14 : 20;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2.5" fill="#E3E3E3" stroke="#BDBDBD" stroke-width="1.2"/>`;
  }
  return s;
}
function seatMark(k) {
  const [x, y] = seat[k];
  const lab = { A: [x, y + 36, "middle"], C: [x, y - 26, "middle"], B: [x + 22, y + 4, "start"], D: [x - 22, y + 4, "end"] }[k];
  return `<circle cx="${x}" cy="${y}" r="16" fill="#FFFFFF" stroke="${INK}" stroke-width="1.5"/><text x="${x}" y="${y + 5}" text-anchor="middle" font-size="14" font-weight="600" fill="${INK}" ${FONT}>${k}</text>
<text x="${lab[0]}" y="${lab[1]}" text-anchor="${lab[2]}" font-size="12" fill="${MUTED}" ${FONT}>Player ${k}</text>`;
}
const arcCW = [
  `M${CX - 22} ${CY + 98} Q ${CX - 98} ${CY + 98} ${CX - 98} ${CY + 24}`, // A -> D
  `M${CX - 98} ${CY - 22} Q ${CX - 98} ${CY - 98} ${CX - 24} ${CY - 98}`, // D -> C
  `M${CX + 22} ${CY - 98} Q ${CX + 98} ${CY - 98} ${CX + 98} ${CY - 24}`, // C -> B
  `M${CX + 98} ${CY + 22} Q ${CX + 98} ${CY + 98} ${CX + 24} ${CY + 98}`, // B -> A
];
const reverse = (d) => { const m = d.match(/M(\S+) (\S+) Q (\S+) (\S+) (\S+) (\S+)/); return `M${m[5]} ${m[6]} Q ${m[3]} ${m[4]} ${m[1]} ${m[2]}`; };
function exchange(dir) {
  const label = { clockwise: "Clockwise (seen from above)", counterclockwise: "Counter-clockwise (seen from above)", across: "Across the table" }[dir];
  let arrows = "";
  if (dir === "across") {
    arrows = `<line x1="${CX - 7}" y1="${CY + 78}" x2="${CX - 7}" y2="${CY - 76}" stroke="${INK}" stroke-width="2" marker-end="url(#ah)"/><line x1="${CX + 7}" y1="${CY - 78}" x2="${CX + 7}" y2="${CY + 76}" stroke="${INK}" stroke-width="2" marker-end="url(#ah)"/>
<line x1="${CX + 78}" y1="${CY - 7}" x2="${CX - 76}" y2="${CY - 7}" stroke="${INK}" stroke-width="2" marker-end="url(#ah)"/><line x1="${CX - 78}" y1="${CY + 7}" x2="${CX + 76}" y2="${CY + 7}" stroke="${INK}" stroke-width="2" marker-end="url(#ah)"/>`;
  } else {
    const paths = dir === "clockwise" ? arcCW : arcCW.map(reverse);
    arrows = paths.map((d) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="2" marker-end="url(#ah)"/>`).join("");
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 420" width="360" height="420" role="img" aria-labelledby="t d">
<title id="t">Exchange Three Tiles — ${label}</title>
<desc id="d">Top-down view of four seats: Player A at the bottom, B on the right, C at the top, D on the left. Each player has three face-down tiles. Arrows show passing ${label.toLowerCase()}. Each player exchanges three tiles of the same suit and keeps the selection face down.</desc>
<defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${INK}"/></marker></defs>
<rect width="360" height="420" rx="12" fill="#FFFFFF"/>
<text x="180" y="30" text-anchor="middle" font-size="16" font-weight="600" fill="${INK}" ${FONT}>Exchange Three Tiles</text>
<text x="180" y="52" text-anchor="middle" font-size="13" fill="${MUTED}" ${FONT}>Direction: ${label}</text>
<rect x="${CX - 62}" y="${CY - 62}" width="124" height="124" rx="12" fill="#F7F7F8" stroke="#E5E5E5" stroke-width="1.5"/>
${faceDown(CX, CY + 42, false)}${faceDown(CX, CY - 42, false)}${faceDown(CX - 42, CY, true)}${faceDown(CX + 42, CY, true)}
${arrows}
${["A", "B", "C", "D"].map(seatMark).join("")}
<text x="180" y="384" text-anchor="middle" font-size="13" fill="${INK}" ${FONT}>Each player exchanges three tiles of the same suit.</text>
<text x="180" y="404" text-anchor="middle" font-size="13" fill="${MUTED}" ${FONT}>Keep your selection face down.</text>
</svg>`;
}
fs.writeFileSync(`${out}/exchange-three-tiles.svg`, exchange("clockwise"));
fs.writeFileSync(`${out}/exchange-three-tiles-counterclockwise.svg`, exchange("counterclockwise"));
fs.writeFileSync(`${out}/exchange-three-tiles-across.svg`, exchange("across"));

// =====================================================================
// Riichi / Hong Kong / American tutorial figures (original vector art)
// =====================================================================
const man = (num) => `<text x="16" y="17" text-anchor="middle" font-size="12" fill="${INK}" ${CJK}>${num}</text><text x="16" y="34" text-anchor="middle" font-size="13" fill="#8A3B33" ${CJK}>萬</text>`;
const red5 = (inner) => inner.replace(/#2F5D50/g, "#C0392B").replace(/#8A3B33/g, "#C0392B").replace(`fill="${INK}" ${CJK}>五`, `fill="#C0392B" ${CJK}>五`);
const blankWhite = `<rect x="7" y="8" width="18" height="25" rx="2" fill="none" stroke="#5B7083" stroke-width="1.6"/>`;
const esc = (t) => String(t).replace(/&(?!amp;|lt;|gt;)/g, "&amp;").replace(/</g, "&lt;");
const label = (x, y, t, size = 14, weight = 600, color = INK, anchor = "start") => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}" fill="${color}" ${FONT}>${esc(t)}</text>`;
function rowAt(y, title, sub, tiles, removed = false, x0 = 160) {
  let s = label(16, y + 18, title, 14, 600, removed ? MUTED : INK) + label(16, y + 35, sub, 12, 400, MUTED);
  tiles.forEach((t, i) => (s += t === "…" ? label(x0 + i * 38 + 15, y + 26, "…", 16, 400, MUTED, "middle") : tile(x0 + i * 38, y, t, removed)));
  return s;
}
function inventory({ title, desc, header, headerNote, rows, removeRows = [], height }) {
  let y = 54, body = "";
  for (const r of rows) { body += rowAt(y, r[0], r[1], r[2]); y += 58; }
  if (removeRows.length) {
    body += `<line x1="16" y1="${y + 4}" x2="344" y2="${y + 4}" stroke="#E5E5E5"/>${cross(25, y + 28)}${label(42, y + 33, "REMOVE", 15)}`;
    y += 46;
    for (const r of removeRows) { body += rowAt(y, r[0], r[1], r[2], true); y += 58; }
  }
  const H = height || y + 10;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 ${H}" width="360" height="${H}" role="img" aria-labelledby="t d">
<title id="t">${title}</title><desc id="d">${desc}</desc>
<rect width="360" height="${H}" rx="12" fill="#FFFFFF"/>
${check(25, 26)}${label(42, 31, header, 15)}${label(344, 31, headerNote, 12, 400, MUTED, "end")}
${body}</svg>`;
}
const seasons = (t) => glyph(t, "#2F5D50", 15);
const flower = (t) => glyph(t, "#8A3B33", 15);

fs.writeFileSync(`${out}/riichi-tiles.svg`, inventory({
  title: "Riichi tile set", header: "KEEP — 136 TILES", headerNote: "4 of each",
  desc: "Keep Manzu (characters), Pinzu (dots) and Souzu (bamboo) 1 to 9, the four winds and the three dragons, four of each: 136 tiles. Red fives are optional. Remove flowers, seasons and jokers.",
  rows: [
    ["Manzu 萬", "Characters · 1–9", [man("一"), man("五"), "…", man("九")]],
    ["Pinzu 筒", "Dots · 1–9", [dots(1), dots(5), "…", dots(9)]],
    ["Souzu 索", "Bamboo · 1–9", [bamboo(2), bamboo(5), "…", bamboo(9)]],
    ["Winds", "E · S · W · N", [glyph("東"), glyph("南"), glyph("西"), glyph("北")]],
    ["Dragons", "White · Green · Red", [blankWhite, glyph("發", "#2F5D50"), glyph("中", "#8A3B33")]],
    ["Red fives (optional)", "Only if your group agreed", [red5(man("五")), red5(dots(5)), red5(bamboo(5))]],
  ],
  removeRows: [["Flowers & Seasons", "Not used in Riichi", [flower("梅"), seasons("春")]], ["Jokers", "If your set has them", [glyph("J", INK, 16)]]],
}));

fs.writeFileSync(`${out}/hk-tiles.svg`, inventory({
  title: "Hong Kong tile set", header: "KEEP — ALL 144 TILES", headerNote: "Flowers stay in",
  desc: "Keep characters, dots and bamboo 1 to 9, the four winds, the three dragons (four of each), plus four flower and four season tiles: 144 tiles. Remove only jokers.",
  rows: [
    ["Characters 萬", "1–9 × 4", [man("一"), man("五"), "…", man("九")]],
    ["Dots 筒", "1–9 × 4", [dots(1), dots(5), "…", dots(9)]],
    ["Bamboo 索", "1–9 × 4", [bamboo(2), bamboo(5), "…", bamboo(9)]],
    ["Winds", "E · S · W · N", [glyph("東"), glyph("南"), glyph("西"), glyph("北")]],
    ["Dragons", "Red · Green · White", [glyph("中", "#8A3B33"), glyph("發", "#2F5D50"), blankWhite]],
    ["Flowers 1–4", "Bonus tiles — keep them", [flower("梅"), flower("蘭"), flower("菊"), flower("竹")]],
    ["Seasons 1–4", "Bonus tiles — keep them", [seasons("春"), seasons("夏"), seasons("秋"), seasons("冬")]],
  ],
  removeRows: [["Jokers", "If your set has them", [glyph("J", INK, 16)]]],
}));

const joker = `<text x="16" y="18" text-anchor="middle" font-size="7.5" font-weight="700" fill="#5B2C83" ${FONT}>JOKER</text><circle cx="16" cy="28" r="5" fill="none" stroke="#5B2C83" stroke-width="1.5"/>`;
const letter = (t) => `<text x="16" y="27" text-anchor="middle" font-size="16" font-weight="700" fill="${INK}" ${FONT}>${t}</text>`;
fs.writeFileSync(`${out}/american-tiles.svg`, inventory({
  title: "American Mah Jongg tile set", header: "KEEP — 152 TILES", headerNote: "+ racks & card",
  desc: "Keep craks, bams and dots 1 to 9 (four each), 16 winds, 12 dragons including the white Soap, 8 flowers and 8 jokers: 152 tiles. Each player also needs a rack and a current-year NMJL card.",
  rows: [
    ["Craks 萬", "1–9 × 4", [man("一"), man("五"), "…", man("九")]],
    ["Bams", "1–9 × 4", [bamboo(2), bamboo(5), "…", bamboo(9)]],
    ["Dots", "1–9 × 4", [dots(1), dots(5), "…", dots(9)]],
    ["Winds × 16", "N · E · W · S", [letter("N"), letter("E"), letter("W"), letter("S")]],
    ["Dragons × 12", "Red · Green · Soap", [glyph("中", "#8A3B33"), glyph("發", "#2F5D50"), blankWhite]],
    ["Flowers × 8", "Used in card hands", [flower("梅"), flower("蘭"), flower("菊"), flower("竹")]],
    ["Jokers × 8", "Wild in groups of 3+", [joker, joker, joker, joker]],
  ],
}));

// Seat winds and turn order (counter-clockwise, East = dealer)
{
  const S = { E: [180, 330], S: [300, 210], W: [180, 90], N: [60, 210] };
  const arcs = ["M215 330 Q 300 330 300 245", "M300 175 Q 300 90 215 90", "M145 90 Q 60 90 60 175", "M60 245 Q 60 330 145 330"]; // E→S→W→N→E
  let seats = "";
  for (const [k, [x, y]] of Object.entries(S)) {
    seats += `<circle cx="${x}" cy="${y}" r="22" fill="${k === "E" ? GREEN_BADGE : "#FFFFFF"}" stroke="${INK}" stroke-width="1.5"/>` +
      `<text x="${x}" y="${y + 6}" text-anchor="middle" font-size="17" fill="${k === "E" ? "#FFFFFF" : INK}" ${CJK}>${{ E: "東", S: "南", W: "西", N: "北" }[k]}</text>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 440" width="360" height="440" role="img" aria-labelledby="t d">
<title id="t">Seat winds and turn order</title>
<desc id="d">Top-down table. East (the dealer) at the bottom, South to East's right, West opposite, North to East's left. Turns move counter-clockwise: East, South, West, North.</desc>
<defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${INK}"/></marker></defs>
<rect width="360" height="440" rx="12" fill="#FFFFFF"/>
${label(180, 30, "Seats & Turn Order", 16, 600, INK, "middle")}${label(180, 50, "Counter-clockwise, seen from above", 13, 400, MUTED, "middle")}
<rect x="118" y="148" width="124" height="124" rx="12" fill="#F7F7F8" stroke="#E5E5E5" stroke-width="1.5"/>
${label(180, 206, "Table", 12, 400, MUTED, "middle")}
${arcs.map((d) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="2" marker-end="url(#ah)"/>`).join("")}
${seats}
${label(180, 372, "East · dealer", 12, 600, INK, "middle")}${label(332, 250, "South", 12, 400, MUTED, "end")}${label(180, 130, "West", 12, 400, MUTED, "middle")}${label(28, 250, "North", 12, 400, MUTED)}
${label(180, 404, "East plays first, then South (East's right), West, North.", 13, 400, INK, "middle")}
${label(180, 424, "South sits to the dealer's right.", 13, 400, MUTED, "middle")}
</svg>`;
  fs.writeFileSync(`${out}/seat-winds.svg`, svg);
}

// Riichi dead wall & dora indicator (one wall segment seen from the front)
{
  const stackW = 18, y = 150, x0 = 14;
  let s = "";
  const n = 17, breakAfter = 9; // stacks 0..8 live (left), gap, 9..15 dead wall (7 stacks), 16 continues
  for (let i = 0; i < n; i++) {
    const gap = i >= breakAfter ? 12 : 0;
    const x = x0 + i * stackW + gap;
    const dead = i >= breakAfter && i < breakAfter + 7;
    const dora = i === breakAfter + 2;
    s += `<rect x="${x}" y="${y}" width="${stackW - 2}" height="22" rx="3" fill="${dead ? "#EEF3F1" : "#FFFFFF"}" stroke="${LINE}" stroke-width="1.2"/>`;
    s += dora
      ? `<rect x="${x}" y="${y - 26}" width="${stackW - 2}" height="22" rx="3" fill="#FFFFFF" stroke="${INK}" stroke-width="1.5"/><text x="${x + 8}" y="${y - 10}" text-anchor="middle" font-size="11" fill="#8A3B33" ${CJK}>四</text>`
      : `<rect x="${x}" y="${y - 24}" width="${stackW - 2}" height="22" rx="3" fill="${dead ? "#DCE7E2" : "#E3E3E3"}" stroke="#BDBDBD" stroke-width="1.2"/>`;
  }
  const deadStart = x0 + breakAfter * stackW + 12, deadEnd = deadStart + 7 * stackW - 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 320" width="360" height="320" role="img" aria-labelledby="t d">
<title id="t">Dead wall and dora indicator</title>
<desc id="d">One wall segment after the break. Stacks to the left of the break are the live wall, where drawing starts. The seven stacks to the right of the break (14 tiles) are the dead wall. The top tile of the third stack from the break is turned face up as the dora indicator.</desc>
<defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${INK}"/></marker></defs>
<rect width="360" height="320" rx="12" fill="#FFFFFF"/>
${label(180, 30, "Dead Wall & Dora Indicator", 16, 600, INK, "middle")}${label(180, 50, "One wall, seen from the front, after the break", 13, 400, MUTED, "middle")}
${s}
<line x1="${x0 + breakAfter * stackW + 4}" y1="${y - 40}" x2="${x0 + breakAfter * stackW + 4}" y2="${y + 34}" stroke="${GREEN_BADGE}" stroke-width="2" stroke-dasharray="4 3"/>
${label(x0 + breakAfter * stackW + 4, y - 46, "break", 11, 600, GREEN_BADGE, "middle")}
<path d="M${x0 + breakAfter * stackW - 10} ${y + 46} L ${x0 + 20} ${y + 46}" stroke="${INK}" stroke-width="2" marker-end="url(#ah)" fill="none"/>
${label(x0 + 70, y + 66, "Live wall: draw from here", 12, 600, INK, "middle")}
<path d="M${deadStart} ${y + 40} L ${deadStart} ${y + 48} L ${deadEnd} ${y + 48} L ${deadEnd} ${y + 40}" fill="none" stroke="${MUTED}" stroke-width="1.5"/>
${label((deadStart + deadEnd) / 2, y + 66, "Dead wall: 7 stacks = 14 tiles", 12, 600, INK, "middle")}
<path d="M${deadStart + 2 * stackW + 8} ${y - 34} L ${deadStart + 2 * stackW + 8} ${y - 60}" stroke="${INK}" stroke-width="1.5" fill="none"/>
${label(deadStart + 2 * stackW + 8, y - 64, "Dora indicator (3rd stack, top tile, face up)", 11, 600, INK, "middle")}
${label(180, 256, "If the indicator is 4 Characters, the dora is 5 Characters.", 13, 400, INK, "middle")}
${label(180, 276, "Nobody draws from the dead wall in normal turns;", 13, 400, MUTED, "middle")}
${label(180, 294, "kan replacement tiles come from it.", 13, 400, MUTED, "middle")}
</svg>`;
  fs.writeFileSync(`${out}/riichi-dead-wall.svg`, svg);
}

// Hong Kong flower / season replacement — three steps
{
  const panel = (x, n, title, body) => `<rect x="${x}" y="70" width="104" height="170" rx="12" fill="#F7F7F8" stroke="#E5E5E5"/>${label(x + 52, 92, `${n}. ${title}`, 12, 600, INK, "middle")}${body}`;
  const t = (x, y, inner, opts = "") => `<g transform="translate(${x},${y})"><rect x="0.75" y="0.75" width="30.5" height="40.5" rx="4.5" fill="#FFFFFF" stroke="${opts || LINE}" stroke-width="${opts ? 2 : 1.5}"/>${inner}</g>`;
  const fd = (x, y) => `<rect x="${x}" y="${y}" width="22" height="30" rx="3" fill="#E3E3E3" stroke="#BDBDBD"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 330" width="360" height="330" role="img" aria-labelledby="t d">
<title id="t">Flower and season replacement</title>
<desc id="d">Step 1: you find a flower or season tile in your hand. Step 2: place it face up in front of you; it is a bonus, not part of your hand. Step 3: draw a replacement tile from the end of the wall. Repeat if the replacement is another bonus tile.</desc>
<defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${INK}"/></marker></defs>
<rect width="360" height="330" rx="12" fill="#FFFFFF"/>
${label(180, 30, "Flower & Season Replacement", 16, 600, INK, "middle")}${label(180, 50, "Bonus tiles are set aside and replaced", 13, 400, MUTED, "middle")}
${panel(10, 1, "Find it", t(46, 120, flower("梅"), GREEN_BADGE) + label(62, 190, "a flower or", 11, 400, MUTED, "middle") + label(62, 205, "season in hand", 11, 400, MUTED, "middle"))}
${panel(128, 2, "Set it aside", t(164, 120, flower("梅")) + label(180, 190, "face up, in", 11, 400, MUTED, "middle") + label(180, 205, "front of you", 11, 400, MUTED, "middle"))}
${panel(246, 3, "Replace it", fd(258, 112) + fd(282, 112) + fd(306, 112) + `<path d="M318 150 Q 318 175 296 178" stroke="${INK}" stroke-width="2" fill="none" marker-end="url(#ah)"/>` + label(298, 205, "draw from the", 11, 400, MUTED, "middle") + label(298, 220, "END of the wall", 11, 600, INK, "middle"))}
${label(180, 272, "The dealer replaces first, then counter-clockwise.", 13, 400, INK, "middle")}
${label(180, 292, "Repeat if the new tile is also a flower or season.", 13, 400, MUTED, "middle")}
${label(180, 312, "During play, do the same whenever you draw one.", 13, 400, MUTED, "middle")}
</svg>`;
  fs.writeFileSync(`${out}/hk-flower-replacement.svg`, svg);
}

// Charleston passes (American). Seen from above with you at the bottom: your right = screen right.
function charleston(dir, title, caption) {
  return exchange(dir).replace(/Exchange Three Tiles/g, title).replace(/Direction: [^<]+</, `Direction: ${caption}<`)
    .replace("Each player exchanges three tiles of the same suit.", "Everyone passes three tiles at the same time.")
    .replace("Keep your selection face down.", "Pass face down. Jokers can never be passed.");
}
fs.writeFileSync(`${out}/charleston-right.svg`, charleston("counterclockwise", "Charleston: Pass Right", "to the player on your right"));
fs.writeFileSync(`${out}/charleston-across.svg`, charleston("across", "Charleston: Pass Across", "to the player opposite you"));
fs.writeFileSync(`${out}/charleston-left.svg`, charleston("clockwise", "Charleston: Pass Left", "to the player on your left"));
