/**
 * Deterministic scoring for Sichuan Blood Battle, following ONE documented ruleset:
 * Mahjong Planet, "planet-blood-battle-v1" (mahjong-planet.com/rules/sichuan).
 *  - Standard hand = 1 point. Add fan, cap at 3, value = 2^fan (1, 2, 4, 8).
 *  - Fan: all pungs 1; pure suit 2; seven pairs 2 (replaces all pungs; a quad counts as two pairs);
 *    root 1 each (a quad in seven pairs also earns a root); golden hook 1; kong replacement 1;
 *    robbing an added kong 1; last tile 1. Patterns stack unless stated otherwise.
 *  - Self-draw is not a fan: every other player still in the hand pays value + 1.
 *  - Discard win: the discarder pays the hand value to each winner.
 *  - Kongs: concealed 2 from each other active player; added 1 from each; exposed 2 from the discarder alone.
 *    Only an added kong can be robbed; a robbed kong pays nothing.
 *  - Wall exhaustion: a player still holding their missing suit pays 8 to each cleared player; each clean
 *    not-ready player pays each ready player the highest base hand value that player could complete;
 *    a not-ready remaining player returns all kong income.
 */
import type { Calc, ExhaustClaim, KongClaim, Transfer, WinClaim } from "./types";

export const SICHUAN_PROFILE = {
  variant: "sichuan",
  rulesetId: "planet-blood-battle-v1",
  name: "Mahjong Planet Sichuan Blood Battle (planet-blood-battle-v1)",
  source: "mahjong-planet.com/rules/sichuan",
  automatic: true,
  maxWinners: 3,
  winnersLeave: true,
};
export const CAP_FAN = 3;

export function winFan(c: WinClaim): { fan: number; capped: number; value: number; lines: string[]; problems: string[] } {
  const lines: string[] = ["Standard hand: 1 point (0 fan)"];
  const problems: string[] = [];
  let fan = 0;
  if (c.structure === "other") problems.push("This structure isn't a recognized winning hand in this ruleset. Use Not Sure / manual review at the table.");
  if (c.structure === "seven_pairs") { fan += 2; lines.push("Seven pairs: +2 fan (replaces all pungs)"); }
  else if (c.structure === "all_pungs") { fan += 1; lines.push("All pungs: +1 fan"); }
  if (c.pureSuit) { fan += 2; lines.push("Pure suit (full flush): +2 fan"); }
  const roots = Math.max(0, Math.min(4, Math.floor(c.roots || 0)));
  if (roots) { fan += roots; lines.push(`Root ×${roots}: +${roots} fan`); }
  if (c.goldenHook) {
    if (c.structure === "seven_pairs") problems.push("Golden hook (all sets melded, waiting on the pair) can't combine with seven pairs.");
    else { fan += 1; lines.push("Golden hook: +1 fan"); }
  }
  if (c.method === "kong_replacement") { fan += 1; lines.push("Kong replacement (self-draw right after your own kong): +1 fan"); }
  if (c.method === "robbing_kong") { fan += 1; lines.push("Robbing an added kong: +1 fan"); }
  if (c.lastTile) { fan += 1; lines.push("Last tile: +1 fan"); }
  if (c.missingSuitCleared === "no") problems.push("You still hold your declared missing suit, so this can't be a win under this ruleset.");
  if (c.missingSuitCleared === "unsure") problems.push("Check your declared missing suit first — a win can't be confirmed while that's unresolved.");
  const capped = Math.min(fan, CAP_FAN);
  const value = 2 ** capped;
  lines.push(`Total ${fan} fan${fan > CAP_FAN ? ` → capped at ${CAP_FAN}` : ""} → hand value 2^${capped} = ${value}`);
  return { fan, capped, value, lines, problems };
}

/** active = players still in the hand (not yet won), INCLUDING the winner. */
export function winCalc(winner: string, c: WinClaim, active: string[], name: (id: string) => string): Calc {
  const f = winFan(c);
  const problems = [...f.problems];
  const lines = [...f.lines];
  const transfers: Transfer[] = [];
  let limitations: string | undefined;
  if (!active.includes(winner)) problems.push(`${name(winner)} has already won this hand.`);
  if (c.method === "discard" || c.method === "robbing_kong") {
    if (!c.fromId || c.fromId === winner) problems.push(c.method === "discard" ? "Choose who discarded the winning tile." : "Choose whose added kong was robbed.");
    else if (!active.includes(c.fromId)) problems.push(`${name(c.fromId)} is no longer in this hand.`);
    else {
      transfers.push({ from: c.fromId, to: winner, amount: f.value });
      lines.push(c.method === "discard" ? `Discard win: ${name(c.fromId)} (discarder) pays ${f.value}` : `Robbing a kong: ${name(c.fromId)} pays ${f.value}`);
      if (c.method === "robbing_kong") limitations = "The source says only an added kong can be robbed and the robbed kong pays nothing; it does not name the payer explicitly. Here the robbed player pays as the discarder of that tile — confirm this at the table.";
    }
  } else {
    const payers = active.filter((p) => p !== winner);
    for (const p of payers) transfers.push({ from: p, to: winner, amount: f.value + 1 });
    lines.push(`Self-draw: each other player still in the hand pays ${f.value} + 1 = ${f.value + 1}`);
  }
  return { transfers, lines, fan: f.fan, value: f.value, manual: false, problems, limitations };
}

