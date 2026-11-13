"use client";

import { api, ApiError, rememberRoom, type Profile } from "./client";

export const normalizeCode = (raw: string) => {
  const c = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^MAH/, "");
  return c.length === 4 ? `MAH-${c}` : "";
};

/** Validate and join an existing room with this device's profile. Never creates a room. */
export async function joinWithProfile(code: string, p: Profile): Promise<{ code?: string; error?: string }> {
  try {
    const j = await api(`/api/rooms/${code}`);
    if (j.member) { rememberRoom(j.room.code); return { code: j.room.code }; } // refresh-safe: same seat
    if (j.summary.status === "complete") return { error: "This room has ended." };
    if (j.summary.players >= 4) return { error: "This room is full." };
    const r = await api(`/api/rooms/${code}/join`, { name: p.name, avatar: p.avatar });
    rememberRoom(r.room.code);
    return { code: r.room.code };
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return { error: "Room not found. Check the code." };
    if (e instanceof ApiError && e.config) return { error: "Live rooms aren't set up on this deployment yet." };
    return { error: (e as Error).message };
  }
}
