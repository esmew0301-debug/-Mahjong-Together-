import { NextResponse } from "next/server";
import { cleanName, joinPlayer, mutate, touch, HttpError } from "@/lib/server/room";
import { fail, loadAuthed, roomPayload, setSessionCookie, NO_STORE } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code: raw } = await ctx.params;
    const { code, room, pid: existing } = await loadAuthed(raw);
    // Refresh-safe: an existing session cookie restores the same participant instead of joining twice.
    if (existing) return NextResponse.json(await roomPayload(room, existing), { headers: NO_STORE });
    const body = await req.json().catch(() => ({}));
    const name = cleanName(body.name);
    if (!name) throw new HttpError(400, "Please enter your name.");
    let creds: { pid: string; token: string } | null = null;
    const next = await mutate(code, (r) => {
      if (r.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) throw new HttpError(409, "Someone in this room already uses that name.");
      creds = joinPlayer(r, name);
    });
    const c = creds as unknown as { pid: string; token: string };
    await setSessionCookie(code, c.pid, c.token);
    await touch(code, c.pid);
    return NextResponse.json(await roomPayload(next, c.pid), { headers: NO_STORE });
  } catch (e) {
    return fail(e);
  }
}
