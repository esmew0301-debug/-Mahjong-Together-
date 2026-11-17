import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fail, NO_STORE } from "@/lib/server/http";
import { requireClass, requireSpectator, watchCookie, watchState } from "@/lib/server/watch";

export const dynamic = "force-dynamic";
// Spectator poll (read-only; never changes the game). Requires a spectator session for this classroom.
export async function GET(req: Request, ctx: { params: Promise<{ cls: string }> }) {
  try {
    const c = requireClass((await ctx.params).cls);
    const jar = await cookies();
    const me = await requireSpectator(c, jar.get(watchCookie(c))?.value);
    const sp = new URL(req.url).searchParams;
    const n = (k: string) => Number(sp.get(k)) || 0;
    const out = await watchState(c, me, { game: sp.get("game"), rv: n("rv"), fs: n("fs"), dv: n("dv"), gv: n("gv"), pv: n("pv"), pc: n("pc") }, (name) => jar.get(name)?.value);
    return NextResponse.json(out, { headers: NO_STORE });
  } catch (e) {
    return fail(e);
  }
}
