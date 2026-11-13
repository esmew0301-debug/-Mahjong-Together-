import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { cancel, enqueue, poll, queueCookie, queueName, requestFill, type MatchStatus, type QueueName } from "@/lib/server/match";
import { fail, setSessionCookie, NO_STORE } from "@/lib/server/http";

export const dynamic = "force-dynamic";

async function reply(s: MatchStatus) {
  if (s.status === "matched") {
    await setSessionCookie(s.code, s.pid, s.token); // room credential only ever travels as an httpOnly cookie
    return NextResponse.json({ status: "matched", code: s.code }, { headers: NO_STORE });
  }
  return NextResponse.json(s, { headers: NO_STORE });
}

const readCookie = async (q: QueueName) => (await cookies()).get(queueCookie(q))?.value;

async function setQueueCookie(q: QueueName, v: string) {
  (await cookies()).set(queueCookie(q), v, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60,
    secure: process.env.NODE_ENV === "production" && process.env.MT_INSECURE_COOKIE !== "1",
  });
}

// Poll the caller's own queue entry (?queue=class for the shared classroom QR queue).
export async function GET(req: Request) {
  try {
    const q = queueName(new URL(req.url).searchParams.get("queue"));
    return await reply(await poll(q, await readCookie(q)));
  } catch (e) {
    return fail(e);
  }
}

// { queue, name, avatar } joins (or resumes) a queue; { cancel: true } leaves it; { fill: true } (class queue,
// after the window) completes the caller's group with demo seats.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const q = queueName(body.queue);
    if (body.cancel) return await reply(await cancel(q, await readCookie(q)));
    if (body.fill) return await reply(await requestFill(q, await readCookie(q)));
    const { cookie } = await enqueue(q, await readCookie(q), body.name, body.avatar);
    if (cookie) await setQueueCookie(q, cookie);
    return await reply(await poll(q, cookie || (await readCookie(q))));
  } catch (e) {
    return fail(e);
  }
}
