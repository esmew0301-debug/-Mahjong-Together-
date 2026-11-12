import "server-only";
import type { Msg, Room } from "../types";
import { answerQuestion, answerTopic, summarizeQuestions, type Ctx, type Reply } from "../mahjong/assistant";
import { entryById, hasCJK } from "../mahjong/intent-matcher";
import { nameOf } from "./room";

/**
 * Server bridge to the local Mahjong Rule Assistant.
 * Nothing here calls an external AI service — answers come from bundled rule data.
 */
export type { Reply };

function ctxFor(r: Room, history: Msg[], scope: Ctx["scope"]): Ctx {
  return { variant: r.variant, stepId: r.stepId, status: r.status, decisions: r.decisions, history, scope };
}

export function publicAnswer(r: Room, question: string): Reply {
  return answerQuestion(question, ctxFor(r, r.messages, "shared"));
}

export function followup(r: Room, history: Msg[], scope: Ctx["scope"], topicId: string, facet: string, question = ""): Reply | null {
  const e = entryById(topicId);
  return e ? answerTopic(e, facet, { zh: hasCJK(question), ctx: ctxFor(r, history, scope) }) : null;
}

export function currentStep(r: Room, history: Msg[], scope: Ctx["scope"]): Reply {
  return answerQuestion("What should we do now?", ctxFor(r, history, scope));
}

export function summarize(r: Room) {
  const qs = r.messages
    .filter((m) => m.ts > r.lastSummaryTs && m.sender !== "ai" && m.sender !== "system")
    .slice(-12)
    .map((m) => ({ name: m.name || nameOf(r, m.sender), text: m.text }));
  return summarizeQuestions(qs, ctxFor(r, r.messages, "shared"));
}

export const PHOTO_NOTE = "Photo analysis is not available in this free demo. You can describe your tiles using text instead.";

export function privateAnswer(r: Room, history: Msg[], question: string): Reply {
  return answerQuestion(question, ctxFor(r, history, "private"));
}
