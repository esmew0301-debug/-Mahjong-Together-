"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getProfile, saveProfile } from "@/lib/client";
import { Check } from "lucide-react";
import { Btn, Header, cx } from "@/components/ui";
import { AVATAR_OPTIONS, EMOJI_FONT, avatarOf } from "@/components/s3/avatar";

function ProfileForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") === "join" ? "join" : "match";
  const code = (sp.get("code") || "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 8); // QR target room is kept
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string>(AVATAR_OPTIONS[0].id);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const p = getProfile(); // prefill only — the player still chooses Continue
    if (p) { setName(p.name); setAvatar(avatarOf(p.avatar).id); } // older saved avatars fall back to the first emoji
  }, []);

  const go = () => {
    const n = name.replace(/\s+/g, " ").trim();
    if (!n) return setErr("Enter a name to continue.");
    saveProfile({ name: n, avatar });
    if (next === "match") router.push("/match");
    else router.push(code ? `/join/${code}?auto=1` : "/join");
  };

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Header title="" onBack={() => router.push(code ? "/" : "/")} backLabel="Back" />
      <form className="flex-1 flex flex-col px-4 pt-4 gap-6" onSubmit={(e) => { e.preventDefault(); go(); }}>
        <div>
          <h1 className="t-app text-green-text">Create Your Profile</h1>
          <p className="t-body text-muted mt-1">Choose how others see you at the table.</p>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="t-sub font-medium">Your Name</span>
          <input value={name} onChange={(e) => { setName(e.target.value); setErr(null); }} maxLength={24} placeholder="Enter your name" autoComplete="nickname"
            aria-invalid={!!err} className="h-12 px-4 rounded-xl border border-line bg-card outline-none focus:border-green" />
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="t-sub font-medium mb-2">Choose an Avatar</legend>
          <div className="grid grid-cols-4 gap-3 justify-items-center" role="radiogroup" aria-label="Choose an Avatar">
            {AVATAR_OPTIONS.map(({ id, label, emoji }) => {
              const on = avatar === id;
              return (
                <button key={id} type="button" role="radio" onClick={() => setAvatar(id)} aria-checked={on} aria-label={label} title={label}
                  className={cx("relative w-full max-w-[68px] aspect-square min-h-12 rounded-full flex items-center justify-center",
                    "transition-[transform,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none",
                    on ? "bg-green-soft ring-2 ring-green shadow-[0_4px_14px_rgba(53,117,40,0.22)] -translate-y-0.5" : "bg-bubble ring-1 ring-line hover:bg-hover active:scale-95")}>
                  <span aria-hidden style={{ ...EMOJI_FONT, fontSize: 30, lineHeight: 1 }} className={cx("select-none drop-shadow-[0_1px_1px_rgba(0,0,0,0.12)] transition-transform duration-200 motion-reduce:transition-none", on && "scale-110")}>{emoji}</span>
                  {on && <span className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-green-strong text-white ring-2 ring-bg flex items-center justify-center" aria-hidden><Check size={12} strokeWidth={3} /></span>}
                </button>
              );
            })}
          </div>
        </fieldset>
        {err && <p className="t-sub text-[#B42318] dark:text-[#FF6961]" role="alert">{err}</p>}
        <div className="flex-1" />
        <Btn type="submit" className="w-full mb-[max(12px,env(safe-area-inset-bottom))]">Continue</Btn>
      </form>
    </div>
  );
}

export default function ProfilePage() {
  return <Suspense fallback={null}><ProfileForm /></Suspense>;
}
