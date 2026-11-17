import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fail, NO_STORE } from "@/lib/server/http";
import { requireClass, requireSpectator, snapshotFor, watchCookie } from "@/lib/server/watch";

export const dynamic = "force-dynamic";
// Authorized all-hands snapshot for ONE recorded move (local pause / historical inspection).
export async function GET(req: Request, ctx: { params: Promise<{ cls: string }> }) {
  try {
    const c = requireClass((await ctx.params).cls);
    const jar = await cookies();
    await requireSpectator(c, jar.get(watchCookie(c))?.value);
    const sp = new URL(req.url).searchParams;
    return NextResponse.json(await snapshotFor(c, String(sp.get("game") || ""), Number(sp.get("seq")), (name) => jar.get(name)?.value), { headers: NO_STORE });
  } catch (e) {
    return fail(e);
  }
}
