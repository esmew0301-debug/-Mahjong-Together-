import type { VariantId } from "../types";
import type { GenericFacet, RuleEntry } from "./types";
import { SICHUAN } from "./rules/sichuan";
import { RIICHI } from "./rules/riichi";
import { CANTONESE } from "./rules/cantonese";
import { AMERICAN } from "./rules/american";
import { GENERAL } from "./rules/general";

export const ENTRIES: RuleEntry[] = [...SICHUAN, ...RIICHI, ...CANTONESE, ...AMERICAN, ...GENERAL];
export const entryById = (id?: string | null) => ENTRIES.find((e) => e.id === id);
export const entriesFor = (v: VariantId | null) => ENTRIES.filter((e) => e.variant === v || e.variant === "general");
export const entryForStage = (stepId?: string | null) => (stepId ? ENTRIES.find((e) => e.stages?.includes(stepId)) : undefined);

const CJK = /[一-鿿]/;
export const hasCJK = (s: string) => CJK.test(s);

export interface Norm { pad: string; raw: string }
export function normalize(q: string): Norm {
  const raw = q.toLowerCase().replace(/[’']/g, "").replace(/[？?！!，,。.、；;：:“”"()（）]/g, " ");
  return { raw, pad: " " + raw.replace(/[^a-z0-9一-鿿\s-]/g, " ").replace(/-/g, " ").replace(/\s+/g, " ").trim() + " " };
}
export function hit(n: Norm, phrase: string): boolean {
  const p = phrase.replace(/^~/, "").toLowerCase();
  if (CJK.test(p)) return n.raw.includes(p);
  const q = p.replace(/-/g, " ");
  return n.pad.includes(` ${q} `) || n.pad.includes(` ${q}s `);
}
function weight(phrase: string): number {
  if (phrase.startsWith("~")) return 1.5;
  if (CJK.test(phrase)) return Math.min(4, 1 + phrase.length * 0.75);
  const words = phrase.trim().split(/\s+/).length;
  return words * 2 + (words > 1 ? 1 : 0);
}

const VARIANT_CUES: Record<VariantId, string[]> = {
  sichuan: ["sichuan", "四川", "川麻"],
  riichi: ["riichi", "japanese", "japan", "日本", "立直麻将"],
  cantonese: ["cantonese", "hong kong", "广东", "香港", "港式"],
  american: ["american", "mah jongg", "nmjl", "美式", "美国"],
};
export function mentionedVariants(n: Norm): VariantId[] {
  return (Object.keys(VARIANT_CUES) as VariantId[]).filter((v) => VARIANT_CUES[v].some((c) => hit(n, c)));
}

const GENERIC: [GenericFacet, string[]][] = [
  ["simple", ["simpler", "more simply", "simply", "easier", "eli5", "in plain", "plain english", "basic version", "简单", "通俗", "简单点"]],
  ["example", ["example", "for instance", "show me how", "举例", "例子", "比如说"]],
  ["why", ["why", "purpose", "point of", "necessary", "reason", "为什么", "为啥"]],
  ["next", ["what happens next", "what comes next", "whats next", "next step", "after that", "then what", "接下来", "然后呢"]],
  ["detail", ["more detail", "in detail", "detailed", "full rule", "full explanation", "tell me more", "详细"]],
];
export function genericFacet(n: Norm): GenericFacet | null {
  for (const [f, cues] of GENERIC) if (cues.some((c) => hit(n, c))) return f;
  return null;
}
const PRONOUNS = ["it", "that", "this", "those", "那个", "这个", "这条"];
export const refersBack = (n: Norm) => PRONOUNS.some((p) => hit(n, p));

const CURRENT = ["what should we do now", "what do we do now", "what should we do", "what do we do", "what now", "what do i do now", "current step", "this step", "where are we", "现在做什么", "现在该做什么", "这一步", "现在干嘛"];
export const asksCurrentStep = (n: Norm) => CURRENT.some((c) => hit(n, c));

export const isPrediction = (n: Norm) => /\b(who (will|is going to|gonna) win|predict|going to win|lucky)\b/.test(n.pad) || hit(n, "谁会赢");
export const isOffTopic = (n: Norm) => /\b(weather|forecast|stock|news|movie|recipe|homework|football|basketball|bitcoin|president)\b/.test(n.pad) || ["天气", "股票", "新闻"].some((c) => hit(n, c));
export const isHandStrategy = (n: Norm) =>
  /\b(which (exact )?tile should i (discard|throw|play|keep)|what (tile )?should i (discard|throw)|best (move|discard|tile)|should i (keep|discard|throw|break)|what should i keep|my (hand|tiles))\b/.test(n.pad) || ["打哪张", "出哪张", "该打什么"].some((c) => hit(n, c));

export interface Scored { entry: RuleEntry; score: number; facetId?: string }

export function scoreEntries(q: string, variant: VariantId | null, stageId?: string | null): Scored[] {
  const n = normalize(q);
  const mentioned = mentionedVariants(n);
  const allowed: (VariantId | "general")[] = mentioned.length ? [...mentioned, "general"] : variant ? [variant, "general"] : ["sichuan", "riichi", "cantonese", "american", "general"];
  const out: Scored[] = [];
  for (const e of ENTRIES) {
    if (!allowed.includes(e.variant)) continue;
    let score = 0;
    for (const k of [...e.keywords, ...(e.synonyms || [])]) if (hit(n, k)) score += weight(k);
    if (score <= 0) continue;
    const facet = e.facets?.find((f) => f.cues.some((c) => hit(n, c)));
    if (facet) score += 2;
    if (stageId && e.stages?.includes(stageId)) score += 1;
    if (mentioned.length && e.variant === "general" && mentioned.length < 2) score -= 1;
    out.push({ entry: e, score, facetId: facet?.id });
  }
  return out.sort((a, b) => b.score - a.score);
}
