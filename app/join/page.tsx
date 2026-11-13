"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getProfile, rememberRoom } from "@/lib/client";
import { joinWithProfile, normalizeCode } from "@/lib/join";
import { Btn, Header } from "@/components/ui";

export default function JoinRoom() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!getProfile()) router.replace("/profile?next=join"); }, [router]);

  const join = async () => {
    const p = getProfile();
    if (!p) return router.replace("/profile?next=join");
    if (!code.trim()) return setErr("Enter a room code.");
    const c = normalizeCode(code);
    if (!c) return setErr("Room not found. Check the code.");
    setBusy(true); setErr(null);
    const r = await joinWithProfile(c, p);
    if (r.code) return router.replace(`/room/${r.code}`);
    setErr(r.error || "Room not found. Check the code.");
    setBusy(false);
  };
  const createPrivate = async () => {
    const p = getProfile();
    if (!p) return router.replace("/profile?next=join");
    setBusy(true); setErr(null);
    try {
      const j = await api("/api/rooms", { name: p.name, avatar: p.avatar });
      rememberRoom(j.room.code);
      router.replace(`/room/${j.room.code}`);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Header title="" onBack={() => router.push("/")} backLabel="Back" />
      <form className="flex-1 flex flex-col px-4 pt-4 gap-6" onSubmit={(e) => { e.preventDefault(); join(); }}>
        <div>
          <h1 className="t-app text-green-text">Join a Room</h1>
          <p className="t-body text-muted mt-1">Enter the code shared by your group.</p>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="t-sub font-medium">Room Code</span>
          <input value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setErr(null); }} placeholder="MAH-XXXX" autoCapitalize="characters" autoComplete="off"
            aria-invalid={!!err} className="h-12 px-4 rounded-xl border border-line bg-card outline-none focus:border-green tracking-wider" />
        </label>
        {err && <p className="t-sub text-[#B42318] dark:text-[#FF6961] -mt-3" role="alert">{err}</p>}
        <div className="flex-1" />
        <div className="flex flex-col gap-2 mb-[max(12px,env(safe-area-inset-bottom))]">
          <Btn type="submit" className="w-full" disabled={busy}>Join Room</Btn>
          <button type="button" onClick={createPrivate} disabled={busy} className="t-sub text-green-text font-medium min-h-11">Create a Private Room</button>
        </div>
      </form>
    </div>
  );
}
