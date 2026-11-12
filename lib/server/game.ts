import "server-only";
import type { GameEvent, LedgerEntry, Room } from "../types";
import { HttpError, msg, nameOf, push, uid } from "./room";
import { profileFor, type ExhaustClaim, type KongClaim, type Transfer, type WinClaim, type Calc } from "../scoring";
import { exhaustCalc, kongCalc, suggestedNextDealer, winCalc } from "../scoring/sichuan";

/**
 * Post-setup game engine: hands, events, four-player verification, immutable point ledger, session review.
 * Every mutation happens inside the room's atomic compare-and-set (see mutate()).
 */

const ids = (r: Room) => r.players.map((p) => p.id);

export function initGame(r: Room) {
  r.hand = { n: 1, dealerId: r.dealerId, winners: [], ended: false };
  r.hands = [];
  r.events = [];
  r.ledger = [];
  r.ledgerVersion = 0;
  r.nextDealerVotes = {};
  r.finalReview = null;
}

function ensure(r: Room) {
  if (!r.hand) initGame(r);
  return { hand: r.hand!, events: r.events!, ledger: r.ledger! };
}

export const activePlayers = (r: Room) => {
  const prof = profileFor(r.variant);
  const winners = r.hand?.winners || [];
  return ids(r).filter((id) => !(prof.winnersLeave && winners.includes(id)));
};

export function balances(r: Room) {
  const b: Record<string, number> = Object.fromEntries(ids(r).map((id) => [id, 0]));
  for (const e of r.ledger || []) {
    b[e.from] = (b[e.from] || 0) - e.amount;
    b[e.to] = (b[e.to] || 0) + e.amount;
  }
  return b;
}

const cleanTransfers = (r: Room, raw: unknown): Transfer[] => {
  if (!Array.isArray(raw)) return [];
  const members = ids(r);
  return raw.slice(0, 12).map((t) => {
    const o = t as Record<string, unknown>;
    const amount = Math.round(Number(o.amount));
    const from = String(o.from), to = String(o.to);
    if (!members.includes(from) || !members.includes(to)) throw new HttpError(400, "Transfers must be between players in this room.");
    if (from === to) throw new HttpError(400, "A player can't pay themselves.");
    if (!(amount > 0 && amount <= 100000)) throw new HttpError(400, "Each transfer needs a positive whole number of points.");
    return { from, to, amount };
  });
};

const kongIncomeThisHand = (r: Room): Transfer[] => {
  const kongEvents = new Set((r.events || []).filter((e) => e.type === "kong" && e.hand === r.hand!.n && e.status === "committed").map((e) => e.id));
  return (r.ledger || []).filter((l) => kongEvents.has(l.eventId) && !l.correctionOf).map((l) => ({ from: l.from, to: l.to, amount: l.amount }));
};

/** Compute the proposed transfers for an event. Server-side only; client numbers are used only for manual entries. */
function compute(r: Room, type: GameEvent["type"], actor: string | undefined, claim: Record<string, unknown>, manualRaw: unknown): Calc {
  const prof = profileFor(r.variant);
  const name = (id: string) => nameOf(r, id);
  const active = activePlayers(r);
  if (type === "correction") {
    const transfers = cleanTransfers(r, manualRaw);
    const orig = (r.events || []).find((e) => e.id === claim.corrects);
    return {
      transfers,
      manual: true,
      lines: [
        `Correction of: ${orig ? describe(r, orig) : "unknown event"}`,
        "On approval, the original transfers are reversed and these replacement transfers are recorded. History is kept.",
        claim.invalidWin ? "This also marks the original win as invalid." : "",
      ].filter(Boolean),
      problems: orig && orig.status === "committed" && !orig.correctedBy ? [] : ["Only a committed, not-yet-corrected event can be corrected."],
    };
  }
  if (!prof.automatic || type === "manual") {
    const transfers = cleanTransfers(r, manualRaw);
    return { transfers, manual: true, lines: ["Manual group-verified score: the table entered these transfers."], problems: [] };
  }
  if (type === "win") return winCalc(actor!, claim as unknown as WinClaim, active, name);
  if (type === "kong") return kongCalc(claim as unknown as KongClaim, active, name);
  return exhaustCalc(claim as ExhaustClaim, active, kongIncomeThisHand(r), name);
}

