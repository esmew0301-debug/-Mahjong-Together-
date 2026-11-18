"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import Avatar from "./components-primitives-avatar";

const ORB = 60;
const EDGE = 24; // default distance from the viewport's right / bottom edge
const MARGIN = 8; // never closer than this to any viewport edge
const GAP = 12; // orb ↔ panel spacing
const PANEL_W = 376;
const DRAG_THRESHOLD = 6; // px of movement before a press counts as a drag (a drag never opens the chat)
const POS_KEY = "mt.coachOrbPos"; // this browser session only

type Pos = { x: number; y: number };
const clamp = (p: Pos): Pos => ({
  x: Math.max(MARGIN, Math.min(window.innerWidth - ORB - MARGIN, p.x)),
  y: Math.max(MARGIN, Math.min(window.innerHeight - ORB - MARGIN, p.y)),
});

/**
 * The ONE chat entry point for the existing Private Coach: a draggable green AI orb.
 * Portalled into <body> with position:fixed, so it sits at the bottom-right of the browser VIEWPORT (never inside the
 * table, sidebar or discussion panel) and is never clipped. Render it only where the screen had a Coach chat opener.
 * Click (no drag) → one blink + toggle the floating chat panel. The chat inside is the screen's existing Coach
 * (`children`); the panel stays mounted while closed, so the conversation keeps its state.
 * `avoid`: selector of controls the DEFAULT spot must not cover (the orb then rests just above them).
 */
