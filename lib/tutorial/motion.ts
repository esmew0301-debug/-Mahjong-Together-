/** Central motion tokens for every instructional animation (all variants share these). */
export const tutorialMotion = {
  duration: {
    micro: 150,
    feedback: 220,
    transition: 300,
    tileMove: 650,
    tileSequence: 900,
    pauseBetweenSteps: 450,
  },
  stage: {
    initial: 400, // Stage 1 — show starting positions
    highlight: 200, // Stage 2 — highlight involved tiles
  },
  easing: {
    standard: "cubic-bezier(0.2, 0, 0, 1)",
    entrance: "cubic-bezier(0.16, 1, 0.3, 1)",
    linear: "linear",
  },
  scale: { emphasis: 1.04, normal: 1 },
  opacity: { inactive: 0.45, active: 1 },
} as const;
