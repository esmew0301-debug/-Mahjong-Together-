"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye } from "lucide-react";
import { api, forgetRoom, lastRoom } from "@/lib/client";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AnimatedMahjongTile } from "@/components/ui/animated-mahjong-tile";
import { tileArt } from "@/lib/tutorial/sichuan-art";

/** Small tile glyph for the "Play Mahjong" card (same tile art as the game). */
function TileIcon() {
  return (
    <svg viewBox="-17 -22 34 50" width={24} height={35} aria-hidden>
      <g dangerouslySetInnerHTML={{ __html: tileArt({ s: "d", n: 5 } as never) }} />
    </svg>
  );
}

function EntryCard({ title, desc, icon, onClick, primary }: { title: string; desc: string; icon: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={`group text-left w-full rounded-[22px] border p-5 sm:p-6 flex flex-col gap-3 min-h-[156px] shadow-card transition-[transform,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(0,0,0,0.08)] active:translate-y-0 motion-reduce:transition-none ${primary ? "bg-green-strong border-green-strong text-white" : "bg-card border-line text-ink"}`}>
      <span className={`h-12 w-12 rounded-full flex items-center justify-center ${primary ? "bg-white/15" : "bg-sage"}`}>{icon}</span>
      <span className="flex items-center gap-2">
        <span className="text-[22px] leading-[30px] font-semibold">{title}</span>
        <ArrowRight size={20} className="ml-auto transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden />
      </span>
      <span className={`t-body ${primary ? "text-white/90" : "text-muted"}`}>{desc}</span>
    </button>
  );
}

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
    <div data-wide className="min-h-[100dvh] flex flex-col px-4 sm:px-8 pt-safe pb-safe">
      <div className="h-14 flex items-center justify-end w-full max-w-[1040px] mx-auto"><span className="-mr-2"><ThemeToggle /></span></div>
      <main className="flex-1 w-full max-w-[1040px] mx-auto flex flex-col lg:justify-center gap-6 lg:gap-10 pb-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-10">
          <div className="lg:flex-1">
            {/* Homepage-only custom wordmark: the transparent artwork is a mask over the brand-green token. */}
            <h1 className="m-0">
              <span className="sr-only">Mahjong Together</span>
              <span aria-hidden className="block w-[min(276px,100%)] lg:w-[420px] aspect-[1316/221] bg-green-text"
                style={{ WebkitMask: "url(/brand/mahjong-together-wordmark.png) left center / contain no-repeat", mask: "url(/brand/mahjong-together-wordmark.png) left center / contain no-repeat" }} />
            </h1>
            <p className="t-body lg:text-[20px] lg:leading-[30px] text-muted mt-2 lg:mt-3">Watch. Wonder. Connect. Play.</p>
          </div>
          <div className="flex items-center justify-center py-2 lg:py-0 min-h-[200px] lg:min-h-[220px] lg:w-[260px]">
            <AnimatedMahjongTile width={120} />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-5">
          <EntryCard primary title="Watch a Game" icon={<Eye size={24} />} onClick={() => router.push("/profile?next=watch")}
            desc="Learn by watching others play, asking questions, and discovering people who share your curiosity." />
          <EntryCard title="Play Mahjong" icon={<TileIcon />} onClick={() => router.push("/play")}
            desc="Create or join a room and play Sichuan Mahjong together." />
        </div>
        {recent && <button onClick={() => router.push(`/room/${recent}`)} className="t-sub text-muted min-h-11 self-center">Return to Room {recent}</button>}
      </main>
    </div>
  );
}
