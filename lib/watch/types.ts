/**
 * Mahjong Together 4.0 — Spectator & Social Learning types (shared by server and client; no secrets here).
 * classroomId (e.g. COGS123) and gameRoomId (e.g. MAH-AB12) are separate concepts.
 */
import type { Meld, Suit } from "../mj/rules";

export type SpecEventType = "deal" | "exchange" | "dingque" | "draw" | "discard" | "pung" | "kong" | "hu" | "end";

/** One committed game action, published to the educational spectator projection. */
export interface SpecEvent {
  seq: number; // monotonically increasing per game room
  id: string; // stable event id: `${game}:${seq}`
  game: string; // game room id
  hand: number;
  type: SpecEventType;
  actor?: string; // acting player id
  tile?: number; // tile involved (discard / claimed tile / winning tile); never a future wall tile
  from?: string; // discarder for pung / kong / hu on a discard
  ts: number; // server timestamp
  text: string; // human-readable, e.g. "Frank discarded Bamboo 3."
  rule?: string; // short public rule context, e.g. "missing-suit"
}

/** Authorized all-hands snapshot taken immediately after an event (no wall order, no future draws). */
export interface SpecSnap {
  seq: number;
  hand: number;
  phase: "exchange" | "dingque" | "play" | "claim" | "ended";
  turn: string | null;
  dealer: string;
  order: string[];
  hands: Record<string, number[]>;
  melds: Record<string, Meld[]>;
  discards: Record<string, number[]>;
  dq: Record<string, Suit>;
  exchange: Record<string, number[]>;
  wallCount: number;
  last: { tile: number; from: string } | null;
  winners: { pid: string; method: "self_draw" | "discard"; from?: string; tile: number; value: number }[];
  exDir: string;
}

export interface SpecPlayer { id: string; name: string; avatar?: string; kind?: string; seat: number }

/** Live educational projection of one teaching game. */
export interface SpecView {
  game: string;
  roomV: number;
  status: string; // room status (lobby / setup / playing / complete …)
  players: SpecPlayer[];
  live: (SpecSnap & { claims: Record<string, string[]>; claimUntil: number | null; endReason?: string }) | null;
  feed: SpecEvent[]; // events newer than the client's `fs`
  feedMin: number; // oldest seq still in the replay buffer
  feedMax: number;
  scores: Record<string, number>;
}

export type Topic = "tile" | "discard" | "dingque" | "exchange" | "pung" | "kong" | "hu" | "scoring" | "turn" | "general";

export interface QRef { seq: number; game: string; hand: number; type: SpecEventType; actor?: string; actorName?: string; actorAvatar?: string; actorKind?: string; tile?: number; text: string; ts: number; rule?: string }
export interface QReply { id: string; author: string; text: string; ts: number }
export interface Question {
  id: string;
  classroom: string;
  game: string;
  session: string;
  ref: QRef | null; // referenced move (null = general question)
  author: string; // spectator id
  text: string;
  topic: Topic;
  ts: number;
  same: string[]; // unique participants sharing the question; the author is always first
  replies: QReply[];
}
export interface Discussion { v: number; questions: Question[] }

export interface Viewer { id: string; name: string; avatar: string }

export interface Session { id: string; game: string; status: "live" | "ended"; startedAt: number; endedAt?: number }

export interface Group {
  id: string;
  kind: "topic" | "general";
  members: string[]; // recommended (topic) or enrolled (general) spectator ids
  topics: Topic[]; // topics EVERY member asked about or +1'd (topic groups only)
  status: Record<string, "invited" | "accepted" | "declined">;
  createdAt: number;
}
export interface Groups { v: number; computedAt: number | null; groups: Group[]; assign: Record<string, string> } // assign: spectator → accepted group

export interface PracticeMsg { id: string; sid: string; kind: "text" | "emoji"; text: string; ts: number }
export interface Practice { v: number; group: string; idx: number; stage: "answer" | "reveal"; answers: Record<string, string>; chat: PracticeMsg[]; round: number }

export interface GameSummary { code: string; name: string; status: string; players: { name: string; avatar?: string; kind?: string }[]; hand: number | null; teaching: boolean; featured: boolean; classroom?: string; createdAt: number }
