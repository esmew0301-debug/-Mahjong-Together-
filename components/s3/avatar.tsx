"use client";

import { cx } from "@/components/ui";

/** Emoji avatars (system emoji font — no copied image assets). AI demo seats always use the robot emoji + "AI Player". */
export const AVATAR_OPTIONS = [
  { id: "smile", label: "Smiling face", emoji: "🙂" },
  { id: "cool", label: "Cool face", emoji: "😎" },
  { id: "happy", label: "Happy face", emoji: "😊" },
  { id: "nerd", label: "Nerdy face", emoji: "🤓" },
  { id: "cheer", label: "Cheerful face", emoji: "😄" },
  { id: "calm", label: "Calm face", emoji: "😌" },
  { id: "cat", label: "Cat face", emoji: "🐱" },
  { id: "bear", label: "Bear face", emoji: "🐻" },
] as const;
/** Fallback for demo seats created before fixed avatars existed. */
export const AI_EMOJI = "🤖";
/** Fixed emoji for demo seats (server assigns: Xinyi ❤️, Xintong 🐶, Frank 🐻, Esme 😊). */
const AI_ONLY: Record<string, string> = { heart: "❤️", dog: "🐶" };
/** The ONE emoji mapping for any participant, used on every screen. */
export function emojiFor(p: { avatar?: string; kind?: string }) {
  if (p.kind === "virtual") return AI_ONLY[p.avatar || ""] || AVATAR_OPTIONS.find((a) => a.id === p.avatar)?.emoji || AI_EMOJI;
  return avatarOf(p.avatar).emoji;
}
export const avatarOf = (id?: string) => AVATAR_OPTIONS.find((a) => a.id === id) || AVATAR_OPTIONS[0];
export const EMOJI_FONT = { fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif' } as const;

export function SeatAvatar({ avatar, virtual, size = 40, dim, me }: { avatar?: string; virtual?: boolean; size?: number; dim?: boolean; me?: boolean }) {
  return (
    <span aria-hidden className={cx("inline-flex items-center justify-center rounded-full shrink-0 border", me ? "bg-green-soft border-green text-green-text" : "bg-bubble border-line text-ink", dim && "opacity-40")}
      style={{ width: size, height: size }}>
      <span style={{ ...EMOJI_FONT, fontSize: Math.round(size * 0.56), lineHeight: 1 }}>{emojiFor({ avatar, kind: virtual ? "virtual" : "human" })}</span>
    </span>
  );
}
