"use client";

import { useEffect, useState } from "react";
import type { OwnTimeline } from "../_actions/sessions";

type Props = {
  timeline: OwnTimeline | null;
};

/** 24h horizontal strip with one green band per online session. The
 *  in-progress session (ended_at = null) extends to the live clock,
 *  which we refresh every 30s so the strip grows visibly while the
 *  popover is open. */
export function AgentTimelineStrip({ timeline }: Props) {
  // Live clock kept in state so the render stays pure for the React
  // Compiler's purity rule. Seeded from the server's `nowIso` on first
  // paint; the interval below drifts it forward.
  const [liveNow, setLiveNow] = useState<number>(() =>
    timeline ? Date.parse(timeline.nowIso) : Date.parse(new Date().toISOString()),
  );
  useEffect(() => {
    const id = setInterval(() => setLiveNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!timeline) {
    return (
      <div className="h-6 w-full rounded-md bg-mist/40 animate-pulse" />
    );
  }

  const start = Date.parse(timeline.fromIso);
  const end = Date.parse(timeline.toIso);
  const span = end - start;

  return (
    <div className="space-y-1.5">
      <div className="relative h-6 w-full rounded-md bg-mist/40 overflow-hidden">
        {timeline.sessions.map((s) => {
          const segStart = Math.max(Date.parse(s.started_at), start);
          const segEnd = Math.min(
            s.ended_at ? Date.parse(s.ended_at) : liveNow,
            end,
          );
          if (segEnd <= segStart) return null;
          const left = ((segStart - start) / span) * 100;
          const width = ((segEnd - segStart) / span) * 100;
          const isOpen = !s.ended_at;
          return (
            <div
              key={s.id}
              className={`absolute top-0 bottom-0 ${
                isOpen ? "bg-emerald-500" : "bg-emerald-400/80"
              }`}
              style={{ left: `${left}%`, width: `${width}%` }}
              title={
                isOpen
                  ? `Online since ${formatTime(s.started_at)}`
                  : `${formatTime(s.started_at)} – ${formatTime(s.ended_at!)}`
              }
            />
          );
        })}
        {/* Now-marker. */}
        <div
          aria-hidden
          className="absolute top-0 bottom-0 w-px bg-ink/40"
          style={{ left: `${((liveNow - start) / span) * 100}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-deep/50">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>24:00</span>
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
