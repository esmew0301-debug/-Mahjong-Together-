"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, forgetRoom, lastRoom, rememberRoom } from "@/lib/client";
import { Btn, Header } from "@/components/ui";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import Image from "next/image";
import { HERO } from "@/lib/hero";

export default function Home() {
  const router = useRouter();
  const [view, setView] = useState<"home" | "create" | "join">("home");
  const [name, setName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<string | null>(null);
  // Show "Return to Room" only after the server confirms this device still has a seat in an active room.
  useEffect(() => {
    const code = lastRoom();
    if (!code) return;
    let cancelled = false;
    api(`/api/rooms/${code}`)
      .then((j) => {
        if (cancelled) return;
        if (j.member && j.room && j.room.status !== "complete") setRecent(j.room.code);
        else forgetRoom(code);
      })
      .catch(() => {
        if (!cancelled) forgetRoom(code);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const create = async () => {
    if (!name.trim()) return setErr("Please enter your name.");
    setBusy(true);
    setErr(null);
    try {
      const j = await api("/api/rooms", { name, roomName: roomName || "Friday Mahjong Night" });
      rememberRoom(j.room.code);
      router.push(`/room/${j.room.code}`);
    } catch (e) {
      setErr(e instanceof ApiError && e.config ? "Live rooms aren't set up on this deployment yet. The site owner needs to connect Upstash Redis (see README)." : (e as Error).message);
      setBusy(false);
    }
  };
  const join = () => {
    const c = code.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^MAH/, "");
    if (c.length !== 4) return setErr("Room codes look like MAH-7K2P.");
    router.push(`/join/MAH-${c}`);
  };

  if (view === "create")
    return (
      <div className="min-h-[100dvh] flex flex-col">
        <Header title="Create a Room" onBack={() => { setView("home"); setErr(null); }} />
        <form className="flex-1 flex flex-col px-4 py-6 gap-5" onSubmit={(e) => { e.preventDefault(); create(); }}>
          <label className="flex flex-col gap-1.5">
            <span className="t-sub font-medium">Your name</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="e.g. Alex" className="h-12 px-4 rounded-xl border border-line outline-none focus:border-green" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="t-sub font-medium">Room name <span className="text-muted font-normal">(optional)</span></span>
            <input value={roomName} onChange={(e) => setRoomName(e.target.value)} maxLength={40} placeholder="Friday Mahjong Night" className="h-12 px-4 rounded-xl border border-line outline-none focus:border-green" />
          </label>
          <p className="t-sub text-muted">You'll be the host. Three friends join by scanning your QR code on their own phones.</p>
          {err && <p className="t-sub text-[#B42318] dark:text-[#FF6961]" role="alert">{err}</p>}
          <div className="flex-1" />
          <Btn type="submit" disabled={busy} className="w-full mb-[max(12px,env(safe-area-inset-bottom))]">{busy ? "Creating…" : "Create Room"}</Btn>
        </form>
      </div>
    );

  if (view === "join")
    return (
      <div className="min-h-[100dvh] flex flex-col">
        <Header title="Join a Room" onBack={() => { setView("home"); setErr(null); }} />
        <form className="flex-1 flex flex-col px-4 py-6 gap-5" onSubmit={(e) => { e.preventDefault(); join(); }}>
          <label className="flex flex-col gap-1.5">
            <span className="t-sub font-medium">Room code</span>
            <input autoFocus value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="MAH-7K2P" autoCapitalize="characters" className="h-12 px-4 rounded-xl border border-line outline-none focus:border-green tracking-wider" />
          </label>
          <p className="t-sub text-muted">Easier: scan the QR code on the host's phone with your camera.</p>
          {err && <p className="t-sub text-[#B42318] dark:text-[#FF6961]" role="alert">{err}</p>}
          <div className="flex-1" />
          <Btn type="submit" className="w-full mb-[max(12px,env(safe-area-inset-bottom))]">Continue</Btn>
        </form>
      </div>
    );

  return (
    <div className="min-h-[100dvh] flex flex-col px-4 pt-safe pb-safe">
      <div className="h-14 flex items-center justify-between t-app">Mahjong Together<span className="-mr-2"><ThemeToggle /></span></div>
      {HERO ? (
        <>
          {/* Intro moved up to make room for the homepage-only hero tile; wording and type unchanged. */}
          <div className="pt-6">
            <h1 className="text-[24px] leading-[32px] font-semibold">Learn Mahjong Together.</h1>
            <p className="t-body text-muted mt-2">Your AI companion for learning new Mahjong traditions with friends.</p>
          </div>
          <div className="flex-1 flex items-center justify-center py-6 min-h-[220px]" aria-hidden>
            <Image src={HERO.src} width={HERO.width} height={HERO.height} alt="" priority unoptimized draggable={false}
              className="pointer-events-none select-none h-auto w-[min(62vw,240px)] max-h-[36dvh] object-contain" />
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col justify-center pb-16">
          <h1 className="text-[24px] leading-[32px] font-semibold">Learn Mahjong Together.</h1>
          <p className="t-body text-muted mt-2">Your AI companion for learning new Mahjong traditions with friends.</p>
        </div>
      )}
      <div className="flex flex-col gap-3 pb-3">
        <Btn onClick={() => setView("create")}>Create a Room</Btn>
        <Btn variant="secondary" onClick={() => setView("join")}>Join a Room</Btn>
        {recent && (
          <button onClick={() => router.push(`/room/${recent}`)} className="t-sub text-muted min-h-11">Return to Room {recent}</button>
        )}
      </div>
    </div>
  );
}
