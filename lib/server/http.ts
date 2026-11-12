import "server-only";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ConfigError, backend } from "./kv";
import { HttpError, authPid, cookieName, getRoom, normCode, presenceMap, publicRoom, TTL } from "./room";
import type { Room } from "../types";

export const NO_STORE = { "Cache-Control": "no-store" };

export function fail(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status, headers: NO_STORE });
  if (e instanceof ConfigError) return NextResponse.json({ error: e.message, config: true }, { status: 503, headers: NO_STORE });
  console.error(e);
  return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500, headers: NO_STORE });
}

export async function loadAuthed(rawCode: string) {
  const code = normCode(rawCode);
  if (!code) throw new HttpError(404, "Room not found");
  const room = await getRoom(code);
  if (!room) throw new HttpError(404, "Room not found");
  const jar = await cookies();
  const pid = authPid(room, jar.get(cookieName(code))?.value);
  return { code, room, pid };
}

export async function requireMember(rawCode: string) {
  const x = await loadAuthed(rawCode);
  if (!x.pid) throw new HttpError(401, "You are not a member of this room.");
  return x as typeof x & { pid: string };
}

export async function roomPayload(room: Room, pid: string) {
  const pres = await presenceMap(room.code);
  pres[pid] = String(Date.now());
  return { room: publicRoom(room, pres), me: pid, backend };
}

export async function setSessionCookie(code: string, pid: string, token: string) {
  const jar = await cookies();
  jar.set(cookieName(code), `${pid}.${token}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.MT_INSECURE_COOKIE !== "1",
    path: "/",
    maxAge: TTL,
  });
}
