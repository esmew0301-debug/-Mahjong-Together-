"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getProfile } from "@/lib/client";
import { DeskPage } from "@/components/ui/desk";
import { ClassroomForm } from "@/components/ui/ClassroomForm";
import { CLASSROOM_CODE } from "@/lib/classroom";

/** Play Mahjong → profile → classroom code → human-first matching (25 s, then simulated players). */
export default function ClassroomPage() {
  const router = useRouter();
  const [initial, setInitial] = useState<string | null>(null);
  useEffect(() => {
    if (!getProfile()) { router.replace("/profile?next=class"); return; }
    try { setInitial(localStorage.getItem("mt.classCode") === CLASSROOM_CODE ? CLASSROOM_CODE : ""); } catch { setInitial(""); }
  }, [router]);
  if (initial === null) return null;
  return (
    <DeskPage onBack={() => router.push("/profile?next=class")}>
      <ClassroomForm eyebrow="Play Mahjong" title="Join Your Classroom" text="Enter your classroom code to find other players." button="Find My Table" initial={initial}
        note={<div className="rounded-[14px] border border-green bg-green-soft px-4 py-3" role="note" data-teaching-notice>
          <p className="t-sub font-semibold text-green-text">Classroom Teaching Game</p>
          <p className="t-sub">Classmates can watch games in this classroom to learn. Spectators can see all four hands; they can never play or interrupt your game.</p>
        </div>}
        onSubmit={async (c) => {
          const j = await api<{ code: string }>("/api/classroom", { code: c });
          try { localStorage.setItem("mt.classCode", j.code); } catch {}
          router.push(`/match?queue=class&code=${encodeURIComponent(j.code)}`);
        }} />
    </DeskPage>
  );
}
