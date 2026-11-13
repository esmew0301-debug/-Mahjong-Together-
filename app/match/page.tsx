"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getProfile, rememberRoom } from "@/lib/client";
import type { PublicPlayer } from "@/lib/types";
import { Btn, Header } from "@/components/ui";
import { FourPlayerStatus } from "@/components/s3/FourPlayerStatus";
import { WaitingProgressRing } from "@/components/ui/loader-15";

type Member = { name: string; avatar: string; me: boolean };
type S = { status: "none" | "waiting" | "matched"; filled?: number; code?: string; members?: Member[] };

// One join request per page load, even when React mounts the effect twice in development.
let inflight: { at: number; p: Promise<S> } | null = null;
function joinOnce(name: string, avatar: string): Promise<S> {
  if (inflight && Date.now() - inflight.at < 5000) return inflight.p;
  const p = api<S>("/api/match", { name, avatar });
  inflight = { at: Date.now(), p };
  p.catch(() => { inflight = null; });
  return p;
}

export default function MatchPage() {
  const router = useRouter();
  const [s, setS] = useState<S>({ status: "none", filled: 1 });
  const [players, setPlayers] = useState<PublicPlayer[]>([]);
  const [complete, setComplete] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const stop = useRef(false);
  const me = useRef("me");

  useEffect(() => {
    const p = getProfile();
    if (!p) { router.replace("/profile?next=match"); return; }
    stop.current = false;
    let timer: ReturnType<typeof setTimeout>;
    const handle = (j: S) => {
      if (j.status === "matched" && j.code) {
        stop.current = true;
        rememberRoom(j.code);
        const code = j.code;
        // Show the completed table (real seats, incl. labelled AI seats) briefly, then open the lobby — no extra click.
        api(`/api/rooms/${code}`).then((rj) => {
          if (rj?.room) { me.current = rj.me; setPlayers(rj.room.players); }
          setComplete(true);
          window.setTimeout(() => router.replace(`/room/${code}`), 650);
        }).catch(() => router.replace(`/room/${code}`));
        return true;
      }
      setS(j);
      if (j.members) setPlayers(j.members.map((m, i) => ({ id: m.me ? "me" : `w${i}-${m.name}`, name: m.name, avatar: m.avatar, seat: i, joinedAt: 0, kind: "human", presence: "online" }) as PublicPlayer));
      return false;
    };
    const tick = async () => {
      if (stop.current) return;
      try {
        let j = await api<S>("/api/match");
        if (j.status === "none") j = await api<S>("/api/match", { name: p.name, avatar: p.avatar }); // entry expired: rejoin
        if (handle(j)) return;
        setErr(null);
      } catch (e) { setErr((e as Error).message); }
      if (!stop.current) timer = setTimeout(tick, 1000);
    };
    // Joining is idempotent: a refresh resumes the same queue entry instead of creating another.
    joinOnce(p.name, p.avatar)
      .then((j) => { if (!handle(j)) timer = setTimeout(tick, 1000); })
      .catch((e) => { setErr((e as Error).message); timer = setTimeout(tick, 1500); });
    return () => { stop.current = true; clearTimeout(timer); };
  }, [router]);

  const cancel = async () => {
    if (complete) return;
    setLeaving(true);
    stop.current = true;
    try {
      const j = await api<S>("/api/match", { cancel: true });
      if (j.status === "matched" && j.code) { rememberRoom(j.code); router.replace(`/room/${j.code}`); return; } // table formed at that moment
    } catch {}
    router.push("/");
  };

  const n = complete ? 4 : Math.max(1, Math.min(4, s.filled || players.length || 1));
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Header title="Mahjong Together" onBack={cancel} backLabel="Back" />
      <main className="flex-1 flex flex-col items-center px-4 pt-8 gap-7 text-center">
        <WaitingProgressRing current={n} total={4} label="players" active={!complete} />
        <div>
          <h1 className="t-app text-green-text">Finding Your Table</h1>
          <p className="t-body text-muted mt-1">Matching you with other players…</p>
        </div>
        {/* Matched ≠ ready: joined seats stay neutral (no ✓); readiness is confirmed later in the Room Lobby. */}
        <FourPlayerStatus className="w-full" players={players} me={me.current} showOpenSeats animateIn doneLabel="Joined"
          state={() => "waiting"} labelFor={() => (complete ? "Matched" : "Joined")} />
        <p className="t-sub text-muted" aria-live="polite">{complete ? "4/4 Matched · opening your table" : "Looking for available players"}</p>
        {complete && players.some((p) => p.kind === "virtual") && <p className="t-meta text-muted -mt-4">This demo includes simulated participants.</p>}
        {err && <p className="t-sub text-[#B42318] dark:text-[#FF6961]" role="alert">{err}</p>}
      </main>
      <div className="sticky bottom-0 bg-page px-4 pt-3 pb-safe">
        <Btn variant="secondary" className="w-full mb-3 bg-card" disabled={leaving || complete} onClick={cancel}>Cancel</Btn>
      </div>
    </div>
  );
}
