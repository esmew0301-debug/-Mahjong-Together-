import { NextResponse } from "next/server";
import { createRoom, cleanName, touch, HttpError } from "@/lib/server/room";
import { fail, roomPayload, setSessionCookie, NO_STORE } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = cleanName(body.name);
    if (!name) throw new HttpError(400, "Enter a name to continue.");
    const { room, pid, token } = await createRoom(name, cleanName(body.roomName, 40), body.avatar);
    await setSessionCookie(room.code, pid, token);
    await touch(room.code, pid);
    return NextResponse.json(await roomPayload(room, pid), { headers: NO_STORE });
  } catch (e) {
    return fail(e);
  }
}
