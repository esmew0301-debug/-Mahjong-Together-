"use client";

import { motion, useReducedMotion } from "motion/react";
import { tileArt } from "@/lib/tutorial/sichuan-art";
import { SUIT_NAME, numOf, suitOf, tileName, type Meld, type Suit } from "@/lib/mj/rules";
import type { SpecPlayer, SpecSnap } from "@/lib/watch/types";
import { cx } from "@/components/ui";
import { EMOJI_FONT, emojiFor } from "@/components/s3/avatar";

/** One tile; width is a CSS length (tile sizes derive from the table's --t unit). Tile faces are never rotated. */
export function WTile({ id, w, back, dim, hl, isNew, onClick, label, ring }: { id?: number; w: string; back?: boolean; dim?: boolean; hl?: boolean; isNew?: boolean; onClick?: () => void; label?: string; ring?: boolean }) {
  const face = back || id === undefined ? "back" : { s: suitOf(id), n: numOf(id) };
  const svg = <svg viewBox="-17 -22 34 50" style={{ width: "100%", height: "auto", display: "block" }} aria-hidden><g dangerouslySetInnerHTML={{ __html: tileArt(face as never) }} /></svg>;
  const cls = cx("relative shrink-0 block rounded-[5px]", dim && !hl && "spec-dim", hl && "spec-hl", isNew && "spec-new spec-last", ring && "outline-2 outline-dashed outline-white/80 outline-offset-1");
  if (!onClick) return <span className={cls} style={{ width: w }} title={label} data-hl={hl ? "" : undefined}>{svg}</span>;
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} data-hl={hl ? "" : undefined} style={{ width: w }}
      className={cx(cls, "cursor-pointer transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-white motion-reduce:transition-none")}>
      {svg}
    </button>
  );
}

export interface TableModel extends SpecSnap { claims?: Record<string, string[]>; endReason?: string }
export interface Highlight { tiles: number[]; actor?: string }
type Pos = "bottom" | "right" | "top" | "left";
const T = "var(--t)";

function Plate({ p, snap, pos, dim, scores }: { p: SpecPlayer; snap: TableModel; pos: Pos; dim: boolean; scores: Record<string, number> }) {
  const turn = snap.turn === p.id && (snap.phase === "play");
  const dq = snap.dq[p.id] as Suit | undefined;
  const won = snap.winners.find((w) => w.pid === p.id);
  const claim = snap.phase === "claim" ? snap.claims?.[p.id] : undefined;
  const side = pos === "left" || pos === "right";
  return (
    <div className={cx("flex items-center gap-2 text-white min-w-0", side && "flex-col text-center gap-1", dim && "spec-dim")}>
      <span className={cx("relative inline-flex items-center justify-center rounded-full bg-white/90 shrink-0", turn ? "ring-[3px] ring-[#ffd166]" : "ring-1 ring-white/30")}
        style={{ width: pos === "bottom" ? 40 : 34, height: pos === "bottom" ? 40 : 34 }} aria-hidden>
        <span style={{ ...EMOJI_FONT, fontSize: pos === "bottom" ? 22 : 19, lineHeight: 1 }}>{emojiFor(p)}</span>
      </span>
      <div className={cx("min-w-0 flex flex-col", side ? "items-center" : "items-start")}>
        <span className={cx("font-semibold leading-[20px] truncate max-w-full", pos === "bottom" ? "text-[16px]" : "text-[15px]")}>{p.name}</span>
        <span className={cx("flex flex-wrap gap-x-1.5 items-center text-[14px] leading-[20px]", side && "justify-center")}>
          {[
            turn && <span key="t" className="font-semibold text-[#ffd166]">Their turn</span>,
            won && <span key="w" className="font-semibold text-[#ffd166]">Won · {won.method === "self_draw" ? "self-draw" : "on a discard"}</span>,
            claim && <span key="c" className="font-semibold text-[#ffd166]">Can {claim.map((c) => (c === "hu" ? "Hu" : c === "kong" ? "Kong" : "Pung")).join(" / ")}</span>,
            snap.dealer === p.id && <span key="d" className="text-white/80">Dealer</span>,
            dq && <span key="q" className="text-white/80">{side ? `No ${SUIT_NAME[dq]}` : `Missing: ${SUIT_NAME[dq]}`}</span>,
            pos === "bottom" && <span key="s" className="text-white/80 tabular-nums">{(scores[p.id] || 0) > 0 ? "+" : ""}{scores[p.id] || 0} pts</span>,
          ].filter(Boolean).flatMap((el, k) => (k ? [<span key={`sep${k}`} className="text-white/50" aria-hidden>·</span>, el] : [el]))}
        </span>
      </div>
    </div>
  );
}

