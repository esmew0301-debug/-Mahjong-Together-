/**
 * Mahjong Rule Assistant — a free, deterministic, knowledge-based assistant.
 * No external AI service is called. Answers come only from the rule data in ./rules.
 */
import type { Msg, MsgAction, RoomStatus, VariantId } from "../types";
import type { GenericFacet, RuleEntry } from "./types";
import { fill, nextStep, stepById, variantById } from "../variants";
import {
  ENTRIES, asksCurrentStep, entryById, entryForStage, genericFacet, hasCJK, isHandStrategy, isOffTopic, isPrediction, normalize, scoreEntries,
} from "./intent-matcher";

export const ASSISTANT_NAME = "Mahjong Rule Assistant";
export const FALLBACK = "I don't have a verified explanation for that question in this demo.";
const ZH_NOTE = "\n\n（这个问题目前只有英文解释。）";

export interface Ctx {
  variant: VariantId | null;
  stepId: string | null;
  status: RoomStatus;
  decisions: Record<string, string>;
  history: Msg[]; // same conversation only (public OR this player's private chat)
  scope: "shared" | "private";
}
export interface Reply {
  text: string;
  title?: string;
  topicId?: string;
  detail?: string;
  source?: string;
  actions?: MsgAction[];
}

const SUITS: [RegExp, string][] = [[/bamboo|tiao|条/, "Bamboo"], [/dots?|circles?|tong|筒/, "Dots"], [/characters?|wan|万/, "Characters"]];

export function lastTopicId(history: Msg[]): string | undefined {
  for (let i = history.length - 1; i >= 0; i--) if (history[i].sender === "ai" && history[i].topicId) return history[i].topicId;
  return undefined;
}

function fullDetail(e: RuleEntry): string {
  const parts = [e.detail];
  if (e.misunderstandings?.length) parts.push("Common misunderstandings\n" + e.misunderstandings.map((m) => "• " + m).join("\n"));
  const v = variantById(e.variant === "general" ? null : e.variant);
  parts.push(`Rule type: ${e.ruleType === "info" ? "background" : e.ruleType}${v ? ` · ${v.rulesetName}` : ""}`);
  return parts.join("\n\n");
}

function followupActions(e: RuleEntry, used: string): MsgAction[] {
  const a: MsgAction[] = [];
  if (e.example && used !== "example") a.push({ label: "Show an Example", type: "followup", topicId: e.id, facet: "example" });
  if (e.simple && used !== "simple") a.push({ label: "Explain More Simply", type: "followup", topicId: e.id, facet: "simple" });
  return a;
}

/** Build an answer for a known topic and facet. */
export function answerTopic(e: RuleEntry, facet: GenericFacet | string, opts: { zh?: boolean; question?: string; ctx?: Ctx } = {}): Reply {
  const zh = !!opts.zh;
  let text = "";
  let zhText: string | undefined;
  const specific = e.facets?.find((f) => f.id === facet);
  if (specific) {
    const suit = SUITS.find(([re]) => re.test((opts.question || "").toLowerCase()))?.[1] || "that suit";
    text = specific.answer.replace(/\{suit\}/g, suit);
    zhText = specific.zh;
  } else if (facet === "simple") {
    text = e.simple ? `In short: ${e.simple}` : `Here's the short version: ${e.short}`;
    zhText = e.zhAlt?.simple;
  } else if (facet === "example") {
    text = e.example ? `Here's an example. ${e.example}` : `I don't have a verified example for ${e.topic} yet. Here's the rule again: ${e.short}`;
    zhText = e.zhAlt?.example;
  } else if (facet === "why") {
    text = e.why ? `Good question. ${e.why}` : `I don't have a verified explanation of why this rule exists. Here's what it says: ${e.short}`;
    zhText = e.zhAlt?.why;
  } else if (facet === "next") {
    const step = opts.ctx ? stepById(opts.ctx.stepId) : null;
    const n = step && opts.ctx ? nextStep(step, opts.ctx.decisions) : null;
    text = e.next || (n ? `Next up: ${n.title}. ${fill(n.short, opts.ctx!.decisions)}` : `I don't have a verified "what happens next" for ${e.topic}. ${e.short}`);
    zhText = e.zhAlt?.next;
  } else if (facet === "detail") {
    text = e.short;
  } else {
    text = e.short;
    zhText = e.zh;
  }
  if (zh) text = zhText || text + ZH_NOTE;
  return { text, topicId: e.id, detail: fullDetail(e), source: e.source, actions: followupActions(e, facet) };
}

