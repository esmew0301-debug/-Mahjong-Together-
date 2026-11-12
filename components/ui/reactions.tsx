"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Msg, ReactionId } from "@/lib/types";

export const REACTIONS: { id: ReactionId; label: string }[] = [
  { id: "heart", label: "Heart" },
  { id: "up", label: "Thumbs up" },
  { id: "down", label: "Thumbs down" },
  { id: "haha", label: "Laugh" },
  { id: "emphasis", label: "Emphasize" },
  { id: "question", label: "Question" },
];

const EMOJI: Record<ReactionId, string> = { heart: "❤️", up: "👍", down: "👎", haha: "😂", emphasis: "‼️", question: "❓" };

/** Standard Unicode emoji rendered by the device's own emoji font (no copied app assets). */
export function ReactionGlyph({ id, size = 22 }: { id: ReactionId; size?: number }) {
  return <span aria-hidden style={{ fontSize: size, lineHeight: 1 }}>{EMOJI[id]}</span>;
}

function useLongPress(onLong: () => void, ms = 420) {
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const clear = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      start.current = { x: e.clientX, y: e.clientY };
      clear();
      timer.current = window.setTimeout(() => {
        timer.current = null;
        onLong();
      }, ms);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) clear();
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear, // fires when the page starts scrolling
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault(); // right-click on desktop, long-press on Android
      clear();
      onLong();
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onLong();
      }
    },
  };
}

/**
 * Wraps a message bubble: press and hold (or right-click / Enter) opens a reaction tray above it.
 * Reactions are attached as small badges on the bubble's top corner, like iMessage tapbacks.
 */
export function Reactable({
  msg,
  me,
  side,
  nameOf,
  onReact,
  children,
}: {
  msg: Msg;
  me: string;
  side: "left" | "right";
  nameOf: (id: string) => string;
  onReact?: (msgId: string, reaction: ReactionId | null) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [below, setBelow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const mine = msg.reactions?.[me];
  const openTray = () => {
    if (!onReact) return;
    const r = ref.current?.getBoundingClientRect();
    setBelow(!!r && r.top < 150);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
    setOpen(true);
  };
  const press = useLongPress(openTray);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  const pick = (id: ReactionId) => {
    onReact?.(msg.id, mine === id ? null : id);
    setOpen(false);
  };

  // Group reactions for the attached badges.
  const entries = Object.entries(msg.reactions || {});
  const groups = REACTIONS.map((r) => ({ ...r, who: entries.filter(([, v]) => v === r.id).map(([k]) => k) })).filter((g) => g.who.length);

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-[var(--overlay)]" onClick={() => setOpen(false)} aria-hidden />}
      <div ref={ref} className={`relative ${open ? "z-50" : ""} ${groups.length ? "mt-3" : ""}`}>
        {groups.length > 0 && (
          <div className={`absolute -top-4 ${side === "right" ? "-left-3" : "-right-3"} z-[1] flex -space-x-1.5`}>
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={openTray}
                aria-label={`${g.label} from ${g.who.map(nameOf).join(", ")}`}
                title={g.who.map(nameOf).join(", ")}
                className={`h-7 min-w-7 px-1 rounded-full bg-bg border flex items-center justify-center gap-0.5 shadow-card ${g.who.includes(me) ? "border-green" : "border-line"}`}
              >
                <ReactionGlyph id={g.id} size={14} />
                {g.who.length > 1 && <span className="text-[11px] font-semibold text-muted pr-0.5">{g.who.length}</span>}
              </button>
            ))}
          </div>
        )}
        <div
          {...press}
          role={onReact ? "button" : undefined}
          tabIndex={onReact ? 0 : undefined}
          aria-haspopup={onReact ? "menu" : undefined}
          aria-label={onReact ? "Message. Press and hold to react." : undefined}
          className="select-none [-webkit-touch-callout:none] [-webkit-user-select:none] outline-offset-4 rounded-[18px]"
        >
          {children}
        </div>
        <AnimatePresence>
          {open && (
            <motion.div
              role="menu"
              aria-label="React to this message"
              initial={reduce ? false : { opacity: 0, scale: 0.6, y: below ? -6 : 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85, transition: { duration: 0.12 } }}
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 30 }}
              style={{ transformOrigin: `${below ? "top" : "bottom"} ${side === "right" ? "right" : "left"}` }}
              className={`absolute z-50 ${below ? "top-full mt-2" : "bottom-full mb-2"} ${side === "right" ? "right-0" : "left-0"} flex items-center gap-0.5 px-1.5 py-1 bg-bg rounded-full border border-line shadow-sheet`}
            >
              {REACTIONS.map((r, i) => (
                <motion.button
                  key={r.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={mine === r.id}
                  aria-label={r.label}
                  onClick={() => pick(r.id)}
                  initial={reduce ? false : { scale: 0.3, opacity: 0, rotate: 0 }}
                  animate={reduce ? { scale: 1, opacity: 1 } : { scale: [0.3, 1.15, 1], opacity: 1, rotate: [0, -12, 9, -4, 0] }}
                  transition={reduce ? { duration: 0 } : { delay: 0.04 + i * 0.035, duration: 0.45, ease: "easeOut" }}
                  className={`h-11 w-11 rounded-full flex items-center justify-center ${mine === r.id ? "bg-green-soft ring-1 ring-green" : "hover:bg-surface"}`}
                >
                  <ReactionGlyph id={r.id} />
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
