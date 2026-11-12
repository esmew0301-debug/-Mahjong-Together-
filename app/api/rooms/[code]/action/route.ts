import { NextResponse } from "next/server";
import { applyAction, mutate, presenceMap, privKey, touch } from "@/lib/server/room";
import { kv } from "@/lib/server/kv";
import { fail, requireMember, roomPayload, NO_STORE } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code: raw } = await ctx.params;
    const { code, pid } = await requireMember(raw);
    const action = await req.json().catch(() => ({}));
    const pres = await presenceMap(code);
    const next = await mutate(code, (r) => applyAction(r, pid, action, pres));
    if (action.type === "remove" && typeof action.target === "string") await kv.del(privKey(code, action.target));
    await touch(code, pid);
    return NextResponse.json(await roomPayload(next, pid), { headers: NO_STORE });
  } catch (e) {
    return fail(e);
  }
}
