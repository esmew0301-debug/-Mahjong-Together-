import { NextResponse } from "next/server";
import { afterExplanation, cleanName, msg, mutate, nameOf, push, HttpError } from "@/lib/server/room";
import { currentStep, followup, publicAnswer, summarize, type Reply } from "@/lib/server/ai";
import { FACET_LABEL } from "@/lib/mahjong/assistant";
import { entryById } from "@/lib/mahjong/intent-matcher";
import { fail, requireMember, roomPayload, NO_STORE } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const aiMsg = (a: Reply, kind?: "summary") => msg({ sender: "ai", aiMode: "demo", kind, ...a });

// Shared Table Rule Assistant (local, free). The asking player's message is posted publicly, then the answer.
// Each request is a single atomic room update, so every participant sees the same exchange.
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code: raw } = await ctx.params;
    const { code, room, pid } = await requireMember(raw);
    if (room.status === "complete") throw new HttpError(409, "This session has ended.");
    const body = await req.json().catch(() => ({}));
    let next;
    if (body.mode === "summarize") {
      next = await mutate(code, (r) => {
        push(r, msg({ sender: "system", text: `${nameOf(r, pid)} asked the Rule Assistant to summarize the group's questions.` }));
        const s = summarize(r);
        const { topicIds: _ids, ...reply } = s;
        push(r, aiMsg(reply, "summary"));
        if (s.topicIds.length) {
          r.lastSummaryTs = Date.now();
          afterExplanation(r, true, s.topicId, entryById(s.topicId)?.topic);
        }
      });
    } else if (body.mode === "followup" || body.mode === "current") {
      next = await mutate(code, (r) => {
        const e = entryById(String(body.topicId || ""));
        const facet = String(body.facet || "short");
        const label = body.mode === "current" ? "What should we do now?" : `${FACET_LABEL[facet] || "Explain"} — ${e?.topic || "this rule"}`;
        push(r, msg({ sender: pid, name: nameOf(r, pid), text: label }));
        const a = body.mode === "current" ? currentStep(r, r.messages, "shared") : followup(r, r.messages, "shared", String(body.topicId), facet);
        if (!a) throw new HttpError(400, "Unknown topic");
        push(r, aiMsg(a));
        afterExplanation(r, false, a.topicId);
      });
    } else {
      const q = cleanName(body.question, 1000);
      if (!q) throw new HttpError(400, "Empty question");
      next = await mutate(code, (r) => {
        push(r, msg({ sender: pid, name: nameOf(r, pid), text: q }));
        const a = publicAnswer(r, q);
        push(r, aiMsg(a));
        afterExplanation(r, false, a.topicId);
      });
    }
    return NextResponse.json(await roomPayload(next, pid), { headers: NO_STORE });
  } catch (e) {
    return fail(e);
  }
}
