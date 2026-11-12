export type VariantId = "sichuan" | "riichi" | "cantonese" | "american";
export type RoomStatus = "lobby" | "variant" | "setup" | "playing" | "finishing" | "complete";
export type AiMode = "live" | "demo" | "unavailable";

export interface Player {
  id: string;
  name: string;
  seat: number;
  joinedAt: number;
  tokenHash?: string; // server only, stripped from public view
}

export interface PublicPlayer extends Omit<Player, "tokenHash"> {
  presence: "online" | "reconnecting" | "offline";
}

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
  kind?: "summary" | "guide";
  aiMode?: AiMode;
  detail?: string;
  source?: string;
  image?: string; // public illustration path only — never user uploads
  imageAlt?: string;
  hadPhoto?: boolean;
  topicId?: string;
  actions?: MsgAction[];
}

export interface Check {
  round: number;
  resp: Record<string, "yes" | "no">;
  needs: string[];
  adhoc: boolean;
  topic: string;
  topicId?: string;
}

export interface Room {
  v: number;
  code: string;
  name: string;
  createdAt: number;
  hostId: string;
  players: Player[];
  status: RoomStatus;
  variant: VariantId | null;
  votes: Record<string, VariantId>;
  stepId: string | null;
  resp: Record<string, string>;
  check: Check | null;
  decisions: Record<string, string>;
  dice: Record<string, number>;
  dealerId: string | null;
  breakRoll: { d1: number; d2: number; by: string } | null;
  finish: Record<string, "yes" | "no"> | null;
  reflections: Record<string, string>;
  messages: Msg[];
  lastSummaryTs: number;
}

export interface PublicRoom extends Omit<Room, "players"> {
  players: PublicPlayer[];
}

export interface RoomResponse {
  room: PublicRoom;
  me: string;
  backend: "redis" | "dev-file";
}