const METHOD: Record<string, string> = { self_draw: "self-draw (Zi Mo)", discard: "on a discard (Dian Pao)", kong_replacement: "on a kong replacement tile", robbing_kong: "by robbing a kong" };
const STRUCT: Record<string, string> = { standard: "standard hand (four sets + a pair)", seven_pairs: "seven pairs", all_pungs: "all pungs", other: "other / not sure" };
const KONG: Record<string, string> = { concealed: "concealed kong", exposed: "exposed kong (from a discard)", added: "added kong" };

export function describe(r: Room, e: GameEvent): string {
  const c = e.claim as Record<string, string | number | boolean | undefined>;
  const n = (id?: unknown) => (id ? nameOf(r, String(id)) : "");
  if (e.type === "win") return `${n(e.actor)} — win ${METHOD[String(c.method)] || ""}${c.fromId ? ` from ${n(c.fromId)}` : ""}, ${STRUCT[String(c.structure)] || ""}`;
  if (e.type === "kong") return `${n(c.actorId)} — ${KONG[String(c.kind)] || "kong"}${c.fromId ? ` from ${n(c.fromId)}` : ""}`;
  if (e.type === "exhaust") return "Wall exhausted — end-of-hand settlement";
  if (e.type === "correction") return `Correction: ${String(c.reason || "")}`;
  return `Manual score entry${c.note ? `: ${c.note}` : ""}`;
}

function sanitizeClaim(type: GameEvent["type"], raw: Record<string, unknown>, pid: string): Record<string, unknown> {
  const s = (v: unknown) => (v === undefined || v === null ? undefined : String(v).slice(0, 60));
  if (type === "win")
    return {
      method: ["self_draw", "discard", "kong_replacement", "robbing_kong"].includes(String(raw.method)) ? raw.method : "self_draw",
      fromId: s(raw.fromId),
      structure: ["standard", "seven_pairs", "all_pungs", "other"].includes(String(raw.structure)) ? raw.structure : "other",
      pureSuit: !!raw.pureSuit,
      roots: Math.max(0, Math.min(4, Math.floor(Number(raw.roots) || 0))),
      goldenHook: !!raw.goldenHook,
      lastTile: !!raw.lastTile,
      missingSuitCleared: ["yes", "no", "unsure"].includes(String(raw.missingSuitCleared)) ? raw.missingSuitCleared : undefined,
    };
  if (type === "kong") return { actorId: s(raw.actorId) || pid, kind: ["concealed", "exposed", "added"].includes(String(raw.kind)) ? raw.kind : "concealed", fromId: s(raw.fromId) };
  if (type === "exhaust") {
    const status: Record<string, string> = {};
    const values: Record<string, number> = {};
    for (const [k, v] of Object.entries((raw.status as Record<string, unknown>) || {})) if (["ready", "not_ready", "missing_suit"].includes(String(v))) status[k] = String(v);
    for (const [k, v] of Object.entries((raw.readyValues as Record<string, unknown>) || {})) values[k] = Number(v);
    return { status, readyValues: values };
  }
  if (type === "correction") return { corrects: s(raw.corrects), invalidWin: !!raw.invalidWin, reason: String(raw.reason || "").slice(0, 200) };
  return { note: String(raw.note || "").slice(0, 120), method: s(raw.method), structure: s(raw.structure) };
}

function endHand(r: Room, reason: "wins" | "exhausted") {
  const h = r.hand!;
  h.ended = true;
  h.endReason = reason;
  r.status = "hand_review";
  r.nextDealerVotes = {};
  (r.hands ||= []).push({ n: h.n, dealerId: h.dealerId, winners: [...h.winners], endReason: reason });
  push(r, msg({ sender: "system", text: reason === "wins" ? `Hand ${h.n} is complete.` : `Hand ${h.n} ended: wall exhausted.` }));
}

