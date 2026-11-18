"use client";

import * as React from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The supplied InteractiveHoverButton, kept structurally identical:
 *  1. the label (translate-x-1) slides right and fades out on hover (group-hover:translate-x-12 opacity-0),
 *  2. an identical label + ArrowRight slides in from the right (translate-x-12 → -translate-x-1),
 *  3. a small spot at left 20% / top 40% expands to fill the whole rounded button (scale 1.8), clipped by overflow-hidden.
 * Integration changes only: brand colours instead of shadcn tokens, content-driven width instead of the demo's w-32,
 * the app's button height/typography, `icon`, keyboard focus showing the same state, a static disabled state, and
 * prefers-reduced-motion (no sliding). Use ONLY for main calls to action.
 */
export interface InteractiveHoverButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** "primary" = brand green with a deep-green spot; "secondary" = white with a brand-green spot (as in the source);
   *  "ok" = the existing confirmed state (static). */
  tone?: "primary" | "secondary" | "ok";
  icon?: React.ReactNode;
  /** Text alias kept from the source API (`text="Start Watching"`). */
  text?: string;
}

export const InteractiveHoverButton = React.forwardRef<HTMLButtonElement, InteractiveHoverButtonProps>(
  ({ children, text, className, tone = "primary", icon, type = "button", disabled, ...props }, ref) => {
    const label = children ?? text ?? "Button";
    const animated = !disabled && tone !== "ok";
    const move = "transition-all duration-300 motion-reduce:transition-none";
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        {...props}
        className={cn(
          "ihb group relative isolate cursor-pointer overflow-hidden rounded-full border text-center t-btn font-semibold min-h-12 px-8 inline-flex items-center justify-center",
          "outline-none focus-visible:ring-[3px] focus-visible:ring-green/40 disabled:cursor-not-allowed",
          tone === "primary" && "bg-green-strong border-green-strong text-white shadow-btn disabled:bg-disabled disabled:border-disabled disabled:text-disabled-text disabled:shadow-none",
          tone === "secondary" && "bg-card border-line text-green-text disabled:text-disabled-text",
          tone === "ok" && "bg-green-soft text-green-text border-green",
          className,
        )}
      >
        <span className={cn("ihb-label inline-flex items-center gap-2", animated && cn("translate-x-1 group-hover:translate-x-12 group-hover:opacity-0 group-focus-visible:translate-x-12 group-focus-visible:opacity-0 motion-reduce:translate-x-0", move))}>
          {icon}{label}
        </span>
        {animated && (
          <>
            <div aria-hidden className={cn("ihb-reveal absolute top-0 left-0 z-10 flex h-full w-full translate-x-12 items-center justify-center gap-2 text-white opacity-0 group-hover:-translate-x-1 group-hover:opacity-100 group-focus-visible:-translate-x-1 group-focus-visible:opacity-100", move)}>
              <span>{label}</span>
              <ArrowRight size={18} strokeWidth={2.25} />
            </div>
            <div aria-hidden className={cn("ihb-spot absolute left-[20%] top-[40%] -z-10 h-2 w-2 scale-[1] rounded-lg group-hover:left-[0%] group-hover:top-[0%] group-hover:h-full group-hover:w-full group-hover:scale-[1.8] group-focus-visible:left-[0%] group-focus-visible:top-[0%] group-focus-visible:h-full group-focus-visible:w-full group-focus-visible:scale-[1.8]",
              tone === "primary" ? "bg-[#1f4d16] dark:bg-[#24591a]" : "bg-green-strong", move)} />
          </>
        )}
      </button>
    );
  },
);
InteractiveHoverButton.displayName = "InteractiveHoverButton";
