"use client";

import type { TileSpec } from "@/lib/tutorial/scenes";

/** One tile illustration used by every tutorial scene: same proportions, radius, thickness and type scale. */
const CJK = "'PingFang SC','Noto Sans CJK SC','Hiragino Sans GB','Microsoft YaHei',serif";
const NUM = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
const WIND = { E: "東", S: "南", W: "西", N: "北" } as const;
const FLOWER = ["", "梅", "蘭", "菊", "竹"];
const SEASON = ["", "春", "夏", "秋", "冬"];
const SUIT_GREEN = "#2F5D50";
const RED = "#B3362B";

function pips(n: number): [number, number][] {
  const L: Record<number, [number, number][]> = {
    1: [[12, 15]], 2: [[12, 9], [12, 21]], 3: [[6, 8], [12, 15], [18, 22]], 4: [[7, 9], [17, 9], [7, 21], [17, 21]],
    5: [[7, 8], [17, 8], [12, 15], [7, 22], [17, 22]], 6: [[7, 7], [17, 7], [7, 15], [17, 15], [7, 23], [17, 23]],
    7: [[6, 6], [12, 9], [18, 12], [7, 18], [17, 18], [7, 24], [17, 24]], 8: [[7, 6], [17, 6], [7, 12], [17, 12], [7, 18], [17, 18], [7, 24], [17, 24]],
    9: [[6, 7], [12, 7], [18, 7], [6, 15], [12, 15], [18, 15], [6, 23], [12, 23], [18, 23]],
  };
  return L[n] || L[1];
}

export function TileFace({ t, faceUp = true, highlight = false }: { t: TileSpec; faceUp?: boolean; highlight?: boolean }) {
  // 24×30 tile with a 3px "thickness" edge; drawn centred on (0,0)
  const stroke = highlight ? "var(--brand)" : "#C9C9CE";
  const sw = highlight ? 2 : 1;
  if (!faceUp || t.k === "back")
    return (
      <g transform="translate(-12,-15)">
        <rect x="0" y="3" width="24" height="30" rx="4" fill="#B9B9BF" />
        <rect x="0" y="0" width="24" height="30" rx="4" fill="#D9D9DE" stroke={stroke} strokeWidth={sw} />
      </g>
    );
  let face: React.ReactNode = null;
  if (t.k === "c") {
    const red = t.red ? RED : "#1C1C1E";
    face = (<><text x="12" y="13" textAnchor="middle" fontSize="10" fill={red} fontFamily={CJK}>{NUM[t.n]}</text><text x="12" y="26" textAnchor="middle" fontSize="11" fill={RED} fontFamily={CJK}>萬</text></>);
  } else if (t.k === "d") {
    const c = t.red ? RED : SUIT_GREEN;
    face = <>{pips(t.n).map(([x, y], i) => <circle key={i} cx={x} cy={y} r={t.n === 1 ? 6 : t.n <= 4 ? 3.4 : 2.6} fill="none" stroke={c} strokeWidth="1.4" />)}</>;
  } else if (t.k === "b") {
    const c = t.red ? RED : SUIT_GREEN;
    face = <>{pips(t.n).map(([x, y], i) => <rect key={i} x={x - 1.3} y={y - 3.4} width="2.6" height="6.8" rx="1.2" fill={c} />)}</>;
  } else if (t.k === "wind") {
    face = t.latin
      ? <text x="12" y="20" textAnchor="middle" fontSize="13" fontWeight="700" fill="#1C1C1E" fontFamily="Inter,system-ui,sans-serif">{t.v}</text>
      : <text x="12" y="20" textAnchor="middle" fontSize="14" fill="#1C1C1E" fontFamily={CJK}>{WIND[t.v]}</text>;
  } else if (t.k === "dragon") {
    face = t.v === "W"
      ? <rect x="6" y="6" width="12" height="18" rx="2" fill="none" stroke="#5B7083" strokeWidth="1.4" />
      : <text x="12" y="20" textAnchor="middle" fontSize="14" fill={t.v === "R" ? RED : SUIT_GREEN} fontFamily={CJK}>{t.v === "R" ? "中" : "發"}</text>;
  } else if (t.k === "flower" || t.k === "season") {
    face = (<><text x="12" y="19" textAnchor="middle" fontSize="12" fill={t.k === "flower" ? RED : SUIT_GREEN} fontFamily={CJK}>{t.k === "flower" ? FLOWER[t.n] : SEASON[t.n]}</text><text x="20" y="27" textAnchor="middle" fontSize="6" fill="#6E6E73">{t.n}</text></>);
  } else if (t.k === "joker") {
    face = (<><text x="12" y="13" textAnchor="middle" fontSize="5.6" fontWeight="700" fill="#5B2C83" fontFamily="Inter,system-ui,sans-serif">JOKER</text><circle cx="12" cy="21" r="4" fill="none" stroke="#5B2C83" strokeWidth="1.3" /></>);
  }
  return (
    <g transform="translate(-12,-15)">
      <rect x="0" y="3" width="24" height="30" rx="4" fill="#CFCFD4" />
      <rect x="0" y="0" width="24" height="30" rx="4" fill="#FFFFFF" stroke={stroke} strokeWidth={sw} />
      {face}
    </g>
  );
}