function commit(r: Room, e: GameEvent) {
  if (e.voidProposed) {
    e.status = "voided";
    e.committedAt = Date.now();
    push(r, msg({ sender: "system", text: `Voided by all four players: ${describe(r, e)}. No points changed.` }));
    return;
  }
  const approvals = ids(r);
  const entries: LedgerEntry[] = [];
  if (e.type === "correction") {
    const orig = r.events!.find((x) => x.id === (e.claim.corrects as string))!;
    for (const t of orig.transfers)
      entries.push({ id: uid(), eventId: e.id, hand: e.hand, from: t.to, to: t.from, amount: t.amount, reason: `Reversal of ${describe(r, orig)}`, ruleVersion: e.ruleVersion, approvals, ts: Date.now(), correctionOf: orig.id });
    orig.correctedBy = e.id;
    if (e.claim.invalidWin && orig.type === "win" && r.hand && !r.hand.ended) r.hand.winners = r.hand.winners.filter((w) => w !== orig.actor);
  }
  for (const t of e.transfers)
    entries.push({ id: uid(), eventId: e.id, hand: e.hand, from: t.from, to: t.to, amount: t.amount, reason: describe(r, e), ruleVersion: e.ruleVersion, approvals, ts: Date.now() });
  r.ledger!.push(...entries);
  r.ledgerVersion = (r.ledgerVersion || 0) + 1;
  e.status = "committed";
  e.committedAt = Date.now();
  const total = e.transfers.reduce((s, t) => s + t.amount, 0);
  push(r, msg({ sender: "system", text: `Verified by all four players: ${describe(r, e)}${total ? ` · ${total} point${total === 1 ? "" : "s"} transferred` : ""}.` }));

  const h = r.hand!;
  if (e.type === "win" && !h.ended && e.actor && !h.winners.includes(e.actor)) {
    if (!h.winners.length) h.firstWinFrom = (e.claim.method === "discard" ? (e.claim.fromId as string) : null) || null;
    h.winners.push(e.actor);
    const prof = profileFor(r.variant);
    if (h.winners.length >= prof.maxWinners) endHand(r, "wins");
    else if (prof.winnersLeave)
      push(r, msg({ sender: "ai", aiMode: "demo", title: "The hand continues", text: `${nameOf(r, e.actor)} has won and leaves this hand. Under Blood Battle, the other ${activePlayers(r).length} players keep playing until three players have won or the wall is exhausted.` }));
  }
  if (e.type === "exhaust" && !h.ended) endHand(r, "exhausted");
}

