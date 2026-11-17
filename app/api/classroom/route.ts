import { NextResponse } from "next/server";
import { validClassCode } from "@/lib/server/match";
import { NO_STORE } from "@/lib/server/http";
import { INVALID_CLASSROOM } from "@/lib/classroom";

export const dynamic = "force-dynamic";
// Validate a shared classroom code (server-side). Unknown codes never create a new classroom.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const code = validClassCode(body.code);
  if (!code) return NextResponse.json({ error: INVALID_CLASSROOM }, { status: 404, headers: NO_STORE });
  return NextResponse.json({ ok: true, code }, { headers: NO_STORE });
}
