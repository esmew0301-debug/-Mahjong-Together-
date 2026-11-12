"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type { PublicRoom } from "@/lib/types";
import { profileFor } from "@/lib/scoring";
import { winFan } from "@/lib/scoring/sichuan";
import { SUIT_NAME, checkHand, tileName, type Meld, type Suit } from "@/lib/scoring/handcheck";
import { Btn, Sheet, cx } from "./ui";

/**
 * Private, advisory "Check My Hand" wizard. Runs entirely on this phone: nothing (answers, tile entries,
 * notes) is sent anywhere unless the player explicitly taps Declare Win, which sends only the claim fields.
 */
type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6;
const newIdem = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now());

export function CheckMyHand({ r, me, open, onClose, onDeclare }: { r: PublicRoom; me: string; open: boolean; onClose: () => void; onDeclare: (claim: Record<string, unknown>, idem: string) => void }) {
  const sichuan = r.variant === "sichuan";
  const prof = profileFor(r.variant);
  const winners = r.hand?.winners || [];
  const [step, setStep] = useState<Step>(0);
  const [c, setC] = useState<Record<string, any>>({});
  const [tilesOpen, setTilesOpen] = useState(false);
  const [tiles, setTiles] = useState<string[]>([]);
  const [melds, setMelds] = useState<Meld[]>([]);
  const [missing, setMissing] = useState<Suit | "">("");
  const [idem] = useState(newIdem());
  const set = (k: string, v: unknown) => setC((x) => ({ ...x, [k]: v }));
  const canPlay = r.status === "playing" && !r.hand?.ended && !winners.includes(me);
  const others = r.players.filter((p) => p.id !== me && !(prof.winnersLeave && winners.includes(p.id)));

  const check = useMemo(() => (tiles.length || melds.length ? checkHand({ concealed: tiles, melds, missingSuit: missing || undefined }) : null), [tiles, melds, missing]);
  const fan = sichuan && c.method && c.structure ? winFan({ ...c, method: c.method, structure: c.structure }) : null;
  const verdict = (() => {
    if (c.structure === "other" || c.method === "unsure") return { label: "Cannot Verify", tone: "warn", text: "Some answers are unsure. Check with the table before declaring." };
    if (sichuan && c.missingSuitCleared === "no") return { label: "Not Valid Under Known Rule", tone: "bad", text: "You still hold your declared missing suit, so this isn't a win yet." };
    if (sichuan && c.missingSuitCleared === "unsure") return { label: "Cannot Verify", tone: "warn", text: "Confirm you've cleared your missing suit first." };
    if (check && !check.ok) return { label: "Not Valid Under Known Rule", tone: "bad", text: check.errors[0] };
    return { label: "Potential Win — Table Verification Required", tone: "ok", text: check?.ok ? "Your entered tiles form a valid shape. The table still checks the real tiles." : "Based on your answers only. The table checks the real tiles." };
  })();
  const canDeclare = canPlay && verdict.tone === "ok" && c.method && c.method !== "unsure" && c.structure && (!["discard", "robbing_kong"].includes(c.method) || c.fromId);

  const close = () => { setStep(0); onClose(); };
  const next = () => setStep((s) => (Math.min(6, s + 1) as Step));
  const opt = (k: string, v: string, label: string, help?: string) => (
    <button key={v} type="button" onClick={() => set(k, v)} aria-pressed={c[k] === v} className={cx("text-left rounded-[14px] border px-3 py-2.5 min-h-12", c[k] === v ? "border-green bg-green-soft" : "border-line bg-bg hover:bg-surface")}>
      <span className="block t-body">{label}</span>
      {help && <span className="block t-meta text-muted">{help}</span>}
    </button>
  );
  const addTile = (t: string) => setTiles((x) => (x.length < 18 ? [...x, t].sort() : x));

  return (
    <Sheet open={open} onClose={close} title="Check My Hand">
      <div className="flex flex-col gap-4">
        <p className="t-meta text-muted">Private and advisory. Only you see this. Nothing is shared unless you tap Declare Win.</p>
        {step === 0 && (
          <>
            <div className="t-section">Think You Might Have Won?</div>
            <p className="t-body">Answer a few questions and I'll check your claim against {prof.name}. I can't see your tiles, so the table always verifies the real hand.</p>
            {!canPlay && <p className="t-sub text-muted">{winners.includes(me) ? "You've already won this hand." : "No hand is in progress right now."}</p>}
            <Btn onClick={next}>Start</Btn>
          </>
        )}
        {step === 1 && (
          <>
            <div className="t-section">How did you get your winning tile?</div>
            {opt("method", "self_draw", "Self-draw (Zi Mo)", "You drew it from the wall.")}
            {opt("method", "discard", "Another player's discard (Dian Pao)", "Someone discarded it.")}
            {sichuan && opt("method", "kong_replacement", "Kong replacement", "You drew it right after declaring your own kong.")}
            {sichuan && opt("method", "robbing_kong", "Robbing a kong", "Another player added a fourth tile to a pung and it completes your hand.")}
            {opt("method", "unsure", "Not sure")}
            {["discard", "robbing_kong"].includes(c.method) && (
              <div className="grid grid-cols-2 gap-2">{others.map((p) => <Btn key={p.id} variant={c.fromId === p.id ? "selected" : "secondary"} className="px-2" onClick={() => set("fromId", p.id)}>{p.name}</Btn>)}</div>
            )}
            <Btn disabled={!c.method} onClick={next}>Next</Btn>
          </>
        )}
        {step === 2 && (
          <>
            <div className="t-section">What is the basic winning structure?</div>
            {opt("structure", "standard", "Standard: four sets + a pair")}
            {opt("structure", "seven_pairs", "Seven pairs")}
            {sichuan && opt("structure", "all_pungs", "All pungs", "Four pungs/kongs + a pair, no sequences.")}
            {opt("structure", "other", "Other / not sure")}
            <p className="t-meta text-muted">Structure is the shape of the hand. Bonuses like a pure suit come next.</p>
            <Btn disabled={!c.structure} onClick={next}>Next</Btn>
          </>
        )}
        {step === 3 && (
          <>
            <div className="t-section">Any additional patterns?</div>
            {sichuan ? (
              <>
                {[{ k: "pureSuit", label: "Pure suit (full flush)" }, { k: "goldenHook", label: "Golden hook", disabled: c.structure === "seven_pairs" }, { k: "lastTile", label: "Last tile of the wall" }].map((x) => (
                  <label key={x.k} className={cx("flex items-center gap-3 min-h-11 t-body", x.disabled && "opacity-45")}>
                    <input type="checkbox" className="h-5 w-5 accent-[#34C759]" disabled={x.disabled} checked={!!c[x.k]} onChange={(e) => set(x.k, e.target.checked)} /> {x.label}
                  </label>
                ))}
                <label className="flex items-center gap-3 min-h-11 t-body">Roots (four identical tiles):
                  <select value={c.roots || 0} onChange={(e) => set("roots", Number(e.target.value))} className="h-10 rounded-xl border border-line bg-bg px-2">{[0, 1, 2, 3, 4].map((x) => <option key={x} value={x}>{x}</option>)}</select>
                </label>
                {c.structure === "seven_pairs" && <p className="t-meta text-muted">Dragon seven pairs scores as seven pairs + 1 root in this ruleset. Golden hook can't combine with seven pairs.</p>}
              </>
            ) : <p className="t-sub text-muted">Pattern values for {r.variant} aren't automated here; the table agrees the value.</p>}
            <Btn onClick={next}>Next</Btn>
          </>
        )}
        {step === 4 && (
          <>
            {sichuan ? (
              <>
                <div className="t-section">Have you cleared your declared missing suit?</div>
                {opt("missingSuitCleared", "yes", "Yes")}
                {opt("missingSuitCleared", "no", "No")}
                {opt("missingSuitCleared", "unsure", "Not sure")}
                <p className="t-meta text-muted">You can't win while holding any tile of your missing suit.</p>
              </>
            ) : <p className="t-sub">No missing-suit rule in this variant.</p>}
            <Btn disabled={sichuan && !c.missingSuitCleared} onClick={next}>Next</Btn>
          </>
        )}
        {step >= 5 && (
          <>
            <div className="t-section">Private Summary</div>
            <div className={cx("rounded-[12px] p-3 t-sub", verdict.tone === "ok" ? "bg-green-soft" : "bg-surface")}>
              <div className="font-semibold">{verdict.label}</div>
              <div className="text-muted">{verdict.text}</div>
            </div>
            {fan && <ul className="t-meta text-muted flex flex-col gap-0.5">{fan.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>}
            {sichuan && (
              <div className="flex flex-col gap-2">
                <button className="t-sub font-medium text-green-text text-left min-h-11" onClick={() => setTilesOpen(!tilesOpen)}>{tilesOpen ? "Hide" : "Optional:"} enter my tiles to double-check</button>
                {tilesOpen && (
                  <div className="flex flex-col gap-2 rounded-[12px] bg-surface p-3">
                    <label className="t-sub flex items-center gap-2">Missing suit:
                      <select value={missing} onChange={(e) => setMissing(e.target.value as Suit)} className="h-10 rounded-xl border border-line bg-bg px-2"><option value="">–</option>{(["c", "b", "d"] as Suit[]).map((s) => <option key={s} value={s}>{SUIT_NAME[s]}</option>)}</select>
                    </label>
                    {(["c", "b", "d"] as Suit[]).filter((s) => s !== missing).map((s) => (
                      <div key={s}><div className="t-meta text-muted mb-1">{SUIT_NAME[s]} — tap to add concealed tiles (incl. winning tile)</div>
                        <div className="grid grid-cols-9 gap-1">{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((v) => <button key={v} onClick={() => addTile(`${s}${v}`)} className="h-9 rounded-md border border-line bg-bg t-sub">{v}</button>)}</div>
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-1 min-h-8">{tiles.map((t, i) => <button key={i} onClick={() => setTiles(tiles.filter((_, j) => j !== i))} className="px-2 h-8 rounded-md bg-bg border border-line t-meta flex items-center gap-1">{tileName(t)}<X size={10} /></button>)}</div>
                    <div className="t-meta text-muted">Declared melds (pungs/kongs on the table):</div>
                    {melds.map((m, i) => (
                      <div key={i} className="flex gap-1">
                        <select value={m.kind} onChange={(e) => setMelds(melds.map((x, j) => (j === i ? { ...x, kind: e.target.value as Meld["kind"] } : x)))} className="h-9 rounded-md border border-line bg-bg px-1 t-meta"><option value="pung">Pung</option><option value="kong">Kong</option><option value="concealed_kong">Concealed kong</option></select>
                        <select value={m.tile} onChange={(e) => setMelds(melds.map((x, j) => (j === i ? { ...x, tile: e.target.value } : x)))} className="h-9 flex-1 rounded-md border border-line bg-bg px-1 t-meta">{(["c", "b", "d"] as Suit[]).flatMap((s) => [1, 2, 3, 4, 5, 6, 7, 8, 9].map((v) => <option key={`${s}${v}`} value={`${s}${v}`}>{tileName(`${s}${v}`)}</option>))}</select>
                        <button onClick={() => setMelds(melds.filter((_, j) => j !== i))} aria-label="Remove meld" className="h-9 w-9 flex items-center justify-center text-muted"><X size={14} /></button>
                      </div>
                    ))}
                    {melds.length < 4 && <button onClick={() => setMelds([...melds, { kind: "pung", tile: "c1" }])} className="t-meta font-medium text-green-text text-left min-h-9">+ Add meld</button>}
                    {check && (check.ok
                      ? <p className="t-sub text-green-text">Valid shape: {check.structure === "seven_pairs" ? "seven pairs" : check.structure === "all_pungs" ? "all pungs" : "standard"}{check.pureSuit ? ", pure suit" : ""}{check.roots ? `, ${check.roots} root(s)` : ""}{check.goldenHook ? ", golden hook" : ""}.</p>
                      : <ul className="t-sub text-[#B42318] dark:text-[#FF6961]">{check.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>)}
                    {check?.ok && <Btn variant="secondary" onClick={() => setC((x) => ({ ...x, structure: check.structure, pureSuit: check.pureSuit, roots: check.roots, goldenHook: check.goldenHook, missingSuitCleared: missing ? "yes" : x.missingSuitCleared }))}>Use These Results</Btn>}
                  </div>
                )}
              </div>
            )}
            <p className="t-meta text-muted">Photo analysis unavailable in this free demo.</p>
            <div className="grid grid-cols-1 gap-2">
              <Btn disabled={!canDeclare} onClick={() => { const { method, fromId, structure, pureSuit, roots, goldenHook, lastTile, missingSuitCleared } = c; onDeclare({ method, fromId, structure, pureSuit, roots, goldenHook, lastTile, missingSuitCleared }, idem); close(); }}>Declare Win</Btn>
              <Btn variant="secondary" onClick={() => setStep(1)}>Keep Checking</Btn>
              <Btn variant="ghost" onClick={close}>Cancel</Btn>
            </div>
            {!canDeclare && canPlay && <p className="t-meta text-muted">Declare Win is available once the summary shows a potential win and every answer is complete.</p>}
          </>
        )}
      </div>
    </Sheet>
  );
}