export function kongCalc(c: KongClaim, active: string[], name: (id: string) => string): Calc {
  const problems: string[] = [];
  const lines: string[] = [];
  const transfers: Transfer[] = [];
  if (!active.includes(c.actorId)) problems.push(`${name(c.actorId)} is no longer in this hand.`);
  const others = active.filter((p) => p !== c.actorId);
  if (c.kind === "concealed") {
    others.forEach((p) => transfers.push({ from: p, to: c.actorId, amount: 2 }));
    lines.push("Concealed kong: each other active player pays 2");
  } else if (c.kind === "added") {
    others.forEach((p) => transfers.push({ from: p, to: c.actorId, amount: 1 }));
    lines.push("Added kong: each other active player pays 1 (only an added kong can be robbed — if it is robbed, this kong pays nothing)");
  } else {
    if (!c.fromId || c.fromId === c.actorId) problems.push("Choose who discarded the tile that was konged.");
    else if (!active.includes(c.fromId)) problems.push(`${name(c.fromId)} is no longer in this hand.`);
    else { transfers.push({ from: c.fromId, to: c.actorId, amount: 2 }); lines.push(`Exposed kong from a discard: ${name(c.fromId)} (discarder) pays 2`); }
  }
  lines.push("After any kong, draw a replacement tile from the end of the wall.");
  return { transfers, lines, manual: false, problems };
}

/** kongIncome = committed kong transfers of this hand (to settle refunds for not-ready players). */
export function exhaustCalc(c: ExhaustClaim, active: string[], kongIncome: Transfer[], name: (id: string) => string): Calc {
  const problems: string[] = [];
  const lines: string[] = ["Wall exhausted: the hand ends."];
  const transfers: Transfer[] = [];
  const st = c.status || {};
  const missing = active.filter((p) => !st[p]);
  if (missing.length) problems.push(`Set the status for: ${missing.map(name).join(", ")}.`);
  const holders = active.filter((p) => st[p] === "missing_suit");
  const cleared = active.filter((p) => st[p] && st[p] !== "missing_suit");
  const ready = active.filter((p) => st[p] === "ready");
  const notReadyClean = active.filter((p) => st[p] === "not_ready");
  for (const h of holders) for (const p of cleared) transfers.push({ from: h, to: p, amount: 8 });
  if (holders.length && cleared.length) lines.push(`Still holding the missing suit: ${holders.map(name).join(", ")} pays 8 to each cleared player`);
  for (const n of notReadyClean) for (const r of ready) {
    const v = Number(c.readyValues?.[r]);
    if (![1, 2, 4, 8].includes(v)) { problems.push(`Enter the highest hand value ${name(r)} could complete (1, 2, 4 or 8).`); continue; }
    transfers.push({ from: n, to: r, amount: v });
  }
  if (notReadyClean.length && ready.length) lines.push("Not ready: each clean not-ready player pays each ready player the highest base hand value that player could complete");
  const refunders = [...holders, ...notReadyClean];
  const refunds = kongIncome.filter((t) => refunders.includes(t.to));
  for (const t of refunds) transfers.push({ from: t.to, to: t.from, amount: t.amount });
  if (refunds.length) lines.push(`Kong refunds: ${[...new Set(refunds.map((t) => name(t.to)))].join(", ")} return all kong income from this hand`);
  if (!transfers.length && !problems.length) lines.push("No settlement payments are due.");
  return { transfers, lines, manual: false, problems };
}

/** Dealer rotation is not stated by Mahjong Planet; Jiada's Sichuan setup is offered only as the suggestion the group confirms. */
export function suggestedNextDealer(currentDealer: string | null, firstWinner: string | null, firstWinFromDiscarder: string | null, multiWinSameDiscard: boolean) {
  if (!firstWinner) return currentDealer;
  if (multiWinSameDiscard && firstWinFromDiscarder) return firstWinFromDiscarder;
  return firstWinner;
}
