"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, getProfile } from "@/lib/client";
import { DeskPage } from "@/components/ui/desk";
import { ClassroomForm } from "@/components/ui/ClassroomForm";
import { CLASSROOM_CODE } from "@/lib/classroom";

/** Watch a Game → profile → classroom code → table list / waiting room / live spectating. */
function JoinClassroom() {
  const router = useRouter();
  const sp = useSearchParams();
  const [initial, setInitial] = useState<string | null>(null);
  useEffect(() => {
    if (!getProfile()) { router.replace("/profile?next=watch"); return; }
    try { const saved = sp.get("code") || localStorage.getItem("mt.watchCode") || localStorage.getItem("mt.classCode") || ""; setInitial(saved.toUpperCase() === CLASSROOM_CODE ? CLASSROOM_CODE : ""); } catch { setInitial(""); }
  }, [router, sp]);
  if (initial === null) return null;
  return (
    <DeskPage onBack={() => router.push("/profile?next=watch")}>
      <ClassroomForm eyebrow="Watch a Game" title="Join a Classroom" text="Enter the classroom code to watch and learn together." button="Join Classroom" initial={initial}
        onSubmit={async (c) => {
          const p = getProfile();
          if (!p) { router.replace("/profile?next=watch"); return; }
          const j = await api<{ classroom: string }>("/api/watch/join", { code: c, name: p.name, avatar: p.avatar });
          try { localStorage.setItem("mt.watchCode", j.classroom); localStorage.removeItem(`mt.watchGame.${j.classroom}`); } catch {} // a new visit never pins an old table
          router.push(`/watch/${encodeURIComponent(j.classroom)}`);
        }} />
    </DeskPage>
  );
}
export default function WatchJoinPage() {
  return <Suspense fallback={null}><JoinClassroom /></Suspense>;
}
