"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Btn } from "@/components/ui";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { CLASS_QR_URL } from "@/lib/site";

/**
 * Presentation screen for the classroom: one large, stable QR code that everyone scans. It always encodes the public
 * production URL + the shared class queue (lib/site.ts) — never localhost — so refreshing never changes it.
 */
export default function PresentPage() {
  const router = useRouter();
  const url = CLASS_QR_URL;
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 4, width: 1200, color: { dark: "#000000", light: "#ffffff" } })
      .then(setQr).catch(() => setQr(null));
  }, [url]);

  return (
    // Same shell and rhythm as the homepage: rendered inside the app's phone-width column (centered on desktop,
    // full screen on phones). The QR card follows the phone content width, so a projected desktop shows a phone screen.
    <div className="min-h-[100dvh] flex flex-col px-4 pt-safe pb-safe">
      <div className="h-14 flex items-center justify-between">
        <button onClick={() => router.push("/")} aria-label="Back to Home" className="h-11 px-2 -ml-2 rounded-full t-sub font-medium text-ink hover:bg-surface">‹ Back to Home</button>
        <span className="-mr-2"><ThemeToggle /></span>
      </div>
      <div className="pt-2">
        <h1 className="text-[26px] leading-[34px] font-semibold text-green-text">Play Mahjong Together</h1>
        <p className="t-body text-ink mt-1">Scan to join the match.</p>
        <p className="t-sub text-muted">Create your profile and find your table.</p>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-3 py-5">
        <div className="w-full rounded-[20px] bg-white border border-line shadow-card p-4 flex items-center justify-center">
          {qr ? (
            <img src={qr} alt={`QR code: ${url}`} className="block w-full max-w-[320px] h-auto [image-rendering:pixelated]" />
          ) : (
            <div className="w-full max-w-[320px] aspect-square" />
          )}
        </div>
        <p className="t-meta text-muted text-center break-all">{url.replace(/^https:\/\//, "")}</p>
      </div>
      <div className="flex flex-col gap-3 pb-3">
        <Btn variant="secondary" className="bg-card" onClick={() => router.push("/profile?next=match")}>Match on This Device</Btn>
      </div>
    </div>
  );
}
