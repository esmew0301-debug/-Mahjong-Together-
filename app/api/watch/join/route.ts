import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fail, NO_STORE } from "@/lib/server/http";
import { joinSpectator, requireClass, watchCookie } from "@/lib/server/watch";

export const dynamic = "force-dynamic";
// Watch a Game → Create Spectator Profile → classroom code. Creates (or resumes) a spectator session.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const c = requireClass(body.code);
    const jar = await cookies();
    const { id, cookie } = await joinSpectator(c, jar.get(watchCookie(c))?.value, body.name, body.avatar);
    if (cookie)
      jar.set(watchCookie(c), cookie, {
        httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24,
        secure: process.env.NODE_ENV === "production" && process.env.MT_INSECURE_COOKIE !== "1",
      });
    return NextResponse.json({ ok: true, classroom: c, id }, { headers: NO_STORE });
  } catch (e) {
    return fail(e);
  }
}
