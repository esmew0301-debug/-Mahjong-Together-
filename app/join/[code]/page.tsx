"use client";

import { Suspense, use, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, getProfile, rememberRoom } from "@/lib/client";
import { joinWithProfile, normalizeCode } from "@/lib/join";
import { Btn, Header } from "@/components/ui";

/** QR deep link. Keeps the target room through Create Profile, then joins THAT room (never Random Match). */
function QrJoin({ code: raw }: { code: string }) {
  const router = useRouter();
  const auto = useSearchParams().get("auto") === "1";
  const code = normalizeCode(decodeURIComponent(raw)) || decodeURIComponent(raw).toUpperCase();
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState("");
  const started = useRef(false);

  const join = async () => {
    const p = getProfile();
    if (!p) return router.replace(`/profile?next=join&code=${encodeURIComponent(code)}`);
    setState("loading"); setErr(null);
    const r = await joinWithProfile(code, p);
    if (r.code) return router.replace(`/room/${r.code}`);
    setErr(r.error || "Room not found. Check the code.");
    setState("error");
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const j = await api(`/api/rooms/${code}`);
        if (j.member) { rememberRoom(j.room.code); return router.replace(`/room/${j.room.code}`); } // already seated on this device
      } catch { /* handled by join() */ }
      const p = getProfile();
      if (!p) return router.replace(`/profile?next=join&code=${encodeURIComponent(code)}`);
      setName(p.name);
      if (auto) return join();
      setState("ready");
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Header title="" onBack={() => router.push("/")} backLabel="Back" />
      <div className="flex-1 flex flex-col px-4 pt-4 gap-6">
        <div>
          <h1 className="t-app text-green-text">Join a Room</h1>
          <p className="t-body text-muted mt-1">Room {code}</p>
        </div>
        {state === "loading" && <p className="t-sub text-muted">Joining…</p>}
        {state === "ready" && <p className="t-body">You'll join as <span className="font-medium">{name}</span>. <button onClick={() => router.push(`/profile?next=join&code=${encodeURIComponent(code)}`)} className="text-green-text font-medium">Edit</button></p>}
        {err && <p className="t-sub text-[#B42318] dark:text-[#FF6961]" role="alert">{err}</p>}
        <div className="flex-1" />
        <div className="flex flex-col gap-2 mb-[max(12px,env(safe-area-inset-bottom))]">
          {state === "ready" && <Btn className="w-full" onClick={join}>Join Room</Btn>}
          {state === "error" && <Btn variant="secondary" className="w-full" onClick={() => router.push("/join")}>Enter Another Code</Btn>}
        </div>
      </div>
    </div>
  );
}

export default function JoinCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  return <Suspense fallback={null}><QrJoin code={code} /></Suspense>;
}
