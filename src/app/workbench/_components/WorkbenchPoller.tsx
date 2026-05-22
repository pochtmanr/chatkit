"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Drives `router.refresh()` on a fixed cadence so the QueueRail picks
 *  up new conversations / assignment changes. Polling is the fallback
 *  until a business-scoped Realtime channel exists (shared §9). */
export function WorkbenchPoller({ intervalMs }: { intervalMs: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
