"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getProfile } from "@/lib/client";
import { Btn, Header } from "@/components/ui";

/** Shared classroom code (e.g. COGS123) → the classroom's matchmaking queue. NOT a room id. */
export default function ClassroomPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!getProfile()) { router.replace("/profile?next=class"); return; }
    try { setCode(localStorage.getItem("mt.classCode") || ""); } catch {}
  }, [router]);
  const go = async () => {
    if (!code.trim()) return setErr("Enter your classroom code.");
    setBusy(true); setErr(null);
    try {
      const j = await api<{ code: string }>("/api/classroom", { code });
      try { localStorage.setItem("mt.classCode", j.code); } catch {}
      router.push(`/match?queue=class&code=${encodeURIComponent(j.code)}`);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Header title="" onBack={() => router.push("/")} backLabel="Back" />
      <form className="flex-1 flex flex-col px-4 pt-4 gap-6" onSubmit={(e) => { e.preventDefault(); go(); }}>
        <div>
          <h1 className="t-app text-green-text">Join Your Classroom</h1>
          <p className="t-body text-muted mt-1">Enter your classroom code to find other players.</p>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="t-sub font-medium">Classroom Code</span>
          <input value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setErr(null); }} placeholder="COGS123" autoCapitalize="characters" autoComplete="off"
            aria-invalid={!!err} className="h-12 px-4 rounded-xl border border-line bg-card outline-none focus:border-green tracking-wider" />
        </label>
        {err && <p className="t-sub text-[#B42318] dark:text-[#FF6961] -mt-3" role="alert">{err}</p>}
        <div className="flex-1" />
        <Btn type="submit" className="w-full mb-[max(12px,env(safe-area-inset-bottom))]" disabled={busy}>Find My Table</Btn>
      </form>
    </div>
  );
}
