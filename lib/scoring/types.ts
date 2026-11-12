export type WinMethod = "self_draw" | "discard" | "kong_replacement" | "robbing_kong";
export type Structure = "standard" | "seven_pairs" | "all_pungs" | "other";
export type KongKind = "concealed" | "exposed" | "added";

export interface Transfer { from: string; to: string; amount: number }

export interface WinClaim {
  method: WinMethod;
  fromId?: string; // discarder (discard) or robbed player (robbing_kong)
  structure: Structure;
  pureSuit?: boolean;
  roots?: number;
  goldenHook?: boolean;
  lastTile?: boolean;
  missingSuitCleared?: "yes" | "no" | "unsure";
}
export interface KongClaim { actorId: string; kind: KongKind; fromId?: string }
export interface ExhaustClaim {
  // Sichuan: status of each player still in the hand at wall exhaustion
  status?: Record<string, "ready" | "not_ready" | "missing_suit">;
  // value each not-ready (clean) player pays each ready player — "highest base hand value that player could complete"
  readyValues?: Record<string, number>;
}
export interface CorrectionClaim { corrects: string; invalidWin?: boolean; reason: string }

export interface Calc {
  transfers: Transfer[];
  lines: string[];
  fan?: number;
  value?: number;
  manual: boolean;
  limitations?: string;
  problems: string[]; // blocking problems — event cannot be submitted
}

export interface ScoringProfile {
  variant: string;
  rulesetId: string;
  name: string;
  source: string;
  automatic: boolean;
  maxWinners: number; // hand ends after this many verified winners
  winnersLeave: boolean;
}
