"use client";

import { Check } from "lucide-react";
import type { PublicPlayer } from "@/lib/types";
import { cx } from "@/components/ui";
import { EMOJI_FONT, emojiFor } from "./avatar";

/**
 * One shared group-status row for every "everyone confirms" moment (room readiness, the four preparation steps,
 * End Game voting, score confirmations): four circular emoji avatars in one row, names below.
 *  - waiting: neutral gray ring, no badge
 *  - done:    ring turns brand green (~200ms) and a small green ✓ badge scales in at the bottom-right
 * Status is also written under each name, so it never relies on color alone.
 */
export type SlotState = "done" | "waiting" | "help";
export interface FourPlayerStatusProps {
  players: PublicPlayer[];
  me: string;
  state: (p: PublicPlayer) => SlotState;
  /** Text under a confirmed player's name, e.g. "Ready", "Agreed", "Confirmed". */
  doneLabel: string;
  /** Optional different text for AI demo seats when done, e.g. "Demo vote", "Simulated". */
  aiDoneLabel?: string;
  /** "{n} of 4 {countLabel}" shown above the row (omit to hide). */
  countLabel?: string;
  /** Seats without a player yet (lobby / matching). */
  showOpenSeats?: boolean;
  /** Optional per-player label override (e.g. "Correction"). */
  labelFor?: (p: PublicPlayer) => string | undefined;
  /** Pop-in animation for avatars that appear (matching). */
  animateIn?: boolean;
  className?: string;
}

export function FourPlayerStatus({ players, me, state, doneLabel, aiDoneLabel, countLabel, showOpenSeats, animateIn, className, labelFor }: FourPlayerStatusProps) {
  const slots: (PublicPlayer | null)[] = showOpenSeats ? [0, 1, 2, 3].map((s) => players.find((p) => p.seat === s) || null) : players.slice(0, 4);
  const n = players.filter((p) => state(p) === "done").length;
  return (
    <section className={cx("flex flex-col gap-3", className)} aria-label={countLabel ? `${n} of 4 ${countLabel}` : "Players"}>
      {countLabel && <p className={cx("t-sub font-semibold text-center", n === 4 ? "text-green-text" : "text-green-text")} aria-live="polite">{n} of 4 {countLabel}</p>}
      <ul className="grid grid-cols-4 gap-1.5">
        {slots.map((p, i) => {
          if (!p)
            return (
              <li key={`open-${i}`} className="flex flex-col items-center min-w-0 text-center" aria-label="Open seat">
                <span className="h-[52px] w-[52px] max-[359px]:h-11 max-[359px]:w-11 rounded-full border-2 border-dashed border-dash" aria-hidden />
                <span className="mt-1.5 t-sub text-muted truncate max-w-full">Open seat</span>
              </li>
            );
          const st = state(p);
          const ai = p.kind === "virtual";
          const done = st === "done";
          const label = labelFor?.(p) ?? (done ? (ai && aiDoneLabel ? aiDoneLabel : doneLabel) : st === "help" ? "Viewing help" : "Waiting");
          // No repeated "AI" tag under each avatar; screens with demo seats show one short disclosure instead.
          const sub = p.id === me ? `You · ${label}` : label;
          return (
            <li key={`${i}-${p.name}`} className={cx("flex flex-col items-center min-w-0 text-center", animateIn && "mt-pop")} aria-label={`${p.name}${ai ? ", simulated participant" : ""}${p.id === me ? " (you)" : ""}: ${label}`}>
              <span className="relative" aria-hidden>
                <span className={cx("h-[52px] w-[52px] max-[359px]:h-11 max-[359px]:w-11 rounded-full bg-card border-2 flex items-center justify-center transition-colors duration-200 ease-[cubic-bezier(0.2,0,0,1)]", done ? "border-green" : "border-line")}>
                  <span style={{ ...EMOJI_FONT, fontSize: 28, lineHeight: 1 }}>{emojiFor(p)}</span>
                </span>
                <span className={cx("absolute -bottom-0.5 -right-0.5 h-[19px] w-[19px] rounded-full bg-green-strong text-white ring-2 ring-page flex items-center justify-center transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)]", done ? "opacity-100 scale-100" : "opacity-0 scale-50")}>
                  <Check size={11} strokeWidth={3.2} />
                </span>
              </span>
              <span className="mt-1.5 t-sub font-medium truncate max-w-full" title={p.name}>{p.name}</span>
              <span className={cx("t-meta truncate max-w-full", done ? "text-green-text" : "text-muted")}>{sub}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
