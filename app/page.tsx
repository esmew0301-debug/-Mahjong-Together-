"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, forgetRoom, lastRoom } from "@/lib/client";
import { Btn } from "@/components/ui";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AnimatedMahjongTile } from "@/components/ui/animated-mahjong-tile";

export default function Home() {
  const router = useRouter();
  const [recent, setRecent] = useState<string | null>(null);
  // A resume link appears only after the server confirms this device still holds a seat in an active room.
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
      .catch(() => { if (!cancelled) forgetRoom(code); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col px-4 pt-safe pb-safe">
      <div className="h-14 flex items-center justify-end"><span className="-mr-2"><ThemeToggle /></span></div>
      <div className="pt-2">
        {/* Homepage-only custom wordmark (from the supplied lettering): the transparent artwork is used as a mask over
            the brand-green token, so it stays sharp on Retina and follows Light/Dark mode. */}
        <h1 className="m-0">
          <span className="sr-only">Mahjong Together</span>
          <span aria-hidden className="block w-[min(276px,100%)] aspect-[1316/221] bg-green-text"
            style={{ WebkitMask: "url(/brand/mahjong-together-wordmark.png) left center / contain no-repeat", mask: "url(/brand/mahjong-together-wordmark.png) left center / contain no-repeat" }} />
        </h1>
        <p className="t-body text-muted mt-2">Play Sichuan Mahjong together.</p>
      </div>
      <div className="flex-1 flex items-center justify-center py-4 min-h-[300px]">
        {/* Homepage only: the animated 3D 發 tile replaces the static hero image (not shown elsewhere). */}
        <AnimatedMahjongTile width={132} />
      </div>
      <div className="flex flex-col gap-3 pb-3">
        <Btn onClick={() => router.push("/profile?next=match")}>Random Match</Btn>
        <Btn variant="secondary" onClick={() => router.push("/profile?next=join")}>Join a Room</Btn>
        {recent && <button onClick={() => router.push(`/room/${recent}`)} className="t-sub text-muted min-h-11">Return to Room {recent}</button>}
      </div>
    </div>
  );
}
