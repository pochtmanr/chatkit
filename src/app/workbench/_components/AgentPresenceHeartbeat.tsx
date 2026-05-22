"use client";

import { useEffect } from "react";
import { setStatus, tick, type AgentStatus } from "../_actions/presence";

const TICK_INTERVAL_MS = 60_000;
const AWAY_AFTER_HIDDEN_MS = 5 * 60_000;

/** Mounted once per Workbench layout (only when the caller has an agent
 *  row). Keeps the agent's status_changed_at fresh while online so the
 *  staleness sweep doesn't close their session, and optimistically flips
 *  the visible state to "away" after the tab has been hidden for >5 min.
 *
 *  Decoupled from the Agent Hub popover so the heartbeat keeps running
 *  whether or not the popover is open. */
export function AgentPresenceHeartbeat({
  initialStatus,
}: {
  initialStatus: AgentStatus;
}) {
  useEffect(() => {
    if (initialStatus !== "online") return;
    const id = setInterval(() => {
      void tick();
    }, TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [initialStatus]);

  useEffect(() => {
    let hiddenSince: number | null = null;
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        hiddenSince = Date.now();
      } else if (hiddenSince !== null) {
        const dur = Date.now() - hiddenSince;
        hiddenSince = null;
        if (dur > AWAY_AFTER_HIDDEN_MS && initialStatus === "online") {
          // Write through to the server so the open session also closes.
          void setStatus("away");
        }
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [initialStatus]);

  return null;
}
