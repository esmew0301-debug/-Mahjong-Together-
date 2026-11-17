/**
 * Local, deterministic question-topic classifier (no AI, no network): keyword + synonym dictionaries, with the
 * selected move's event type as a tie-breaker / default. Same code runs on the server (stored tag) and the client
 * (duplicate-question hint).
 */
import type { QRef, Topic } from "./types";

export const TOPIC_LABEL: Record<Topic, string> = {
  tile: "Tile identification", discard: "Discard reasoning", dingque: "Ding Que", exchange: "Exchange Three Tiles",
  pung: "Pung", kong: "Kong", hu: "Hu (winning)", scoring: "Scoring", turn: "Turn order", general: "General rules",
};
/** Short label used in sentences ("You all asked about Pung and Ding Que."). */
export const TOPIC_SHORT: Record<Topic, string> = {
  tile: "tiles", discard: "discarding", dingque: "Ding Que", exchange: "the exchange", pung: "Pung", kong: "Kong",
  hu: "winning", scoring: "scoring", turn: "turn order", general: "general rules",
};

const DICT: [Topic, string[]][] = [
  ["dingque", ["ding que", "dingque", "missing suit", "missing", "void", "que", "定缺", "缺", "clear the suit", "clear bamboo", "clear dots", "clear characters"]],
  ["exchange", ["exchange", "swap", "pass three", "three tiles", "3 tiles", "trade", "换三张", "换牌"]],
  ["kong", ["kong", "gang", "four of a kind", "4 of a kind", "four same", "杠"]],
  ["pung", ["pung", "pong", "peng", "three of a kind", "3 of a kind", "triplet", "claim", "碰"]],
  ["hu", ["hu", "win", "won", "winning", "mahjong!", "ready hand", "complete hand", "self draw", "self-draw", "zimo", "胡", "和牌", "赢"]],
  ["scoring", ["score", "scoring", "point", "points", "fan", "pay", "paid", "money", "番", "分"]],
  ["turn", ["turn", "whose turn", "order", "next player", "go next", "skip", "dealer", "draw", "轮", "庄"]],
  ["discard", ["discard", "throw", "threw", "toss", "get rid", "play this", "played", "why did", "why would", "give up", "打", "出牌"]],
  ["tile", ["what tile", "which tile is", "what is this tile", "bamboo", "dots", "circle", "characters", "character", "wan", "tiao", "tong", "symbol", "number", "什么牌", "条", "筒", "万"]],
];
const PRIOR: Partial<Record<QRef["type"], Topic>> = { discard: "discard", pung: "pung", kong: "kong", hu: "hu", dingque: "dingque", exchange: "exchange", draw: "turn", deal: "turn", end: "scoring" };

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9一-鿿!' -]+/g, " ").replace(/\s+/g, " ")} `;
function hits(text: string, word: string) {
  if (/[一-鿿]/.test(word)) return text.includes(word);
  return text.includes(` ${word} `) || text.includes(` ${word}s `) || text.includes(` ${word}ed `) || text.includes(` ${word}ing `);
}

/** Score every topic; the best keyword topic wins, the move's event type breaks ties and is the default. */
export function classify(text: string, ref?: Pick<QRef, "type" | "tile"> & { missingSuit?: boolean } | null): Topic {
  const t = norm(text);
  const prior = ref ? (ref.type === "discard" && ref.missingSuit ? "dingque" : PRIOR[ref.type]) : undefined;
  let best: Topic | null = null, bestScore = 0;
  for (const [topic, words] of DICT) {
    let sc = 0;
    for (const w of words) if (hits(t, w)) sc += w.includes(" ") ? 2 : 1;
    if (topic === prior && sc > 0) sc += 0.5;
    // "Bamboo 3" in a discard question names the tile, it isn't a tile-identification question
    if (topic === "tile" && ref?.type === "discard" && !/what (tile|is)|which tile is|什么牌/.test(t)) sc = Math.min(sc, 0.25);
    if (sc > bestScore) { best = topic; bestScore = sc; }
  }
  // a generic "why this discard?" about a MISSING-SUIT discard is a Ding Que question (that's the rule at work)
  if (prior === "dingque" && (best === "discard" || !best || bestScore < 1)) return "dingque";
  return best && bestScore >= 1 ? best : prior || "general";
}
