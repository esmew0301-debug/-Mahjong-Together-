"use client";

import { useRouter } from "next/navigation";
import { Btn, Header } from "@/components/ui";

/** Play Mahjong → the EXISTING player flows (unchanged): classroom room, random match, or a private room code. */
export default function PlayPage() {
  const router = useRouter();
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Header title="" onBack={() => router.push("/")} backLabel="Back" />
      <main className="flex-1 flex flex-col px-4 pt-4 gap-6">
        <div>
          <h1 className="t-app text-green-text">Play Mahjong</h1>
          <p className="t-body text-muted mt-1">Create or join a room and play Sichuan Mahjong together.</p>
        </div>
        <div className="flex-1" />
        <div className="flex flex-col gap-3 pb-3 mb-[max(12px,env(safe-area-inset-bottom))]">
          <Btn onClick={() => router.push("/profile?next=class")}>Join Room</Btn>
          <Btn variant="secondary" onClick={() => router.push("/present")}>Random Match</Btn>
          <button onClick={() => router.push("/profile?next=join")} className="t-sub text-muted min-h-11">Have a private room code?</button>
        </div>
      </main>
    </div>
  );
}