export function applyGameAction(r: Room, pid: string, a: Record<string, unknown>): boolean {
  const me = nameOf(r, pid);
  switch (a.type) {
    case "event-submit": {
      const { hand, events } = ensure(r);
      const type = String(a.eventType) as GameEvent["type"];
      if (!["win", "kong", "exhaust", "correction", "manual"].includes(type)) throw new HttpError(400, "Unknown event type");
      const idem = String(a.idem || "").slice(0, 64);
      if (!idem) throw new HttpError(400, "Missing idempotency key");
      if (events.some((e) => e.idem === idem)) return true; // retry of the same submission: no duplicate
      const inHand = r.status === "playing" && !hand.ended;
      if (type === "correction") {
        if (r.status !== "playing" && r.status !== "hand_review") throw new HttpError(409, "Corrections can be made during play or hand review.");
      } else if (!inHand) throw new HttpError(409, "No hand is in progress.");
      const claim = sanitizeClaim(type, (a.claim as Record<string, unknown>) || {}, pid);
      const actor = type === "win" ? pid : type === "kong" ? String(claim.actorId) : undefined;
      if (actor && !ids(r).includes(actor)) throw new HttpError(400, "Unknown player");
      const pending = events.filter((e) => e.status === "pending");
      if (type === "win" && pending.some((e) => e.type === "win" && e.actor === pid)) throw new HttpError(409, "You already have a win waiting for verification.");
      if (type === "win" && hand.winners.includes(pid)) throw new HttpError(409, "You have already won this hand.");
      if (type === "exhaust" && pending.some((e) => e.type === "exhaust")) throw new HttpError(409, "A wall-exhausted settlement is already waiting for verification.");
      if (type === "correction" && pending.some((e) => e.type === "correction" && e.claim.corrects === claim.corrects)) throw new HttpError(409, "That event already has a pending correction.");
      const calc = compute(r, type, actor, claim, a.transfers);
      if (calc.problems.length) throw new HttpError(422, calc.problems.join(" "));
      const prof = profileFor(r.variant);
      const e: GameEvent = {
        id: uid(), idem, type, hand: hand.n, by: pid, actor, claim,
        transfers: calc.transfers, lines: calc.lines, limitations: calc.limitations, manual: calc.manual,
        ruleVersion: calc.manual ? `${prof.rulesetId} (manual)` : prof.rulesetId, source: prof.source,
        status: "pending", rev: 1, approvals: {}, notes: [], createdAt: Date.now(),
      };
      events.push(e);
      if (type === "win")
        push(r, msg({ sender: "ai", aiMode: "demo", title: `${me} Has Declared a Win!`, text: `Claim: ${describe(r, e).replace(`${me} — `, "")}.\n\nReveal and check the real tiles together, then each player confirms or disputes below. No points change until all four confirm.`, actions: [{ label: "Review Win", type: "focus", topicId: `event:${e.id}` }] }));
      else push(r, msg({ sender: "system", text: `${me} submitted for verification: ${describe(r, e)}.` }));
      return true;
    }
    case "event-respond": {
      const { events } = ensure(r);
      const e = events.find((x) => x.id === a.eventId);
      if (!e || e.status !== "pending") throw new HttpError(409, "This event is no longer waiting for verification.");
      if (Number(a.rev) !== e.rev) throw new HttpError(409, "This event was revised. Review the new version before responding.");
      const v = String(a.value);
      if (!["confirm", "explain", "dispute"].includes(v)) throw new HttpError(400, "Invalid response");
      e.approvals[pid] = v as GameEvent["approvals"][string];
      const note = String(a.note || "").trim().slice(0, 200);
      if (note || v !== "confirm") e.notes.push({ by: pid, text: note || (v === "explain" ? "Needs an explanation" : "Disputes this result"), rev: e.rev, ts: Date.now() });
      if (v === "dispute") push(r, msg({ sender: "system", text: `${me} disputed: ${describe(r, e)}. The event is paused until it's corrected or everyone confirms.` }));
      if (v === "explain") push(r, msg({ sender: "system", text: `${me} asked for an explanation of: ${describe(r, e)}.` }));
      if (ids(r).length === 4 && ids(r).every((id) => e.approvals[id] === "confirm")) commit(r, e);
      return true;
    }
    case "event-revise": {
      const { events } = ensure(r);
      const e = events.find((x) => x.id === a.eventId);
      if (!e || e.status !== "pending") throw new HttpError(409, "Only a pending event can be revised.");
      if (Number(a.rev) !== e.rev) throw new HttpError(409, "Someone else revised this event first. Review the latest version.");
      if (a.void) {
        e.voidProposed = true;
        e.lines = [`Proposal to void this item. If all four confirm, it is removed without changing any points.`, ...e.lines.filter((l) => !l.startsWith("Proposal to void"))];
      } else {
        if (e.type === "win" && pid !== e.actor) throw new HttpError(403, "Only the player who declared the win can change its details. Others can dispute or propose voiding it.");
        const claim = a.claim ? sanitizeClaim(e.type, a.claim as Record<string, unknown>, pid) : e.claim;
        const actor = e.type === "kong" ? String(claim.actorId) : e.actor;
        const calc = compute(r, e.type, actor, claim, a.transfers ?? e.transfers);
        if (calc.problems.length) throw new HttpError(422, calc.problems.join(" "));
        Object.assign(e, { claim, actor, transfers: calc.transfers, lines: calc.lines, limitations: calc.limitations, voidProposed: false });
      }
      e.rev += 1;
      e.approvals = {}; // every revision needs fresh approval from all four
      e.notes.push({ by: pid, text: a.void ? "Proposed voiding this item" : "Revised the details", rev: e.rev, ts: Date.now() });
      push(r, msg({ sender: "system", text: `${me} ${a.void ? "proposed voiding" : "revised"}: ${describe(r, e)}. Approvals were reset (version ${e.rev}).` }));
      return true;
    }
    case "next-dealer": {
      ensure(r);
      if (r.status !== "hand_review") throw new HttpError(409, "The hand isn't finished.");
      if ((r.events || []).some((e) => e.status === "pending")) throw new HttpError(409, "Resolve the pending items before the next hand.");
      const d = String(a.dealerId);
      if (!ids(r).includes(d)) throw new HttpError(400, "Unknown player");
      r.nextDealerVotes = { ...(r.nextDealerVotes || {}), [pid]: d };
      const votes = ids(r).map((id) => r.nextDealerVotes![id]);
      if (ids(r).length === 4 && votes.every((v) => v && v === votes[0])) {
        const n = r.hand!.n + 1;
        r.hand = { n, dealerId: d, winners: [], ended: false };
        r.status = "playing";
        r.nextDealerVotes = {};
        push(r, msg({ sender: "ai", aiMode: "demo", title: `Hand ${n}`, text: `${nameOf(r, d)} deals. Reshuffle, build the wall, and deal as before. Scores carry over from earlier hands.` }));
      }
      return true;
    }
    case "finish-request": {
      ensure(r);
      if (pid !== r.hostId) throw new HttpError(403, "Only the host can finish the session.");
      if (r.status !== "playing" && r.status !== "hand_review") throw new HttpError(409, "The session can't be finished right now.");
      const pend = (r.events || []).filter((e) => e.status === "pending");
      if (pend.length) throw new HttpError(409, `Resolve ${pend.length} pending item${pend.length > 1 ? "s" : ""} first (confirm, correct, or void each one).`);
      r.finalReview = { ledgerVersion: r.ledgerVersion || 0, resp: {}, returnTo: r.status };
      r.status = "session_review";
      push(r, msg({ sender: "system", text: `${me} asked everyone to review the final scores.` }));
      return true;
    }
    case "final-respond": {
      const f = r.finalReview;
      if (r.status !== "session_review" || !f) throw new HttpError(409, "There is no final score review.");
      if (Number(a.ledgerVersion) !== (r.ledgerVersion || 0) || f.ledgerVersion !== (r.ledgerVersion || 0)) throw new HttpError(409, "The scores changed. Review the latest version.");
      if (a.value === "correct") {
        r.status = f.returnTo;
        r.finalReview = null;
        push(r, msg({ sender: "system", text: `${me} requested a correction. Use Record Event → Review or Correct Event, then the host can finish again.` }));
        return true;
      }
      f.resp[pid] = "confirm";
      if (ids(r).length === 4 && ids(r).every((id) => f.resp[id] === "confirm")) {
        r.status = "complete";
        if (r.hand && !r.hand.ended) (r.hands ||= []).push({ n: r.hand.n, dealerId: r.hand.dealerId, winners: [...r.hand.winners], endReason: "finished" });
        push(r, msg({ sender: "system", text: "All four players confirmed the final scores. Game complete!" }));
      }
      return true;
    }
    case "finish-cancel": {
      if (pid !== r.hostId || r.status !== "session_review" || !r.finalReview) throw new HttpError(409, "Nothing to cancel.");
      r.status = r.finalReview.returnTo;
      r.finalReview = null;
      push(r, msg({ sender: "system", text: `${me} cancelled the final review. Play continues.` }));
      return true;
    }
  }
  return false;
}

export function suggestion(r: Room): string | null {
  const h = r.hand;
  if (!h) return null;
  if (r.variant !== "sichuan") return null;
  const multi = false;
  return suggestedNextDealer(h.dealerId, h.winners[0] || null, h.firstWinFrom || null, multi);
}
