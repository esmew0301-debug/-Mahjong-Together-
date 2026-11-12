"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Check, ChevronLeft, Mic, Sparkles, X, Image as ImageIcon } from "lucide-react";
import type { Msg, MsgAction, PublicPlayer } from "@/lib/types";
import { ShiningText } from "./shining-text";
import { Reactable } from "./reactions";
import { ThemeToggle } from "./theme-toggle";
import type { ReactionId } from "@/lib/types";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Header({ title, subtitle, onBack, backLabel, right, children }: { title: string; subtitle?: React.ReactNode; onBack?: () => void; backLabel?: string; right?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="pt-safe sticky top-0 z-20 bg-bg/95 backdrop-blur border-b border-line">
      <div className="h-14 px-2 flex items-center gap-1">
        {onBack ? (
          <button onClick={onBack} aria-label={backLabel || "Back"} className="h-11 min-w-11 px-2 flex items-center gap-0.5 rounded-full text-ink hover:bg-surface shrink-0">
            <ChevronLeft size={22} strokeWidth={1.75} />
            {backLabel && <span className="t-sub font-medium max-[359px]:sr-only">{backLabel}</span>}
          </button>
        ) : (
          <div className="w-2" />
        )}
        <div className="flex-1 min-w-0 px-1">
          <div className="t-section truncate">{title}</div>
          {subtitle && <div className="t-meta text-muted truncate">{subtitle}</div>}
        </div>
        <div className="flex items-center gap-0.5 pr-1 shrink-0">{right}<ThemeToggle /></div>
      </div>
      {children}
    </header>
  );
}

export function IconBtn({ label, children, onClick, disabled }: { label: string; children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className="h-11 min-w-11 px-2 rounded-full flex items-center justify-center gap-1 text-ink hover:bg-surface disabled:opacity-30">
      {children}
    </button>
  );
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || parts[0]?.[1] || "")).toUpperCase();
}

