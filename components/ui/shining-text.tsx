"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * ShiningText — animated shimmer text (from the provided component).
 * Adapted for this app: typed props, a light-background palette by default,
 * a non-heading element by default, and no animation when the user prefers reduced motion.
 */
export function ShiningText({
  text,
  className = "",
  as = "span",
  colors = ["#8E8E93", "#1C1C1E"],
}: {
  text: string;
  className?: string;
  as?: "span" | "h1" | "p";
  colors?: [base: string, highlight: string];
}) {
  const reduce = useReducedMotion();
  const [base, hi] = colors;
  const Comp = as === "h1" ? motion.h1 : as === "p" ? motion.p : motion.span;
  if (reduce) return <span className={`text-muted ${className}`}>{text}</span>;
  return (
    <Comp
      className={`bg-[length:200%_100%] bg-clip-text text-transparent ${className}`}
      style={{ backgroundImage: `linear-gradient(110deg, ${base}, 35%, ${hi}, 50%, ${base}, 75%, ${base})` }}
      initial={{ backgroundPosition: "200% 0" }}
      animate={{ backgroundPosition: "-200% 0" }}
      transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
    >
      {text}
    </Comp>
  );
}
