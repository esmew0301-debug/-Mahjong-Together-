"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getProfile, saveProfile } from "@/lib/client";
import { Check } from "lucide-react";
import { Btn, cx } from "@/components/ui";
import { DeskCard, DeskPage } from "@/components/ui/desk";
import { AVATAR_OPTIONS, EMOJI_FONT, avatarOf } from "@/components/s3/avatar";

/** Create Profile (players and spectators): name + emoji avatar. Desktop two-column card. */
function ProfileForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") === "join" ? "join" : sp.get("next") === "class" ? "class" : sp.get("next") === "watch" ? "watch" : "match";
  const code = (sp.get("code") || "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 8);
  const queue = sp.get("queue") === "class" ? "class" : "";
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string>(AVATAR_OPTIONS[0].id);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const p = getProfile(); // prefill only — the person still chooses Continue
    if (p) { setName(p.name); setAvatar(avatarOf(p.avatar).id); }
  }, []);

  const go = () => {
    const n = name.replace(/\s+/g, " ").trim();
    if (!n) return setErr("Enter a name to continue.");
    saveProfile({ name: n, avatar });
    if (next === "class") router.push("/classroom");
    else if (next === "watch") router.push("/watch");
    else if (next === "match") router.push(queue ? `/match?queue=${queue}${sp.get("code") ? `&code=${encodeURIComponent(sp.get("code")!)}` : ""}` : "/match");
    else router.push(code ? `/join/${code}?auto=1` : "/join");
  };
  const watch = next === "watch";

  return (
    <DeskPage onBack={() => router.push("/")}>
      <DeskCard className="max-w-[920px]">
        <form className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-12" onSubmit={(e) => { e.preventDefault(); go(); }}>
          <div className="flex flex-col gap-6">
            <div>
              <p className="t-sub font-semibold text-green-text">{watch ? "Watch a Game" : "Play Mahjong"}</p>
              <h1 className="text-[30px] leading-[38px] font-semibold mt-1">Create Your Profile</h1>
              <p className="t-body text-muted mt-2">{watch ? "Choose how other viewers see you." : "Choose how others see you at the table."}</p>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="t-sub font-medium">Your Name</span>
              <input value={name} onChange={(e) => { setName(e.target.value); setErr(null); }} maxLength={24} placeholder="Enter your name" autoComplete="nickname" autoFocus
                aria-invalid={!!err} className="h-12 px-4 rounded-xl border border-line bg-page outline-none focus:border-green" />
            </label>
            {err && <p className="t-sub text-[#B42318] dark:text-[#FF6961] -mt-3" role="alert">{err}</p>}
            <div className="flex-1" />
            <Btn type="submit" className="self-start min-w-[200px]">Continue</Btn>
          </div>
          <fieldset className="flex flex-col gap-3">
            <legend className="t-sub font-medium mb-3">Choose an Emoji Avatar</legend>
            <div className="grid grid-cols-4 gap-4" role="radiogroup" aria-label="Choose an Emoji Avatar">
              {AVATAR_OPTIONS.map(({ id, label, emoji }) => {
                const on = avatar === id;
                return (
                  <button key={id} type="button" role="radio" onClick={() => setAvatar(id)} aria-checked={on} aria-label={label} title={label}
                    className={cx("relative aspect-square rounded-[20px] flex items-center justify-center",
                      "transition-[transform,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none",
                      on ? "bg-green-soft ring-2 ring-green shadow-[0_4px_14px_rgba(53,117,40,0.22)] -translate-y-0.5" : "bg-bubble ring-1 ring-line hover:bg-hover active:scale-95")}>
                    <span aria-hidden style={{ ...EMOJI_FONT, fontSize: 40, lineHeight: 1 }} className={cx("select-none transition-transform duration-200 motion-reduce:transition-none", on && "scale-110")}>{emoji}</span>
                    {on && <span className="absolute bottom-1.5 right-1.5 h-6 w-6 rounded-full bg-green-strong text-white ring-2 ring-card flex items-center justify-center" aria-hidden><Check size={14} strokeWidth={3} /></span>}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </form>
      </DeskCard>
    </DeskPage>
  );
}

export default function ProfilePage() {
  return <Suspense fallback={null}><ProfileForm /></Suspense>;
}
