import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fail, NO_STORE } from "@/lib/server/http";
import { hostCookieName, hostLogin } from "@/lib/server/watch";

export const dynamic = "force-dynamic";
// Classroom host sign-in (a server-side host key, separate from the classroom code).
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = hostLogin(body.key);
    (await cookies()).set(hostCookieName, token, {
      httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12,
      secure: process.env.NODE_ENV === "production" && process.env.MT_INSECURE_COOKIE !== "1",
    });
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (e) {
    return fail(e);
  }
}
