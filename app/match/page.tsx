"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, getProfile, lastRoom, rememberRoom } from "@/lib/client";
import type { PublicPlayer } from "@/lib/types";
import { Btn, Header } from "@/components/ui";
import { FourPlayerStatus } from "@/components/s3/FourPlayerStatus";
import { WaitingProgressRing } from "@/components/ui/loader-15";

type Member = { name: string; avatar: string; me: boolean };
type S = { status: "none" | "waiting" | "matched"; filled?: number; code?: string; members?: Member[]; deadlineInMs?: number; queue?: string };

// One join request per page load, even when React mounts the effect twice in development.
let inflight: { at: number; key: string; p: Promise<S> } | null = null;
function joinOnce(name: string, avatar: string, queue: string): Promise<S> {
  if (inflight && inflight.key === queue && Date.now() - inflight.at < 5000) return inflight.p;
  const p = api<S>("/api/match", { name, avatar, queue });
  inflight = { at: Date.now(), key: queue, p };
  p.catch(() => { inflight = null; });
  return p;
}

export default function MatchPage() {
  return <Suspense fallback={null}><Match /></Suspense>;
}

function Match() {
  const router = useRouter();
  const queue = useSearchParams().get("queue") === "class" ? "class" : "default";
  const qs = queue === "class" ? "?queue=class" : "";
  // Scanning the classroom QR again while already seated at an active table: offer to resume instead of re-queueing.
  const [resume, setResume] = useState<string | null | undefined>(queue === "class" ? undefined : null);
  // Countdown from the SERVER's remaining time (resynced on every poll; display only).
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (queue !== "class") return;
    const code = lastRoom();
    if (!code) { setResume(null); return; }
    api(`/api/rooms/${code}`).then((j) => setResume(j.member && j.room && j.room.status !== "complete" ? j.room.code : null)).catch(() => setResume(null));
  }, [queue]);
  const [s, setS] = useState<S>({ status: "none", filled: 1 });
  const [players, setPlayers] = useState<PublicPlayer[]>([]);
  const [complete, setComplete] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const stop = useRef(false);
  const me = useRef("me");

  useEffect(() => {
    const p = getProfile();
    if (!p) { router.replace(`/profile?next=match${queue === "class" ? "&queue=class" : ""}`); return; }
    if (resume !== null) return; // waiting for the resume check / the player's choice
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
          // demo seats pop in one by one (200ms apart) — after matching; never delays the matching deadline
          const bots = (rj?.room?.players || []).filter((x: PublicPlayer) => x.kind === "virtual").length;
          window.setTimeout(() => router.replace(`/room/${code}`), 650 + bots * 200);
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
        let j = await api<S>(`/api/match${qs}`);
        if (j.status === "none") j = await api<S>("/api/match", { name: p.name, avatar: p.avatar, queue }); // entry expired: rejoin
        if (handle(j)) return;
        setErr(null);
      } catch (e) { setErr((e as Error).message); }
      if (!stop.current) timer = setTimeout(tick, 1000);
    };
    // Joining is idempotent: a refresh resumes the same queue entry instead of creating another.
    joinOnce(p.name, p.avatar, queue)
      .then((j) => { if (!handle(j)) timer = setTimeout(tick, 1000); })
      .catch((e) => { setErr((e as Error).message); timer = setTimeout(tick, 1500); });
    return () => { stop.current = true; clearTimeout(timer); };
  }, [router, queue, qs, resume]);

  useEffect(() => {
    if (s.status !== "waiting" || typeof s.deadlineInMs !== "number") { setLeft(null); return; }
    const end = Date.now() + s.deadlineInMs;
    const tick = () => setLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
    tick();
    const t = window.setInterval(tick, 250);
    return () => window.clearInterval(t);
  }, [s]);

  const cancel = async () => {
    if (complete) return;
    setLeaving(true);
    stop.current = true;
    try {
      const j = await api<S>("/api/match", { cancel: true, queue });
      if (j.status === "matched" && j.code) { rememberRoom(j.code); router.replace(`/room/${j.code}`); return; } // table formed at that moment
    } catch {}
    router.push("/");
  };

  const n = complete ? 4 : Math.max(1, Math.min(4, s.filled || players.length || 1));
  if (resume) return (
    <div className="min-h-[100dvh] flex flex-col">
      <Header title="Mahjong Together" onBack={() => router.push("/")} backLabel="Back" />
      <main className="flex-1 flex flex-col items-center justify-center px-4 gap-3 text-center">
        <h1 className="t-app text-green-text">You&apos;re Already at a Table</h1>
        <p className="t-body text-muted">Room {resume}. Resume it, or find a new table.</p>
      </main>
      <div className="px-4 pb-safe pt-3 flex flex-col gap-2">
        <Btn className="w-full" onClick={() => router.replace(`/room/${resume}`)}>Resume Your Table</Btn>
        <Btn variant="secondary" className="w-full mb-3 bg-card" onClick={() => setResume(null)}>Find a New Table</Btn>
      </div>
    </div>
  );
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
        <p className="t-sub text-muted" aria-live="polite">{complete ? "4/4 Matched · opening your table" : queue === "class" ? "Waiting for classmates to join…" : "Looking for available players"}</p>
        {queue === "class" && !complete && left !== null && (s.filled || 0) < 4 && (
          <p className="t-meta text-muted -mt-4 tabular-nums" aria-live="off">{left > 0 ? `Empty seats are filled with demo players in ${left}s` : "Filling empty seats…"}</p>
        )}
        {complete && players.some((p) => p.kind === "virtual") && <p className="t-meta text-muted -mt-4">This demo includes simulated participants.</p>}
        {err && <p className="t-sub text-[#B42318] dark:text-[#FF6961]" role="alert">{err}</p>}
      </main>
      <div className="sticky bottom-0 bg-page px-4 pt-3 pb-safe">
        <Btn variant="secondary" className="w-full mb-3 bg-card" disabled={leaving || complete} onClick={cancel}>Cancel</Btn>
      </div>
    </div>
  );
}