export function PrivateCoachLauncher({ open, setOpen, title, subtitle, avoid, children, panelId = "private-coach-panel" }: {
  open: boolean;
  setOpen: (v: boolean) => void;
  title: string;
  subtitle?: string;
  avoid?: string;
  children?: React.ReactNode;
  panelId?: string;
}) {
  const orbRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);
  const [blink, setBlink] = useState(0);
  const [pos, setPos] = useState<Pos | null>(null);
  const [vp, setVp] = useState({ w: 1440, h: 900 });
  const custom = useRef(false); // true once the user dragged the orb
  const drag = useRef<{ x0: number; y0: number; px: number; py: number; dragging: boolean; id: number } | null>(null);
  const suppressClick = useRef(false);
  const [dragging, setDragging] = useState(false);
  const wasOpen = useRef(open);

  const defaultPos = useCallback((): Pos => {
    let y = window.innerHeight - ORB - EDGE;
    const x = window.innerWidth - ORB - EDGE;
    if (avoid) {
      for (const el of document.querySelectorAll<HTMLElement>(avoid)) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (x < r.right && x + ORB > r.left && y < r.bottom && y + ORB > r.top) y = Math.min(y, r.top - ORB - 12);
      }
    }
    return clamp({ x, y });
  }, [avoid]);

  useLayoutEffect(() => {
    setMounted(true);
    let saved: Pos | null = null;
    try { const raw = sessionStorage.getItem(POS_KEY); if (raw) saved = JSON.parse(raw); } catch {}
    custom.current = !!saved;
    setVp({ w: window.innerWidth, h: window.innerHeight });
    setPos(saved ? clamp(saved) : defaultPos());
    const onResize = () => {
      setVp({ w: window.innerWidth, h: window.innerHeight });
      setPos((p) => (custom.current && p ? clamp(p) : defaultPos()));
    };
    window.addEventListener("resize", onResize);
    // an avoided control may render or move after mount: keep the default spot clear of it (until the user drags)
    const t = window.setInterval(() => {
      if (custom.current || drag.current) return;
      const d = defaultPos();
      setPos((p) => (p && p.x === d.x && p.y === d.y ? p : d));
    }, 800);
    return () => { window.removeEventListener("resize", onResize); window.clearInterval(t); };
  }, [defaultPos]);

  // focus: into the panel on open, back to the orb on close
  useEffect(() => {
    if (open && !wasOpen.current) {
      requestAnimationFrame(() => {
        const field = panelRef.current?.querySelector<HTMLElement>("textarea:not([disabled]), input[type=text]:not([disabled]), input:not([type]):not([disabled])");
        (field || closeRef.current)?.focus({ preventScroll: true });
      });
    } else if (!open && wasOpen.current && panelRef.current?.contains(document.activeElement)) {
      orbRef.current?.focus({ preventScroll: true });
    }
    wasOpen.current = open;
  }, [open]);

  // Escape closes the panel (unless a modal sheet opened from inside the Coach is on top — it handles Escape itself)
  const close = useCallback(() => setOpen(false), [setOpen]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector("[aria-modal]")) close(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, close]);

  // ---- drag (pointer events + capture) ----
  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || !pos) return;
    drag.current = { x0: e.clientX, y0: e.clientY, px: pos.x, py: pos.y, dragging: false, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.dragging && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > DRAG_THRESHOLD) { d.dragging = true; setDragging(true); }
    if (!d.dragging) return;
    setPos(clamp({ x: d.px + e.clientX - d.x0, y: d.py + e.clientY - d.y0 }));
  };
  const endDrag = (e: React.PointerEvent<HTMLButtonElement>, cancelled = false) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    suppressClick.current = d.dragging || cancelled;
    if (d.dragging) {
      custom.current = true;
      const p = clamp({ x: d.px + e.clientX - d.x0, y: d.py + e.clientY - d.y0 });
      setPos(p);
      try { sessionStorage.setItem(POS_KEY, JSON.stringify(p)); } catch {}
    }
    drag.current = null;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const onClick = () => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    setBlink((b) => b + 1); // one visible blink on every click
    setOpen(!open);
  };

  if (!mounted || !pos) return null;

  // ---- panel placement next to the orb, always inside the viewport ----
  const w = Math.min(Math.max(360, Math.min(PANEL_W, vp.w * 0.28)), vp.w - 2 * MARGIN);
  const hMax = Math.min(560, vp.h - 2 * MARGIN), hMin = 320;
  const roomAbove = pos.y - GAP - MARGIN, roomBelow = vp.h - MARGIN - (pos.y + ORB + GAP);
  let h: number, top: number, left: number;
  if (roomAbove >= hMin && (roomAbove >= hMax || roomAbove >= roomBelow)) { h = Math.min(hMax, roomAbove); top = pos.y - GAP - h; }
  else if (roomBelow >= hMin) { h = Math.min(hMax, roomBelow); top = pos.y + ORB + GAP; }
  else { h = hMax; top = Math.max(MARGIN, Math.min(vp.h - MARGIN - h, pos.y + ORB / 2 - h / 2)); }
  const beside = roomAbove < hMin && roomBelow < hMin;
  if (beside) left = pos.x - GAP - w >= MARGIN ? pos.x - GAP - w : pos.x + ORB + GAP;
  else left = pos.x + ORB / 2 > vp.w / 2 ? pos.x + ORB - w : pos.x;
  left = Math.max(MARGIN, Math.min(vp.w - MARGIN - w, left));
  const tipLeft = pos.x > 220;

  return createPortal(
    <>
      <div className="pc-wrap fixed z-[45]" style={{ left: pos.x, top: pos.y }} data-coach-launcher data-dragging={dragging ? "" : undefined}>
        <button ref={orbRef} type="button" onClick={onClick} onPointerDown={onPointerDown} onPointerMove={onPointerMove}
          onPointerUp={(e) => endDrag(e)} onPointerCancel={(e) => endDrag(e, true)}
          className="pc-orb relative block rounded-full touch-none select-none" style={{ cursor: dragging ? "grabbing" : "pointer" }}
          aria-label={open ? "Close Your Private Coach" : "Open Your Private Coach"} aria-expanded={open} aria-controls={panelId}
          aria-describedby={`${panelId}-tip`} data-coach-orb>
          <span className="pc-contact" aria-hidden />
          <Avatar color="green" size="lg" decorative blinkKey={blink} className="!size-[60px] !cursor-[inherit]" />
        </button>
        <span role="tooltip" id={`${panelId}-tip`} className={`pc-tip absolute top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-ink text-bg px-3 py-1.5 t-sub font-medium shadow-sm ${tipLeft ? "right-full mr-3" : "left-full ml-3"} ${open || dragging ? "!opacity-0" : ""}`} data-coach-tip>
          Your Private Coach
        </span>
      </div>
      <div ref={panelRef} id={panelId} role="dialog" aria-label={title} hidden={!open} data-coach-panel
        className={`pc-panel fixed z-[46] rounded-[20px] overflow-hidden flex-col ${open ? "flex pc-panel-in" : ""}`}
        style={{ left, top, width: w, height: h }}>
        <div className="shrink-0 flex items-start gap-2 pl-4 pr-2 pt-3 pb-2.5 border-b border-line">
          <div className="flex-1 min-w-0">
            <h2 className="t-page text-green-text truncate">{title}</h2>
            {subtitle && <p className="t-sub text-muted">{subtitle}</p>}
          </div>
          <button ref={closeRef} type="button" onClick={close} aria-label="Close Private Coach" className="h-10 w-10 rounded-full flex items-center justify-center hover:bg-hover shrink-0" data-coach-close>
            <X size={19} strokeWidth={1.75} />
          </button>
        </div>
        <div className="flex-1 min-h-0 flex flex-col">{children}</div>
      </div>
    </>,
    document.body,
  );
}
