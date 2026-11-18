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

/** Original entry card with the InteractiveHoverButton hover (components/ui/interactive-hover-button.tsx). */
function EntryCard({ title, desc, icon, onClick, primary }: { title: string; desc: string; icon: React.ReactNode; onClick: () => void; primary?: boolean }) {
  const move = "transition-all duration-300 motion-reduce:transition-none";
  return (
    <button type="button" onClick={onClick}
      className={`ihb group relative isolate overflow-hidden text-left w-full rounded-[22px] border p-5 sm:p-6 flex flex-col gap-3 min-h-[156px] shadow-card outline-none focus-visible:ring-[3px] focus-visible:ring-green/40 transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(0,0,0,0.08)] active:translate-y-0 motion-reduce:transition-none ${primary ? "bg-green-strong border-green-strong text-white" : "bg-card border-line text-ink"}`}>
      <span aria-hidden className={`ihb-spot absolute left-[20%] top-[40%] -z-10 h-2 w-2 rounded-lg group-hover:left-0 group-hover:top-0 group-hover:h-full group-hover:w-full group-hover:scale-[1.8] group-focus-visible:left-0 group-focus-visible:top-0 group-focus-visible:h-full group-focus-visible:w-full group-focus-visible:scale-[1.8] ${primary ? "bg-[#1f4d16] dark:bg-[#24591a]" : "bg-green-strong"} ${move}`} />
      <span className={`h-12 w-12 rounded-full flex items-center justify-center ${move} ${primary ? "bg-white/15" : "bg-sage group-hover:bg-white/15 group-hover:text-white group-focus-visible:bg-white/15 group-focus-visible:text-white"}`}>{icon}</span>
      <span className="relative overflow-hidden h-[30px] flex items-center">
        <span className={`ihb-label text-[22px] leading-[30px] font-semibold translate-x-0 group-hover:translate-x-12 group-hover:opacity-0 group-focus-visible:translate-x-12 group-focus-visible:opacity-0 ${move}`}>{title}</span>
        <span aria-hidden className={`ihb-reveal absolute inset-0 flex items-center gap-2 text-[22px] leading-[30px] font-semibold text-white translate-x-12 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 ${move}`}>{title}<ArrowRight size={20} /></span>
      </span>
      <span className={`t-body ${move} ${primary ? "text-white/90" : "text-muted group-hover:text-white/90 group-focus-visible:text-white/90"}`}>{desc}</span>
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
        // optional, never automatic: only a genuinely unfinished game (not finished / ended-and-reviewing / expired)
        if (j.member && j.room && ["lobby", "setup", "playing", "hand_review"].includes(j.room.status)) setRecent(j.room.code);
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
          <EntryCard title="Play Mahjong" icon={<TileIcon />} onClick={() => router.push("/profile?next=class")}
            desc="Create or join a room and play Sichuan Mahjong together." />
        </div>
        {recent && <button onClick={() => router.push(`/room/${recent}`)} className="t-sub text-muted min-h-11 self-center hover:underline">Resume Previous Game</button>}
      </main>
    </div>
  );
}