function Melds({ melds, w, dim, hl, onTile, names }: { melds: Meld[]; w: string; dim: boolean; hl: Set<number>; onTile?: (t: number) => void; names: Record<string, string> }) {
  if (!melds.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 justify-center">
      {melds.map((m, i) => (
        <span key={i} className="flex gap-[1px] rounded-[6px] bg-black/20 p-[2px]" aria-label={`${m.kind === "pung" ? "Pung" : "Kong"} of ${tileName(m.tiles[0])}${m.from ? ` from ${names[m.from] || "a player"}` : ""}`}>
          {m.tiles.map((t) => <WTile key={t} id={m.kind === "ckong" ? t : t} w={w} dim={dim} hl={hl.has(t)} onClick={onTile && m.from ? () => onTile(t) : undefined} label={onTile && m.from ? `Inspect: Pung/Kong of ${tileName(t)}` : tileName(t)} />)}
        </span>
      ))}
    </div>
  );
}

/**
 * The square four-sided educational table. `persp` chooses who sits at the bottom; the other three keep their
 * relative seats (next turn = right). Changing perspective only moves seats (position-only layout animation), so
 * tile faces and labels stay upright and readable. All four hands are shown face up (authorized teaching mode).
 */
export function SpecTable({ snap, players, persp, highlight, paused, newestTile, onDiscard, scores }: {
  snap: TableModel; players: SpecPlayer[]; persp: string; highlight: Highlight | null; paused: boolean; newestTile?: number;
  onDiscard?: (tile: number) => void; scores: Record<string, number>;
}) {
  const reduce = useReducedMotion();
  const order = snap.order;
  const i = Math.max(0, order.indexOf(persp));
  const posOf: Record<string, Pos> = { [order[i]]: "bottom", [order[(i + 1) % 4]]: "right", [order[(i + 2) % 4]]: "top", [order[(i + 3) % 4]]: "left" };
  const byId = Object.fromEntries(players.map((p) => [p.id, p]));
  const names = Object.fromEntries(players.map((p) => [p.id, p.name]));
  const hl = new Set(highlight?.tiles || []);
  const dimAll = paused && !!highlight;
  const layout = reduce ? false : ("position" as const);
  const transition = { duration: 0.32, ease: [0.2, 0, 0, 1] as const };
  const place: Record<Pos, string> = { top: "col-span-3 row-start-1", left: "col-start-1 row-start-2", right: "col-start-3 row-start-2", bottom: "col-span-3 row-start-3" };
  const pile: Record<Pos, string> = { top: "col-start-2 row-start-1 items-end", bottom: "col-start-2 row-start-3 items-start", left: "col-start-1 row-start-2 justify-center items-end", right: "col-start-3 row-start-2 justify-center items-start" };

  const status = (() => {
    if (snap.phase === "exchange") return "Exchanging three tiles";
    if (snap.phase === "dingque") return "Choosing missing suits";
    if (snap.phase === "ended") return snap.endReason === "wall" ? "Hand over · wall empty" : "Hand over";
    if (snap.phase === "claim") return "Claim window open";
    return snap.turn ? `${names[snap.turn] || "A player"}'s turn` : "Next turn…";
  })();

  return (
    <div className="spec-table relative h-full w-full rounded-[28px] p-[18px] grid gap-2 overflow-hidden" data-spec-table
      style={{ gridTemplateColumns: `minmax(calc(${T} * 3.4 + 16px), auto) minmax(0,1fr) minmax(calc(${T} * 3.4 + 16px), auto)`, gridTemplateRows: "auto minmax(0,1fr) auto" }}>
      {order.map((pid) => {
        const pos = posOf[pid];
        const p = byId[pid] || { id: pid, name: "Player", seat: 0 };
        const hand = snap.hands[pid] || [];
        const ex = new Set(snap.phase === "exchange" ? snap.exchange[pid] || [] : []);
        const dim = dimAll && highlight?.actor !== pid;
        const w = pos === "bottom" ? `calc(${T} * 1.62)` : pos === "top" ? T : `calc(${T} * 0.98)`;
        const mw = pos === "bottom" ? `calc(${T} * 0.95)` : `calc(${T} * 0.78)`;
        const side = pos === "left" || pos === "right";
        return (
          <motion.section key={pid} layout={layout} transition={transition} aria-label={`${p.name}'s seat (${pos === "bottom" ? "bottom, selected perspective" : pos})`}
            className={cx(place[pos], "min-w-0 min-h-0 flex", side ? "flex-col items-center justify-center gap-2" : "flex-col items-center gap-1.5")} data-seat={pos} data-pid={pid}>
            {pos !== "bottom" && <Plate p={p} snap={snap} pos={pos} dim={dim} scores={scores} />}
            <div className={cx(side ? "grid grid-cols-3 gap-[2px]" : "flex flex-wrap justify-center gap-[2px]")} aria-label={`${p.name}'s hand: ${hand.map(tileName).join(", ")}`}>
              {hand.map((t) => <WTile key={t} id={t} w={w} dim={dim} hl={hl.has(t)} ring={ex.has(t)} label={tileName(t)} />)}
            </div>
            <Melds melds={snap.melds[pid] || []} w={mw} dim={dim} hl={hl} names={names} onTile={onDiscard} />
            {pos === "bottom" && <Plate p={p} snap={snap} pos={pos} dim={dim} scores={scores} />}
          </motion.section>
        );
      })}
      {/* centre: four discard piles around the status box */}
      <div className="col-start-2 row-start-2 min-w-0 min-h-0 grid gap-2 place-content-center" style={{ gridTemplateColumns: "auto auto auto", gridTemplateRows: "auto auto auto" }}>
        {order.map((pid) => {
          const pos = posOf[pid];
          const ds = snap.discards[pid] || [];
          const dim = dimAll && highlight?.actor !== pid;
          const per = pos === "top" || pos === "bottom" ? 10 : 4;
          return (
            <motion.div key={`pile-${pid}`} layout={layout} transition={transition} className={cx(pile[pos], "flex min-w-0")} data-pile={pos}>
              <div className={cx("flex flex-wrap gap-[3px] content-start", (pos === "top" || pos === "left") && "flex-wrap-reverse")} style={{ maxWidth: `calc((${T} * 0.92 + 3px) * ${per})` }}
                aria-label={`${names[pid]}'s discards`}>
                {ds.map((t) => <WTile key={t} id={t} w={`calc(${T} * 0.92)`} dim={dim} hl={hl.has(t)} isNew={t === newestTile && !paused}
                  onClick={onDiscard ? () => onDiscard(t) : undefined} label={`Inspect: ${names[pid]} discarded ${tileName(t)}`} />)}
              </div>
            </motion.div>
          );
        })}
        <div className="col-start-2 row-start-2 self-center justify-self-center rounded-[14px] bg-black/25 text-white px-3.5 py-2 text-center min-w-[148px]" data-status>
          <p className="text-[14px] leading-[20px] text-white/80">Hand {snap.hand} · Wall {snap.wallCount}</p>
          <p className="text-[15px] leading-[22px] font-semibold">{paused ? "Paused on this move" : status}</p>
        </div>
      </div>
    </div>
  );
}
