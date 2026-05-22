"use client";

import { useEffect, useState } from "react";
import { getWorkbenchBadgeCount } from "@/app/dashboard/_actions/workbench-badge";

/** Tiny counter pill next to the Workbench nav entry. Polls every 30s
 *  so the sidebar reflects fresh queue pressure without subscribing to
 *  realtime (saves a connection on the dashboard side). */
export function WorkbenchBadge({ initial }: { initial: number }) {
  const [count, setCount] = useState(initial);

  useEffect(() => {
    let cancelled = false;
    async function fetchOnce() {
      try {
        const res = await getWorkbenchBadgeCount();
        if (!cancelled) setCount(res.count);
      } catch {
        /* swallow — sidebar badge is best-effort */
      }
    }
    void fetchOnce();
    const id = setInterval(fetchOnce, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (count === 0) return null;
  return (
    <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-ink text-white px-1.5 text-[11px] font-medium">
      {count > 99 ? "99+" : count}
    </span>
  );
}
