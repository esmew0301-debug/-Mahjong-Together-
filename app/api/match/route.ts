import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { QUEUE_COOKIE, cancel, enqueue, poll, type MatchStatus } from "@/lib/server/match";
import { fail, setSessionCookie, NO_STORE } from "@/lib/server/http";

export const dynamic = "force-dynamic";

async function reply(s: MatchStatus) {
  if (s.status === "matched") {
    await setSessionCookie(s.code, s.pid, s.token); // room credential only ever travels as an httpOnly cookie
    return NextResponse.json({ status: "matched", code: s.code }, { headers: NO_STORE });
  }
  return NextResponse.json(s, { headers: NO_STORE });
}

const queueCookie = async () => (await cookies()).get(QUEUE_COOKIE)?.value;

async function setQueueCookie(v: string) {
  (await cookies()).set(QUEUE_COOKIE, v, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60,
    secure: process.env.NODE_ENV === "production" && process.env.MT_INSECURE_COOKIE !== "1",
  });
}

// Poll the caller's own queue entry.
export async function GET() {
  try {
    return await reply(await poll(await queueCookie()));
  } catch (e) {
    return fail(e);
  }
}

// { name, avatar } joins (or resumes) the queue; { cancel: true } leaves it.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body.cancel) return await reply(await cancel(await queueCookie()));
    const { cookie } = await enqueue(await queueCookie(), body.name, body.avatar);
    if (cookie) await setQueueCookie(cookie);
    return await reply(await poll(cookie || (await queueCookie())));
  } catch (e) {
    return fail(e);
  }
}
