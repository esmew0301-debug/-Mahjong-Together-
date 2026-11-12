import type { RuleEntry } from "../types";

export const GENERAL: RuleEntry[] = [
  {
    id: "g-variants", variant: "general", ruleset: "overview", topic: "Differences between variants", ruleType: "info",
    examples: ["What is different about this variant?", "What's the difference between Sichuan and Riichi?"],
    keywords: ["difference", "differences", "different", "compare", "comparison", "versus", "vs", "which variant", "which one should we", "other variants"],
    synonyms: ["区别", "不同", "有什么不一样"],
    short: "Sichuan uses only 108 suit tiles, a missing suit, and no chow. Riichi needs a yaku to win and uses dora. Hong Kong uses flowers and faan scoring. American Mah Jongg uses jokers, the Charleston, and a yearly card of hands.",
    simple: "Sichuan: three suits and a missing suit. Riichi: special scoring patterns. Hong Kong: flowers and faan. American: jokers and a yearly card.",
    detail: "• Sichuan — 108 tiles, Ding Que, no chow, play continues after a win.\n• Japanese Riichi — 136 tiles, yaku required, riichi, furiten, dora.\n• Hong Kong — 144 tiles, flowers and seasons, chow from the left, faan minimum.\n• American — 152 tiles with jokers, Charleston, hands from the current NMJL card.",
    source: "This app's rule profiles (see each variant's sources)",
  },
  {
    id: "g-history", variant: "general", ruleset: "overview", topic: "Mahjong history", ruleType: "info",
    examples: ["Where does Mahjong come from?"],
    keywords: ["history", "origin", "origins", "where does mahjong come from", "invented", "tradition"],
    synonyms: ["历史", "起源"],
    short: "Mahjong took shape in China in the 19th century, during the Qing dynasty, and spread internationally in the early 20th century. Regional styles grew from there, including Sichuan, Hong Kong, Japanese Riichi, and American Mah Jongg.",
    detail: "Exact origins are debated, so this app sticks to the widely accepted outline above.",
    source: "General historical overviews of Mahjong",
  },
  {
    id: "g-help", variant: "general", ruleset: "overview", topic: "What I can help with", ruleType: "info",
    examples: ["What can you do?", "Who are you?"],
    keywords: ["what can you do", "who are you", "are you ai", "are you chatgpt", "help me", "how do you work", "what do you know"],
    synonyms: ["你是谁", "你能做什么"],
    short: "I'm the Mahjong Rule Assistant. I can help explain common Mahjong rules, setup steps, and differences between variants. I answer from built-in rule notes — I'm not a generative AI, so I can't see your tiles or answer everything.",
    detail: "Try asking about the current step, a rule name (like Ding Que or furiten), how many tiles you need, or who starts. Use \"Explain more simply\" or \"Show an example\" after an answer.",
    source: "Mahjong Together",
  },
];
