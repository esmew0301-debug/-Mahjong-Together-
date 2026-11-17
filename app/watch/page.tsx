"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, getProfile } from "@/lib/client";
import { Btn, Header } from "@/components/ui";

/** Watch a Game → (profile) → Join a Classroom. The classroom code identifies the CLASSROOM, not one game. */
function JoinClassroom() {
  const router = useRouter();
  const sp = useSearchParams();
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!getProfile()) { router.replace("/profile?next=watch"); return; }
    try { setCode(sp.get("code") || localStorage.getItem("mt.watchCode") || localStorage.getItem("mt.classCode") || ""); } catch {}
  }, [router, sp]);
  const go = async () => {
    const c = code.trim().toUpperCase();
    if (!c) return setErr("Enter your classroom code.");
    const p = getProfile();
    if (!p) return router.replace("/profile?next=watch");
    setBusy(true); setErr(null);
    try {
      const j = await api<{ classroom: string }>("/api/watch/join", { code: c, name: p.name, avatar: p.avatar });
      try { localStorage.setItem("mt.watchCode", j.classroom); } catch {}
      router.push(`/watch/${encodeURIComponent(j.classroom)}`);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Header title="" onBack={() => router.push("/")} backLabel="Back" />
      <form className="flex-1 flex flex-col px-4 pt-4 gap-6" onSubmit={(e) => { e.preventDefault(); go(); }}>
        <div>
          <h1 className="t-app text-green-text">Join a Classroom</h1>
          <p className="t-body text-muted mt-1">Enter the classroom code to watch and learn together.</p>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="t-sub font-medium">Classroom Code</span>
          <input value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setErr(null); }} placeholder="COGS123" autoCapitalize="characters" autoComplete="off"
            aria-invalid={!!err} className="h-12 px-4 rounded-xl border border-line bg-card outline-none focus:border-green tracking-wider" />
        </label>
        {err && <p className="t-sub text-[#B42318] dark:text-[#FF6961] -mt-3" role="alert">{err}</p>}
        <p className="t-sub text-muted">Spectating works best on a laptop or desktop.</p>
        <div className="flex-1" />
        <Btn type="submit" className="w-full mb-[max(12px,env(safe-area-inset-bottom))]" disabled={busy}>Join Classroom</Btn>
      </form>
    </div>
  );
}
export default function WatchJoinPage() {
  return <Suspense fallback={null}><JoinClassroom /></Suspense>;
}
