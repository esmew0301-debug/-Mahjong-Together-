import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fail, NO_STORE } from "@/lib/server/http";
import { hostAct, hostCookieName, hostState, requireClass, requireHost } from "@/lib/server/watch";

export const dynamic = "force-dynamic";
async function auth(params: Promise<{ cls: string }>) {
  const c = requireClass((await params).cls);
  requireHost((await cookies()).get(hostCookieName)?.value);
  return c;
}
export async function GET(_req: Request, ctx: { params: Promise<{ cls: string }> }) {
  try {
    return NextResponse.json(await hostState(await auth(ctx.params)), { headers: NO_STORE });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: Request, ctx: { params: Promise<{ cls: string }> }) {
  try {
    const c = await auth(ctx.params);
    return NextResponse.json(await hostAct(c, await req.json().catch(() => ({}))), { headers: NO_STORE });
  } catch (e) {
    return fail(e);
  }
}
