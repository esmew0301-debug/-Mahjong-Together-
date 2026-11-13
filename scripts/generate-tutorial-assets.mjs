// Renders the static instructional assets in /public/mahjong-tutorial/ from the SAME scene data the app animates
// (lib/tutorial/sichuan-art.ts), so files and animations can never drift apart.
// Usage: node scripts/generate-tutorial-assets.mjs
import fs from "fs";
import path from "path";
import ts from "typescript";
import { fileURLToPath, pathToFileURL } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(root, "lib/tutorial/sichuan-art.ts"), "utf8");
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const cache = path.join(root, "node_modules/.cache");
fs.mkdirSync(cache, { recursive: true });
const tmp = path.join(cache, "mt-sichuan-art.mjs");
fs.writeFileSync(tmp, js);
const A = await import(pathToFileURL(tmp).href + "?t=" + Date.now());
const P = A.STATIC_PALETTE;
const out = path.join(root, "public/mahjong-tutorial");
fs.mkdirSync(out, { recursive: true });
const write = (name, svg) => { fs.writeFileSync(path.join(out, name + ".svg"), svg); console.log("wrote", name + ".svg"); };
const one = (id, dir, phase) => { const s = A.buildArtScene(id, P, dir); return A.renderStatic(s, phase ?? s.phases - 1); };

write("step-1-prepare-tiles", one("step-1-prepare-tiles"));
write("step-1-help-tile-selection", one("step-1-help-tile-selection"));
write("step-1-help-27-types", one("step-1-help-27-types"));
write("step-2-build-wall", one("step-2-build-wall"));

// Three stages: 1 single tiles laid out, 2 stacked two high (14- and 13-stack walls), 3 the staggered four walls.
{
  const st = A.buildArtScene("step-2-help-wall-stacking", P);
  const wall = A.buildArtScene("step-2-build-wall", P);
  const W = 340, H = st.h * 2 + 300;
  const body = A.renderStatic(st, 0, { wrap: false }) + A.renderStatic(st, st.phases - 1, { dy: st.h, wrap: false }) + A.renderStatic(wall, wall.phases - 1, { dx: 30, dy: st.h * 2, s: 0.82, wrap: false });
  const title = "Building the walls: tiles are stacked two high; top and bottom walls have 14 stacks, left and right walls 13; 108 tiles in total.";
  write("step-2-help-wall-construction", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * 2}" height="${H * 2}" role="img" aria-label="${title}"><title>${title}</title>${body}</svg>`);
}

write("step-3-exchange-tiles", one("step-3-exchange-tiles", "across", 1)); // selected group + arrow (direction-neutral pose)
for (const d of ["clockwise", "counterclockwise", "across"]) {
  write(`step-3-exchange-tiles-${d}`, one("step-3-exchange-tiles", d));
  write(`step-3-help-exchange-${d}`, one("step-3-help-exchange", d));
}
write("step-3-help-exchange", one("step-3-help-exchange", "counterclockwise", 0)); // four groups of three, no direction
write("step-3-help-same-suit", one("step-3-help-same-suit"));
write("step-3-help-mixed-suits", one("step-3-help-mixed-suits"));
for (const k of ["win-standard", "win-seven-pairs", "win-all-pungs"]) write(k, one(k));

write("step-4-ding-que", one("step-4-ding-que"));
// Three stages: missing suit highlighted → discarded over successive turns → hand without Bamboo.
{
  const h = A.buildArtScene("step-4-help-ding-que", P);
  const H = h.h * 3;
  const body = A.renderStatic(h, 1, { wrap: false }) + A.renderStatic(h, 3, { dy: h.h, wrap: false }) + A.renderStatic(h, 5, { dy: h.h * 2, wrap: false });
  write("step-4-help-ding-que", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${h.w} ${H}" width="${h.w * 2}" height="${H * 2}" role="img" aria-label="${h.title}"><title>${h.title}</title>${body}</svg>`);
}
