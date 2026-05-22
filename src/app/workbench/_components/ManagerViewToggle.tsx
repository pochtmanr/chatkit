"use client";

import { useEffect, useState, useTransition } from "react";
import { Eye } from "lucide-react";
import { setManagerView } from "../_actions/manager-view";

const LOCAL_KEY = "workbench:manager";

/** Owner-only pill toggle. The server cookie drives SSR; localStorage
 *  is mirrored so the toggle keeps its on/off label across hard refreshes
 *  on slow connections (the cookie also covers that). */
export function ManagerViewToggle({ initial }: { initial: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LOCAL_KEY, enabled ? "1" : "0");
  }, [enabled]);

  function flip(next: boolean) {
    setEnabled(next);
    startTransition(async () => {
      await setManagerView(next);
    });
  }

  return (
    <button
      type="button"
      aria-pressed={enabled}
      onClick={() => flip(!enabled)}
      className={
        (enabled
          ? "bg-ink text-white border-ink hover:bg-deep"
          : "bg-white text-deep border-mist hover:bg-mist/60 hover:text-ink") +
        " inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-colors"
      }
    >
      <Eye className="h-3.5 w-3.5" />
      Manager view
    </button>
  );
}