export function Avatar({ name, size = 32, dim }: { name: string; size?: number; dim?: boolean }) {
  return (
    <span
      className={cx("inline-flex items-center justify-center rounded-full font-medium shrink-0 bg-bubble text-ink border border-line", dim && "opacity-40")}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function Btn({ children, variant = "primary", className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "selected" | "ok" | "chosen" }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        "t-btn min-h-12 px-4 rounded-[14px] inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:shadow-none",
        variant === "primary" && "bg-green-strong text-white shadow-btn hover:bg-green-hover active:bg-green-pressed disabled:bg-disabled disabled:text-disabled-text",
        variant === "secondary" && "bg-bubble text-ink border border-line hover:bg-hover active:bg-line disabled:text-disabled-text disabled:opacity-60",
        variant === "ghost" && "text-green-text hover:bg-green-soft disabled:text-disabled-text",
        variant === "selected" && "bg-green-soft text-ink border-[1.5px] border-green",
        variant === "ok" && "bg-green-soft text-green-text border border-green",
        variant === "chosen" && "bg-bubble text-ink border-[1.5px] border-muted",
        className
      )}
    >
      {children}
    </button>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal aria-label={title}>
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-[430px] max-h-[88dvh] bg-bg rounded-t-[20px] shadow-sheet flex flex-col pb-safe">
        <div className="flex items-center gap-2 px-4 h-14 border-b border-line shrink-0">
          <div className="t-page flex-1 min-w-0 truncate">{title}</div>
          <button onClick={onClose} aria-label="Close" className="h-11 w-11 -mr-2 rounded-full flex items-center justify-center hover:bg-surface">
            <X size={20} strokeWidth={1.75} />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Prose({ text }: { text: string }) {
  return <div className="t-body whitespace-pre-wrap break-words">{text}</div>;
}

export function AiBadge() {
  return (
    <div className="flex items-center gap-1.5 t-meta text-muted px-1">
      <span className="h-5 w-5 rounded-full border border-green bg-bg inline-flex items-center justify-center">
        <Sparkles size={11} strokeWidth={2} className="text-green-text" />
      </span>
      Rule Assistant
    </div>
  );
}

export function MessageList({ messages, me, players, onDetail, onAction, onReact, busy }: { messages: Msg[]; me: string; players?: PublicPlayer[]; onDetail: (m: Msg) => void; onAction?: (a: MsgAction) => void; onReact?: (msgId: string, reaction: ReactionId | null) => void; busy?: boolean }) {
  const lastAi = [...messages].reverse().find((m) => m.sender === "ai")?.id;
  const nameOf = (id: string) => (id === me ? "You" : players?.find((p) => p.id === id)?.name || "Player");
  return (
    <div className="flex flex-col gap-6">
      {messages.map((m) => {
        if (m.sender === "system")
          return (
            <div key={m.id} className="t-meta text-muted text-center px-6">
              {m.text}
            </div>
          );
        if (m.sender === "ai")
          return (
            <div key={m.id} className="flex flex-col gap-1.5 items-start">
              <AiBadge />
              <div className="max-w-[90%] min-w-0">
              <div className="bg-ai rounded-[18px] rounded-tl-[6px] px-3.5 py-3 flex flex-col gap-2 min-w-0">
                {m.title ? <div className="t-section">{m.title}</div> : null}
                <Prose text={m.text} />
                {m.image && <img src={m.image} alt={m.imageAlt || ""} className="w-full max-w-[360px] h-auto rounded-xl border border-line bg-bg" />}
                {(m.detail || m.source) && (
                  <button onClick={() => onDetail(m)} className="self-start t-sub font-medium text-green-text min-h-8 hover:underline underline-offset-4">
                    {m.detail ? (m.kind === "guide" ? "Detailed instructions" : "View Detailed Explanation") : "Source"}
                  </button>
                )}
              </div>
              </div>
              {onAction && m.actions && m.actions.length > 0 && m.id === lastAi && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {m.actions.map((a, i) => (
                    <button key={i} disabled={busy} onClick={() => onAction(a)} className="min-h-10 px-3.5 rounded-full bg-bg border border-line shadow-card t-sub font-medium text-green-text hover:bg-green-soft disabled:text-disabled-text">
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        const mine = m.sender === me;
        const name = m.name || players?.find((p) => p.id === m.sender)?.name || "Player";
        return (
          <div key={m.id} className={cx("flex flex-col gap-1 max-w-[82%]", mine ? "self-end items-end" : "self-start items-start")}>
            {!mine && <div className="t-meta text-muted px-1">{name}</div>}
            {m.hadPhoto && (
              <div className="t-meta text-muted flex items-center gap-1 px-1">
                <ImageIcon size={12} /> Photo attached · not uploaded
              </div>
            )}
            <Reactable msg={m} me={me} side={mine ? "right" : "left"} nameOf={nameOf} onReact={onReact}>
              <div className={cx("rounded-[18px] px-3.5 py-2.5 t-body whitespace-pre-wrap break-words", mine ? "bg-green-strong text-white shadow-bubble rounded-br-[6px]" : "bg-other text-ink border border-green rounded-bl-[6px]")}>{m.text}</div>
            </Reactable>
          </div>
        );
      })}
    </div>
  );
}

export function Typing({ label = "Rule Assistant is thinking…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 t-sub px-1" role="status" aria-live="polite">
      <ShiningText text={label} />
    </div>
  );
}

type SR = { start: () => void; stop: () => void; abort: () => void; lang: string; interimResults: boolean; continuous: boolean; onresult: ((e: any) => void) | null; onend: (() => void) | null; onerror: ((e: any) => void) | null };

export function useSpeech(onText: (t: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<SR | null>(null);
  const cb = useRef(onText);
  cb.current = onText;
  useEffect(() => {
    const w = window as any;
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => rec.current?.abort();
  }, []);
  const toggle = () => {
    if (!supported) {
      setError("Voice input isn't supported in this browser. Try Chrome or Safari, or use your keyboard's dictation key.");
      return;
    }
    if (listening) return rec.current?.stop();
    const w = window as any;
    const C = w.SpeechRecognition || w.webkitSpeechRecognition;
    const r: SR = new C(); // the browser asks for microphone permission only now
    r.lang = navigator.language || "en-US";
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (e: any) => {
      let t = "";
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) t += e.results[i][0].transcript;
      if (t) cb.current(t.trim());
    };
    r.onerror = (e: any) => setError(e?.error === "not-allowed" ? "Microphone permission was denied." : e?.error === "no-speech" ? "No speech detected. Try again." : "Voice input stopped.");
    r.onend = () => setListening(false);
    rec.current = r;
    setError(null);
    setListening(true);
    try {
      r.start();
    } catch {
      setListening(false);
    }
  };
  return { supported, listening, error, toggle };
}

export function Composer({
  placeholder, disabled, disabledText, onAsk, onSend, preferAsk, leading, above, inputRef, busy,
}: {
  placeholder: string;
  disabled?: boolean;
  disabledText?: string;
  onAsk: (t: string) => void;
  onSend?: (t: string) => void;
  preferAsk?: boolean;
  leading?: React.ReactNode;
  above?: React.ReactNode;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  busy?: boolean;
}) {
  const [text, setText] = useState("");
  const localRef = useRef<HTMLTextAreaElement>(null);
  const ref = inputRef || localRef;
  const speech = useSpeech((t) => setText((prev) => (prev ? prev.trimEnd() + " " : "") + t));
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 132) + "px";
  }, [text, ref]);
  const has = text.trim().length > 0 && !busy;
  const submit = (fn?: (t: string) => void) => {
    if (!fn || !has || disabled) return;
    fn(text.trim());
    setText("");
  };
  const primaryIsAsk = !onSend || !!preferAsk;
  const primary = primaryIsAsk ? onAsk : onSend!;
  const secondary = onSend ? (primaryIsAsk ? onSend : onAsk) : undefined;
  return (
    <div className="sticky bottom-0 z-10 bg-bg px-3 pt-2 pb-safe shadow-composer">
      {above}
      {disabled && disabledText ? (
        <div className="t-sub text-muted text-center py-3 bg-bubble rounded-[22px]">{disabledText}</div>
      ) : (
        <div className="border border-line rounded-[22px] bg-bg focus-within:border-green">
          <textarea
            ref={ref}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit(primary);
              }
            }}
            placeholder={speech.listening ? "Listening…" : placeholder}
            aria-label={placeholder}
            className="w-full resize-none bg-transparent px-4 pt-3 pb-1 outline-none focus-visible:outline-none text-[16px] leading-6 placeholder:text-muted"
          />
          <div className="flex items-center gap-0.5 px-1.5 pb-1.5">
            {leading}
            <button
              type="button"
              onClick={speech.toggle}
              aria-label={speech.listening ? "Stop voice input" : "Voice input"}
              title={speech.supported ? "Speak (speech-to-text)" : "Voice input not supported in this browser"}
              className={cx("h-10 w-10 rounded-full flex items-center justify-center", speech.listening ? "bg-green-strong text-white" : speech.supported ? "text-ink hover:bg-surface" : "text-muted")}
            >
              <Mic size={19} strokeWidth={1.75} />
            </button>
            <div className="flex-1" />
            {secondary && (
              <button type="button" onClick={() => submit(secondary)} disabled={!has}
                className="h-10 px-3 rounded-full bg-bubble border border-line t-btn text-ink flex items-center gap-1.5 hover:bg-hover disabled:text-disabled-text">
                {primaryIsAsk ? "Send to Group" : <><Sparkles size={15} strokeWidth={1.75} /> Ask Rule Assistant</>}
              </button>
            )}
            <button type="button" onClick={() => submit(primary)} disabled={!has}
              aria-label={primaryIsAsk ? "Ask Rule Assistant" : "Send to Group"} title={primaryIsAsk ? "Ask Rule Assistant" : "Send to Group"}
              className="h-10 min-w-10 px-2.5 rounded-full bg-green-strong text-white shadow-btn flex items-center justify-center gap-1 hover:bg-green-hover active:bg-green-pressed disabled:bg-disabled disabled:text-disabled-text disabled:shadow-none">
              {primaryIsAsk && onSend && <span className="t-btn pl-1">Ask</span>}
              <ArrowUp size={18} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
      {(speech.error || speech.listening) && (
        <div className="t-meta text-muted text-center mt-1">{speech.listening ? "Listening… the text appears above so you can edit it before sending." : speech.error}</div>
      )}
    </div>
  );
}

// ---------------- shared panel bits ----------------
export function Panel({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <section aria-label={label} className="border border-line rounded-2xl bg-bg p-4 shadow-card flex flex-col gap-3">
      {children}
    </section>
  );
}

export function Statuses({ players, value, labels }: { players: PublicPlayer[]; value: (p: PublicPlayer) => string | undefined; labels: Record<string, { text: string; ok?: boolean }> }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {players.map((p) => {
        const v = value(p);
        const l = v ? labels[v] || { text: v } : null;
        return (
          <li key={p.id} className="flex items-center gap-2 t-sub">
            <Avatar name={p.name} size={24} dim={!v} />
            <span className="flex-1 min-w-0 truncate">{p.name}</span>
            <span className={cx("shrink-0 flex items-center gap-1", l?.ok ? "text-ok font-medium" : l ? "text-ink" : "text-muted")}>
              {l?.ok && <Check size={14} strokeWidth={2.5} className="text-green" />}
              {l ? l.text : "Waiting"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function Count({ n, label }: { n: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 shrink-0" aria-live="polite">
      <span className="w-10 h-1 rounded-full bg-line overflow-hidden" aria-hidden>
        <span className="block h-full rounded-full bg-green" style={{ width: `${n * 25}%` }} />
      </span>
      <span className={cx("t-meta font-medium", n === 4 ? "text-green-text" : "text-muted")}>{n} of 4 {label}</span>
    </span>
  );
}

