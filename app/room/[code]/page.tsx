"use client";

import { use } from "react";
import { RoomApp } from "@/components/RoomApp";

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  return <RoomApp code={decodeURIComponent(code).toUpperCase()} />;
}
