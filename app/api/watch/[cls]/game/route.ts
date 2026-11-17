import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fail, setSessionCookie, NO_STORE } from "@/lib/server/http";
import { gameStatus, requireClass, requireSpectator, watchCookie } from "@/lib/server/watch";

export const dynamic = "force-dynamic";
// "Play a Game Together": poll the learner's pending game; once its fresh room exists, hand over the player seat
// (room credential only as an httpOnly cookie, exactly like classroom matching).
export async function POST(req: Request, ctx: { params: Promise<{ cls: string }> }) {
  try {
    const c = requireClass((await ctx.params).cls);
    const jar = await cookies();
    const me = await requireSpectator(c, jar.get(watchCookie(c))?.value);
    const body = await req.json().catch(() => ({}));
    const st = await gameStatus(c, me, body, (n) => jar.get(n)?.value);
    if (st.status === "formed" && st.cred && st.room) await setSessionCookie(st.room, st.cred.pid, st.cred.token);
    const { cred: _c, ...out } = st as typeof st & { cred?: unknown };
    return NextResponse.json(out, { headers: NO_STORE });
  } catch (e) {
    return fail(e);
  }
}
