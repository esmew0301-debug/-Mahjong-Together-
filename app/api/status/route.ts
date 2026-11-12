import { NextResponse } from "next/server";
import { backend } from "@/lib/server/kv";

export const dynamic = "force-dynamic";
// The Rule Assistant is local and free; there is no AI service to report.
export async function GET() {
  return NextResponse.json({ backend, assistant: "local" }, { headers: { "Cache-Control": "no-store" } });
}