function currentStepReply(ctx: Ctx, facet: GenericFacet | null): Reply {
  const step = stepById(ctx.stepId);
  if (ctx.status === "variant" || ctx.status === "lobby")
    return { text: "Right now your group is choosing a Mahjong variant. Everyone picks one below — all four need to choose the same variant to continue. Tap \"Rules & Cultural Background\" on any option to compare.", actions: [{ label: "Compare the Variants", type: "followup", topicId: "g-variants", facet: "short" }] };
  if (!step)
    return { text: "You're in the game now — keep playing with your physical tiles. Ask me about any rule, or open My Private Coach for questions about your own hand.", actions: [{ label: "Browse Rule Topics", type: "browse" }] };
  const e = entryForStage(step.id);
  if (facet && e) return answerTopic(e, facet, { ctx });
  return {
    title: step.title,
    text: `${step.intro} ${fill(step.short, ctx.decisions)}`,
    topicId: e?.id,
    detail: fill(step.detail, ctx.decisions) + (e ? "" : ""),
    source: step.source,
    actions: e ? followupActions(e, "short") : undefined,
  };
}

const STRATEGY: Record<VariantId | "none", string> = {
  sichuan: "Which suit did you choose as your missing suit? In general: discard your missing-suit tiles first, keep pairs and tiles that connect (like 4–5 of one suit), and watch which tiles other players pung.",
  riichi: "Which tiles are you waiting on, and is your hand still closed? In general: make sure your hand has a yaku, keep it closed if you want to declare riichi, and remember furiten when choosing your wait.",
  cantonese: "In general: aim for a hand that reaches your table's minimum faan, keep track of discarded tiles, and remember you can only chow from the player on your left.",
  american: "Which hands on this year's card are you aiming for? In general: keep two or three possible card hands in mind, use the Charleston to pass tiles that fit none of them, and save jokers for groups of three or more.",
  none: "Which Mahjong variant are you playing? Once I know, I can share general beginner guidance.",
};

export function answerQuestion(question: string, ctx: Ctx): Reply {
  const n = normalize(question);
  const zh = hasCJK(question);
  const step = stepById(ctx.stepId);

  if (isOffTopic(n)) return fallback(ctx, "I can only help with Mahjong rules and setup.");
  if (isPrediction(n))
    return { text: "I can't predict who will win — that depends on the tiles and the players at your table. I can explain how winning works, though.", actions: winActions(ctx.variant) };
  if (isHandStrategy(n))
    return { text: `I can't see your tiles, but I can help you think through the decision. ${STRATEGY[ctx.variant || "none"]}`, actions: [{ label: "Browse Rule Topics", type: "browse" }] };

  const g = genericFacet(n);
  if (asksCurrentStep(n) && !g) return currentStepReply(ctx, null);

  const scored = scoreEntries(question, ctx.variant, step?.id);
  const top = scored[0] && scored[0].score >= 2 ? scored[0] : null;

  // Follow-up with no new topic: reuse the last topic from this conversation.
  if (!top && g) {
    const last = entryById(lastTopicId(ctx.history)) || entryForStage(ctx.stepId);
    if (last) return answerTopic(last, g, { zh, question, ctx });
    if (g === "next" && step) return currentStepReply(ctx, "next");
    return { text: "Which rule would you like me to go over? Ask about it by name, or pick a topic.", actions: [{ label: "View Current Rule", type: "current" }, { label: "Browse Rule Topics", type: "browse" }] };
  }
  if (!top) return fallback(ctx);

  // Ambiguous: two different topics score about the same and nothing in the question breaks the tie.
  const second = scored[1];
  if (second && second.score >= 2 && top.score - second.score < 1 && !top.facetId && !second.facetId && second.entry.id !== top.entry.id) {
    return {
      text: `Are you asking about ${top.entry.topic} or ${second.entry.topic}?`,
      actions: [
        { label: top.entry.topic, type: "followup", topicId: top.entry.id, facet: g || "short" },
        { label: second.entry.topic, type: "followup", topicId: second.entry.id, facet: g || "short" },
      ],
    };
  }
  return answerTopic(top.entry, top.facetId || g || "short", { zh, question, ctx });
}

