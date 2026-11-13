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
    // Full-viewport presentation layout (escapes the phone-width column so the code is large on a projector).
    <div className="fixed inset-0 z-30 bg-page overflow-y-auto">
      <div className="min-h-full flex flex-col items-center px-4 pt-safe pb-safe">
        <div className="w-full max-w-[960px] h-14 flex items-center justify-between">
          <button onClick={() => router.push("/")} className="h-11 px-2 -ml-2 rounded-full t-sub font-medium text-ink hover:bg-surface">‹ Back to Home</button>
          <span className="-mr-2"><ThemeToggle /></span>
        </div>
        <div className="flex-1 w-full max-w-[960px] flex flex-col items-center justify-center gap-6 py-6 text-center">
          <div>
            <h1 className="text-[30px] leading-[38px] min-[768px]:text-[44px] min-[768px]:leading-[52px] font-semibold text-green-text">Play Mahjong Together</h1>
            <p className="text-[18px] leading-[26px] min-[768px]:text-[24px] min-[768px]:leading-[32px] mt-2 text-ink">Scan to join the match.</p>
            <p className="t-body min-[768px]:text-[18px] text-muted mt-1">Create your profile and find your table.</p>
          </div>
          <div className="rounded-[28px] bg-white border border-line shadow-card p-4 min-[768px]:p-6">
            {qr ? (
              <img src={qr} alt={`QR code: ${url}`} className="block w-[min(78vw,60vh,520px)] h-auto [image-rendering:pixelated]" />
            ) : (
              <div className="w-[min(78vw,60vh,520px)] aspect-square" />
            )}
          </div>
          {url && <p className="t-sub text-muted break-all max-w-[520px]">{url.replace(/^https:\/\//, "")}</p>}
          <div className="w-full max-w-[400px] flex flex-col gap-2">
            <Btn variant="secondary" className="w-full bg-card" onClick={() => router.push("/profile?next=match")}>Match on This Device</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
