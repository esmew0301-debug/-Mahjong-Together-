"use client";

import styles from "./animated-mahjong-tile.module.css";

type Seg = { x: number; y: number; len: number; deg: number; shade: number };

/** Walls of a rounded rectangle (centered at 0,0): 4 straight sides + each corner split into short facets,
 *  so the side surface stays closed from every angle of a full 3D turn. */
function perimeter(W: number, H: number, R: number, perCorner = 6): Seg[] {
  const pts: [number, number][] = [];
  const corner = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= perCorner; i++) {
      const a = ((a0 + (90 * i) / perCorner) * Math.PI) / 180;
      pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
    }
  };
  const hw = W / 2 - R, hh = H / 2 - R;
  corner(hw, -hh, -90); // top-right
  corner(hw, hh, 0); // bottom-right
  corner(-hw, hh, 90); // bottom-left
  corner(-hw, -hh, 180); // top-left
  const segs: Seg[] = [];
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 0.01) continue;
    const deg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
    // simple fixed "studio light" from the upper left: facets facing it are a little lighter
    const nx = (y2 - y1) / len, ny = -(x2 - x1) / len; // outward normal (clockwise traversal)
    const shade = Math.max(0, -0.6 * nx - 0.8 * ny);
    segs.push({ x: (x1 + x2) / 2, y: (y1 + y2) / 2, len: len + 0.6, deg, shade });
  }
  return segs;
}

/**
 * A solid 3D Mahjong tile (發) for the homepage hero, in CSS 3D: an ivory front face with the glyph, a deep-green
 * back face, and closed side walls that follow the rounded outline (green, with a thin ivory lip next to the
 * face, like a real tile). Motion: the supplied MacBook `rotate` keyframes — a full 360° turn with the same
 * diagonal tilts — on a 10s loop; the shadow follows the same keyframe positions. Reduced motion → static angle.
 */
export function AnimatedMahjongTile({ width = 132 }: { width?: number }) {
  const W = width, H = Math.round(width * 1.32), D = Math.round(width * 0.4), R = Math.round(width * 0.12);
  const segs = perimeter(W, H, R);
  return (
    <div className={styles.stage} style={{ width: W + 120, height: H + 120 }} role="img" aria-label="A rotating Mahjong tile with the character 發">
      <div className={styles.scene}>
        <div className={styles.tile} style={{ width: W, height: H, ["--r" as string]: `${R}px` }}>
          {segs.map((s, i) => (
            <div key={i} className={styles.side}
              style={{
                width: s.len, height: D, marginLeft: -s.len / 2, marginTop: -D / 2,
                transform: `translate(${s.x.toFixed(2)}px, ${s.y.toFixed(2)}px) rotateZ(${s.deg.toFixed(2)}deg) rotateX(90deg)`,
                // across the wall: ivory lip next to the front face (rotateX(90deg) maps this element’s bottom edge to the front), then deep green
                background: `linear-gradient(to top, hsl(42 30% ${74 + s.shade * 10}%) 0%, hsl(42 30% ${70 + s.shade * 10}%) 18%, hsl(111 47% ${24 + s.shade * 9}%) 19%, hsl(111 47% ${20 + s.shade * 9}%) 100%)`,
              }} />
          ))}
          <div className={`${styles.face} ${styles.back}`} style={{ transform: `rotateY(180deg) translateZ(${D / 2}px)` }} />
          <div className={`${styles.face} ${styles.front}`} style={{ transform: `translateZ(${D / 2}px)` }}>
            <span className={styles.glyph} style={{ fontSize: Math.round(W * 0.72) }}>發</span>
          </div>
        </div>
      </div>
      <div className={styles.shadow} aria-hidden />
    </div>
  );
}
