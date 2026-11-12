import { NextResponse } from "next/server";
import { cleanName, msg, privKey, TTL, HttpError } from "@/lib/server/room";
import { kv } from "@/lib/server/kv";
import { PHOTO_NOTE, currentStep, followup, privateAnswer } from "@/lib/server/ai";
import { FACET_LABEL } from "@/lib/mahjong/assistant";
import { entryById } from "@/lib/mahjong/intent-matcher";
import { fail, requireMember, NO_STORE } from "@/lib/server/http";
import { REACTION_IDS, type Msg, type ReactionId } from "@/lib/types";

export const dynamic = "force-dynamic";

// Private coach: authorized by the caller's own session cookie; only their own key is ever read or written.
async function load(code: string, pid: string): Promise<Msg[]> {
  const raw = await kv.get(privKey(code, pid));
  return raw ? JSON.parse(raw) : [];
}

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code: raw } = await ctx.params;
    const { code, pid } = await requireMember(raw);
    return NextResponse.json({ messages: await load(code, pid) }, { headers: NO_STORE });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code: raw } = await ctx.params;
    const { code, room, pid } = await requireMember(raw);
    if (room.status === "complete") throw new HttpError(409, "This session has ended.");
    const body = await req.json().catch(() => ({}));
    const history = await load(code, pid);
    if (body.mode === "react") {
      // Reactions in your own private chat (still only readable by you).
      const m = history.find((x) => x.id === body.msgId);
      if (!m) throw new HttpError(404, "Message not found");
      if (m.sender !== pid) throw new HttpError(400, "Only messages from players can receive reactions.");
      const val = body.reaction === null ? null : String(body.reaction);
      if (val !== null && !REACTION_IDS.includes(val as ReactionId)) throw new HttpError(400, "Unknown reaction");
      const next = { ...(m.reactions || {}) };
      if (val === null || next[pid] === val) delete next[pid];
      else next[pid] = val as ReactionId;
      m.reactions = next;
      await kv.set(privKey(code, pid), JSON.stringify(history), TTL);
      return NextResponse.json({ messages: history }, { headers: NO_STORE });
    }
    let mine: Msg;
    let reply: Msg;
    if (body.photo) {
      // Photos are never uploaded: the client sends only a flag. No image analysis exists in this free demo.
      mine = msg({ sender: pid, text: cleanName(body.question, 1000) || "Can you look at my tiles?", hadPhoto: true });
      reply = msg({ sender: "ai", aiMode: "unavailable", text: PHOTO_NOTE });
    } else if (body.mode === "followup" || body.mode === "current") {
      const facet = String(body.facet || "short");
      const e = entryById(String(body.topicId || ""));
      mine = msg({ sender: pid, text: body.mode === "current" ? "What should we do now?" : `${FACET_LABEL[facet] || "Explain"} — ${e?.topic || "this rule"}` });
      const a = body.mode === "current" ? currentStep(room, history, "private") : followup(room, history, "private", String(body.topicId), facet);
      if (!a) throw new HttpError(400, "Unknown topic");
      reply = msg({ sender: "ai", aiMode: "demo", ...a });
    } else {
      const q = cleanName(body.question, 1000);
      if (!q) throw new HttpError(400, "Empty question");
      mine = msg({ sender: pid, text: q });
      reply = msg({ sender: "ai", aiMode: "demo", ...privateAnswer(room, history, q) });
    }
    const next = [...history, mine, reply].slice(-60);
    await kv.set(privKey(code, pid), JSON.stringify(next), TTL);
    return NextResponse.json({ messages: next }, { headers: NO_STORE });
  } catch (e) {
    return fail(e);
  }
}
