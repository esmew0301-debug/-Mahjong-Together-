import type { VariantId } from "../types";

/** A question-specific answer inside a topic, chosen when one of its cues appears in the question. */
export interface Facet {
  id: string;
  cues: string[]; // English phrases (word-bounded) or Chinese fragments
  answer: string; // may contain {suit}
  zh?: string;
}

export interface RuleEntry {
  id: string;
  variant: VariantId | "general";
  ruleset: string;
  topic: string; // display title
  examples: string[]; // sample questions (used in tests and the topic browser)
  keywords: string[]; // weighted phrases; prefix "~" = weak (weight 1.5)
  synonyms?: string[]; // extra phrases incl. Chinese
  short: string;
  zh?: string;
  detail: string;
  steps?: string[];
  misunderstandings?: string[];
  simple?: string;
  example?: string;
  why?: string;
  next?: string;
  facets?: Facet[];
  zhAlt?: Partial<Record<"simple" | "example" | "why" | "next", string>>;
  related?: string[];
  stages?: string[]; // step ids from lib/variants.ts
  source: string;
  ruleType: "mandatory" | "optional" | "house rule" | "info";
}

export type GenericFacet = "short" | "simple" | "example" | "why" | "next" | "detail";
