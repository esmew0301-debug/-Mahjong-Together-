"use client";

import { use } from "react";
import { WatchApp } from "@/components/watch/WatchApp";

/** Live Spectating for one classroom (e.g. /watch/COGS123). Desktop / laptop experience. */
export default function WatchClassPage({ params }: { params: Promise<{ cls: string }> }) {
  const { cls } = use(params);
  return <WatchApp cls={decodeURIComponent(cls).toUpperCase()} />;
}
