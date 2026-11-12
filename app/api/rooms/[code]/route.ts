import { NextResponse } from "next/server";
import { touch } from "@/lib/server/room";
import { fail, loadAuthed, roomPayload, NO_STORE } from "@/lib/server/http";

export const dynamic = "force-dynamic";
// Polling endpoint. Non-members get only a lobby summary (for the join page).
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const { room, pid } = await loadAuthed(code);
    if (!pid)
      return NextResponse.json(
        { member: false, summary: { code: room.code, name: room.name, players: room.players.length, status: room.status, host: room.players.find((p) => p.id === room.hostId)?.name } },
        { headers: NO_STORE }
      );
    await touch(room.code, pid);
    const since = Number(new URL(req.url).searchParams.get("v"));
    if (since === room.v) {
      // Unchanged: send only presence to keep polling cheap.
      const { room: pub } = await roomPayload(room, pid);
      return NextResponse.json({ member: true, same: true, v: room.v, players: pub.players }, { headers: NO_STORE });
    }
    return NextResponse.json({ member: true, ...(await roomPayload(room, pid)) }, { headers: NO_STORE });
  } catch (e) {
    return fail(e);
  }
}
