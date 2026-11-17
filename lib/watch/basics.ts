/**
 * ONE source of beginner rules text for Spectator Mode: the short pre-watch introduction, the detailed "?" guide,
 * the shared-topic explanations on the matching screen, and the practice-room explanations all read from here,
 * so they can't contradict each other. Rules follow lib/mj/rules (Sichuan "Blood Battle" beginner subset).
 */
import type { Topic } from "./types";

export const SUITS_INFO = [
  { s: "d" as const, name: "Dots", zh: "筒", note: "Circles, numbered 1 to 9." },
  { s: "b" as const, name: "Bamboo", zh: "条", note: "Sticks, numbered 1 to 9. Bamboo 1 is drawn as a bird." },
  { s: "c" as const, name: "Characters", zh: "万", note: "A number on top, 萬 below, from 1 to 9." },
];

export const RULES = {
  tiles: "Sichuan Mahjong uses 108 tiles: three suits (Dots, Bamboo, Characters), numbered 1 to 9, four copies of each. No winds, dragons or flowers.",
  hand: "Each player holds their own tiles. Players take turns drawing one tile and discarding one tile while working toward a winning hand.",
  discard: "A discarded tile is placed face up in the middle of the table, where everyone can see it.",
  concealed: "Concealed hand: only that player can see these tiles.",
  meld: "Exposed meld: a Pung or Kong placed face up after claiming a discard.",
  goal: "Win with four sets of three tiles plus one pair.",
  sequence: "Sequence: three numbers in a row in one suit, like Bamboo 3-4-5.",
  triplet: "Triplet (Pung): three identical tiles, like Dots 6-6-6.",
  pair: "Pair: two identical tiles, like Characters 9-9.",
  hu: "Hu (胡) means declaring a winning hand.",
  huRule: "In Sichuan Mahjong a winning hand must also have no tiles of your missing suit, so it uses at most two suits. Seven pairs also wins.",
  exchange: "Exchange Three Tiles: after the deal, everyone passes three tiles of ONE suit to another player, all in the same direction.",
  dingque: "Ding Que: each player chooses one suit to eliminate. You must discard that suit's tiles first, and you can't win while holding any of them.",
  pung: "Pung: claim another player's discard when you already hold two matching tiles, making a set of three.",
  kong: "Kong: four identical tiles. Claim a discard with three matching tiles, or declare four you drew. You then draw a replacement tile.",
  turn: "Play moves from player to player: draw, then discard. A Pung or Kong on a discard passes the turn to the claimer, who then discards.",
  spectator: "You're watching from a special learning perspective: you can see all four players' hands. The players themselves only see their own hand and the public tiles.",
  spectatorDo: ["See all four players' hands", "Watch each draw, discard, Pung, Kong and Hu", "Switch between the four players' perspectives", "Click an earlier move to inspect it", "Ask questions about a specific move"],
  ask: "Click a discarded tile or a move, then choose Ask About This Move. Others can reply or tap +1 Same Question.",
} as const;

/** "What is …?" for the shared topic of a learning group (matching screen). */
export const TOPIC_EXPLAIN: Record<Topic, { title: string; text: string }> = {
  dingque: { title: "What is Ding Que?", text: "In Sichuan Mahjong, players choose one suit to eliminate. Discarding tiles from that suit is necessary before they can win." },
  discard: { title: "Why do players discard what they do?", text: "Every turn a player discards one tile. Missing-suit tiles must go first; after that, tiles that don't fit any set are usually the easiest to give up." },
  exchange: { title: "What is Exchange Three Tiles?", text: "After the deal, everyone passes three tiles of one suit to another player at the same time, all in the same direction." },
  pung: { title: "What is a Pung?", text: "A Pung is three identical tiles. You can claim another player's discard when you already hold two matching tiles." },
  kong: { title: "What is a Kong?", text: "A Kong is four identical tiles. After declaring it, the player draws a replacement tile." },
  hu: { title: "What makes a winning hand?", text: "Four sets of three plus one pair, with no tiles of your missing suit. Declaring it is called Hu." },
  tile: { title: "How do you read the tiles?", text: "There are three suits, Dots, Bamboo and Characters, each numbered 1 to 9, with four copies of every tile." },
  scoring: { title: "How are points counted?", text: "Winners collect points from the players who pay, with more for special hands. Self-draw wins collect from everyone still playing." },
  turn: { title: "Whose turn is it?", text: "Players draw and discard in turn. Claiming a Pung or Kong moves the turn to the claimer." },
  general: { title: "How does Sichuan Mahjong work?", text: "Players draw and discard in turn, aiming for four sets and a pair while clearing their chosen missing suit." },
};

/** Neutral, topic-based group names (never skill labels). */
export const GROUP_NAME: Record<Topic, string> = {
  dingque: "Ding Que Discussion", discard: "Tile Strategy Group", exchange: "Exchange Three Tiles Group", pung: "Pung & Kong Group",
  kong: "Pung & Kong Group", hu: "Hu & Winning Hands", tile: "Tile Recognition Circle", scoring: "Scoring Questions Group",
  turn: "Turn Order Group", general: "Shared Questions Group",
};
export const groupName = (topics: Topic[]) => (topics.length ? GROUP_NAME[topics[0]] : "Shared Questions Group");
