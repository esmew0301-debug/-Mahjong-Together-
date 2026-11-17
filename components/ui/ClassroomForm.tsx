"use client";

import { useState } from "react";
import { CLASSROOM_CODE } from "@/lib/classroom";
import { Btn } from "./index";
import { DeskCard } from "./desk";

/** Centred classroom-code form (players and spectators). The code identifies the classroom, not one table. */
export function ClassroomForm({ eyebrow, title, text, note, button, initial, onSubmit }: {
  eyebrow: string; title: string; text: string; note?: React.ReactNode; button: string; initial?: string; onSubmit: (code: string) => Promise<void>;
}) {
  const [code, setCode] = useState(initial || "");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    const c = code.trim().toUpperCase();
    if (!c) return setErr("Enter your classroom code.");
    setBusy(true); setErr(null);
    try { await onSubmit(c); } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  return (
    <DeskCard className="max-w-[600px]">
      <form className="flex flex-col gap-6" onSubmit={(e) => { e.preventDefault(); go(); }}>
        <div>
          <p className="t-sub font-semibold text-green-text">{eyebrow}</p>
          <h1 className="text-[30px] leading-[38px] font-semibold mt-1">{title}</h1>
          <p className="t-body text-muted mt-2">{text}</p>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="t-sub font-medium">Classroom Code</span>
          <div className="flex gap-3">
            <input value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setErr(null); }} placeholder={CLASSROOM_CODE} autoCapitalize="characters" autoComplete="off" autoFocus
              aria-invalid={!!err} data-classroom-input className="flex-1 min-w-0 h-12 px-4 rounded-xl border border-line bg-page outline-none focus:border-green tracking-wider" />
            <Btn type="submit" className="min-w-[180px]" disabled={busy}>{button}</Btn>
          </div>
        </label>
        {err && <p className="t-sub text-[#B42318] dark:text-[#FF6961] -mt-3" role="alert">{err}</p>}
        {note}
      </form>
    </DeskCard>
  );
}
