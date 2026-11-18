"use client";

import { Header, cx } from "./index";

/** Desktop page shell: shared header + a centred content area (no phone column, no bottom button stacks). */
export function DeskPage({ onBack, backLabel = "Back", title = "", right, children, className }: { onBack?: () => void; backLabel?: string; title?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-page">
      <Header title={title} onBack={onBack} backLabel={backLabel} right={right} />
      <main className={cx("flex-1 w-full max-w-[1200px] mx-auto px-6 py-10 flex flex-col items-center justify-center", className)}>{children}</main>
    </div>
  );
}
/** A comfortably sized desktop card. */
export function DeskCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cx("w-full rounded-[24px] border bg-card lift p-10", className)}>{children}</section>;
}
