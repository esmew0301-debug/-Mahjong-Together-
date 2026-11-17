import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fail, NO_STORE } from "@/lib/server/http";
import { requireClass, requireSpectator, spectatorAct, watchCookie } from "@/lib/server/watch";

export const dynamic = "force-dynamic";
// Spectator-only actions: questions, replies, +1, learning groups, practice. No game action is accepted here.
export async function POST(req: Request, ctx: { params: Promise<{ cls: string }> }) {
  try {
    const c = requireClass((await ctx.params).cls);
    const jar = await cookies();
    const me = await requireSpectator(c, jar.get(watchCookie(c))?.value);
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({ ok: true, result: await spectatorAct(c, me, body, (name) => jar.get(name)?.value) }, { headers: NO_STORE });
  } catch (e) {
    return fail(e);
  }
}
