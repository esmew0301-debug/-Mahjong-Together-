"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, rememberRoom } from "@/lib/client";
import { Btn, Header } from "@/components/ui";

type Summary = { code: string; name: string; players: number; status: string; host?: string };

export default function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "config">("loading");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/api/rooms/${code}`)
      .then((j) => {
        if (j.member) {
          rememberRoom(j.room.code);
          router.replace(`/room/${j.room.code}`);
        } else {
          setSummary(j.summary);
          setState("ready");
        }
      })
      .catch((e) => setState(e instanceof ApiError && e.config ? "config" : "missing"));
  }, [code, router]);

  const join = async () => {
    if (!name.trim()) return setErr("Please enter your name.");
    setBusy(true);
    setErr(null);
    try {
      const j = await api(`/api/rooms/${code}/join`, { name });
      rememberRoom(j.room.code);
      router.replace(`/room/${j.room.code}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  const full = summary && summary.players >= 4;
  const ended = summary?.status === "complete";
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Header title="Join a Room" onBack={() => router.push("/")} />
      <div className="flex-1 flex flex-col px-4 py-6 gap-5">
        {state === "loading" && <p className="t-sub text-muted">Looking up the room…</p>}
        {state === "missing" && <p className="t-body">We couldn't find room {decodeURIComponent(code)}. Check the code with your host.</p>}
        {state === "config" && <p className="t-body">Live rooms aren't set up on this deployment yet. The site owner needs to connect Upstash Redis (see README).</p>}
        {state === "ready" && summary && (
          <form className="flex-1 flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); join(); }}>
            <div>
              <div className="t-page">{summary.name}</div>
              <div className="t-sub text-muted">{summary.code} · Hosted by {summary.host} · {summary.players}/4 joined</div>
            </div>
            {ended ? (
              <p className="t-body">This session has ended.</p>
            ) : full ? (
              <p className="t-body">This room already has four players. If someone left, ask the host to open their seat.</p>
            ) : (
              <label className="flex flex-col gap-1.5">
                <span className="t-sub font-medium">Your name</span>
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="e.g. Jamie" className="h-12 px-4 rounded-xl border border-line outline-none focus:border-ink" />
              </label>
            )}
            {err && <p className="t-sub text-[#B42318]" role="alert">{err}</p>}
            <div className="flex-1" />
            {!full && !ended && <Btn type="submit" disabled={busy} className="w-full mb-[max(12px,env(safe-area-inset-bottom))]">{busy ? "Joining…" : "Join Room"}</Btn>}
          </form>
        )}
      </div>
    </div>
  );
}