function winActions(v: VariantId | null): MsgAction[] {
  const id = v === "riichi" ? "ri-yaku" : v === "cantonese" ? "hk-winning" : v === "american" ? "am-card" : "sc-winning";
  return [{ label: "How Winning Works", type: "followup", topicId: id, facet: "short" }];
}

function fallback(ctx: Ctx, extra?: string): Reply {
  const actions: MsgAction[] = [];
  if (ctx.stepId) actions.push({ label: "View Current Rule", type: "current" });
  actions.push({ label: "Browse Rule Topics", type: "browse" }, { label: "Ask a Simpler Question", type: "focus" });
  return { text: `${FALLBACK}${extra ? " " + extra : ""} Try asking about the current step, or pick a rule topic.`, actions };
}

// ---------- Local group-question summary (deterministic topic grouping) ----------
const QWORDS = /^(what|why|how|does|do|is|are|can|could|should|which|when|who|where|will|would|wait)\b/i;
export function looksLikeQuestion(t: string) {
  return /[?？]/.test(t) || QWORDS.test(t.trim()) || /don'?t understand|confused|not sure|不懂|不明白|吗|什么|为什么|怎么/i.test(t);
}

export function summarizeQuestions(msgs: { name: string; text: string }[], ctx: Ctx): Reply & { topicIds: string[] } {
  const groups = new Map<string, { entry: RuleEntry; names: string[]; quotes: string[] }>();
  const unmatched: { name: string; text: string }[] = [];
  for (const m of msgs.filter((x) => looksLikeQuestion(x.text))) {
    const s = scoreEntries(m.text, ctx.variant, ctx.stepId)[0];
    if (!s || s.score < 2) { unmatched.push(m); continue; }
    const g = groups.get(s.entry.id) || { entry: s.entry, names: [], quotes: [] };
    if (!g.names.includes(m.name)) g.names.push(m.name);
    g.quotes.push(`“${m.text.length > 70 ? m.text.slice(0, 67) + "…" : m.text}”`);
    groups.set(s.entry.id, g);
  }
  if (!groups.size && !unmatched.length)
    return { text: "I couldn't identify a clear rules question in the recent messages. Please choose a topic or ask a specific question.", actions: [{ label: "Browse Rule Topics", type: "browse" }], topicIds: [] };
  const join = (a: string[]) => (a.length < 2 ? a[0] : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);
  const lines: string[] = [];
  let i = 1;
  for (const g of groups.values()) lines.push(`${i++}. ${g.entry.topic}\n${join(g.names)} asked about this: ${g.quotes.join(" ")}`);
  if (unmatched.length) lines.push(`Not matched to a rule topic: ${unmatched.map((u) => `${u.name} — “${u.text}”`).join("; ")}. Try asking ${unmatched.length > 1 ? "these" : "it"} directly.`);
  const topicIds = [...groups.keys()];
  return {
    title: "Questions Your Group Raised",
    text: `${lines.join("\n\n")}\n\nGrouped by matching rule topics — not an AI-written summary.`,
    topicId: topicIds[0],
    actions: [...groups.values()].map((g) => ({ label: `Explain ${g.entry.topic}`, type: "followup" as const, topicId: g.entry.id, facet: "short" })),
    topicIds,
  };
}

export const FACET_LABEL: Record<string, string> = { simple: "Explain more simply", example: "Show an example", why: "Why?", next: "What happens next?", short: "Explain", detail: "Full rule" };
export function topicsForBrowse(v: VariantId | null) {
  return ENTRIES.filter((e) => (v ? e.variant === v : true) || e.variant === "general").map((e) => ({ id: e.id, topic: e.topic, variant: e.variant }));
}
