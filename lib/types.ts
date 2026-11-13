export type VariantId = "sichuan" | "riichi" | "cantonese" | "american";
export type RoomStatus = "lobby" | "variant" | "setup" | "playing" | "hand_review" | "reconciling" | "session_review" | "complete";
export type AiMode = "live" | "demo" | "unavailable";

export interface Player {
  id: string;
  name: string;
  seat: number;
  joinedAt: number;
  tokenHash?: string; // server only, stripped from public view
  /** "virtual" = a clearly labelled AI demo seat (no credentials; acts only through server-side demo logic). */
  kind?: "human" | "virtual";
  avatar?: string;
}

export interface PublicPlayer extends Omit<Player, "tokenHash"> {
  presence: "online" | "reconnecting" | "offline";
}

export type ReactionId = "heart" | "up" | "down" | "haha" | "emphasis" | "question";
export const REACTION_IDS: ReactionId[] = ["heart", "up", "down", "haha", "emphasis", "question"];

export interface MsgAction {
  label: string;
  type: "followup" | "current" | "browse" | "focus";
  topicId?: string;
  facet?: string;
}

export interface Msg {
  id: string;
  ts: number;
  sender: string; // player id | "ai" | "system"
  name?: string;
  text: string;
  title?: string;
  kind?: "summary" | "guide" | "declaration";
  eventId?: string;
  aiMode?: AiMode;
  detail?: string;
  source?: string;
  image?: string; // public illustration path only — never user uploads
  imageAlt?: string;
  hadPhoto?: boolean;
  topicId?: string;
  actions?: MsgAction[];
  reactions?: Record<string, ReactionId>; // player id → reaction
}

export interface Check {
  round: number;
  resp: Record<string, "yes" | "no">;
  needs: string[];
  adhoc: boolean;
  topic: string;
  topicId?: string;
}

export type EventType = "win" | "kong" | "exhaust" | "correction" | "manual";
export type Approval = "confirm" | "explain" | "dispute";

export interface GameEvent {
  id: string;
  idem: string; // client idempotency key
  type: EventType;
  hand: number;
  by: string; // submitter
  actor?: string; // winner / player who made the kong
  claim: Record<string, unknown>;
  transfers: { from: string; to: string; amount: number }[];
  lines: string[];
  limitations?: string;
  manual: boolean;
  ruleVersion: string;
  source: string;
  status: "pending" | "committed" | "voided";
  voidProposed?: boolean;
  rev: number;
  approvals: Record<string, Approval>;
  notes: { by: string; text: string; rev: number; ts: number }[];
  createdAt: number;
  committedAt?: number;
  correctedBy?: string;
  /** Approvals given by AI demo seats (simulated, never a physical inspection of tiles). */
  simulated?: string[];
}

export interface LedgerEntry {
  id: string;
  eventId: string;
  hand: number;
  from: string;
  to: string;
  amount: number;
  reason: string;
  ruleVersion: string;
  approvals: string[];
  ts: number;
  correctionOf?: string; // set on reversal entries
}

export interface HandState {
  n: number;
  dealerId: string | null;
  winners: string[];
  ended: boolean;
  endReason?: "wins" | "exhausted";
  firstWinFrom?: string | null;
  /** Ding Que: each player's declared missing suit for this hand (c = Characters, b = Bamboo, d = Dots). */
  dingQue?: Record<string, "c" | "b" | "d">;
}

export interface Room {
  v: number;
  /** "s3" = final Sichuan-only product flow (lobby → three prep steps → gameplay home). */
  flow?: "s3";
  /** Room created by Random Match (vs. a private room joined by code / QR). */
  matched?: boolean;
  /** Lobby "I'm Ready" per participant (s3 flow). */
  lobbyReady?: Record<string, boolean>;
  /** Demo seats' scheduled (staggered) responses: context key → { virtual player id → due time (ms) }. */
  aiPlans?: Record<string, Record<string, number>>;
  /** Ding Que selections made in Step 4 (copied to the hand when play starts). */
  dingQue?: Record<string, "c" | "b" | "d">;
  /** Last declined End Game proposal, so every phone can show "The game will continue." once. */
  endDeclined?: { id: string; by: string; at: number } | null;
  code: string;
  name: string;
  createdAt: number;
  hostId: string;
  players: Player[];
  status: RoomStatus;
  variant: VariantId | null;
  votes: Record<string, VariantId>;
  stepId: string | null;
  /** Increments each time a step starts; confirmations belong to (stepId, stepVersion). */
  stepVersion?: number;
  /** One shared confirmation per step: "ready" once confirmed (or a consensus option id). */
  resp: Record<string, string>;
  /** Informational only: who is viewing the explanation. Never erases a "ready". */
  viewing?: Record<string, boolean>;
  check: Check | null;
  decisions: Record<string, string>;
  dice: Record<string, number>;
  dealerId: string | null;
  breakRoll: { d1: number; d2: number; by: string } | null;
  finish: Record<string, "yes" | "no"> | null;
  reflections: Record<string, string>;
  messages: Msg[];
  lastSummaryTs: number;
  hand?: HandState;
  hands?: { n: number; dealerId: string | null; winners: string[]; endReason?: string }[];
  events?: GameEvent[];
  ledger?: LedgerEntry[];
  ledgerVersion?: number;
  nextDealerVotes?: Record<string, string>;
  finalReview?: { ledgerVersion: number; resp: Record<string, "confirm" | "correct">; returnTo: RoomStatus } | null;
  endProposal?: { id: string; by: string; votes: Record<string, "agree" | "keep" | "wait">; createdAt: number; fromStatus: RoomStatus } | null;
  endedEarly?: { at: number; fromStatus: RoomStatus; handInProgress: boolean } | null;
}

export interface PublicRoom extends Omit<Room, "players"> {
  players: PublicPlayer[];
}

export interface RoomResponse {
  room: PublicRoom;
  me: string;
  backend: "redis" | "dev-file";
}
