"use server";

import {
  listOwnSessionsForRange,
  totalOnlineSeconds,
  type SessionRow,
} from "@/lib/agent-sessions";
import { requireWorkbenchContext } from "@/lib/workbench-context";

export type OwnTimeline = {
  /** Window the timeline covers, inclusive-exclusive. */
  fromIso: string;
  toIso: string;
  /** Sessions overlapping the window. Currently-open session keeps
   *  `ended_at = null` and the renderer extends it to `now`. */
  sessions: SessionRow[];
  /** Seconds the agent was online inside the window. */
  totalOnlineSeconds: number;
  /** ISO of `now` at fetch time — passed through so client-side rendering
   *  is deterministic with the server. */
  nowIso: string;
};

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfTodayIso(): string {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d.toISOString();
}

/** Returns the caller's own session timeline for *today* (local time on
 *  the server). Returns an empty timeline if the caller has no
 *  support_agents row in the active business (typical for admins who
 *  haven't invited themselves). */
export async function getOwnTimeline(): Promise<OwnTimeline> {
  const ctx = await requireWorkbenchContext();
  const fromIso = startOfTodayIso();
  const toIso = endOfTodayIso();
  const nowIso = new Date().toISOString();

  if (!ctx.agentId) {
    return { fromIso, toIso, sessions: [], totalOnlineSeconds: 0, nowIso };
  }

  const sessions = await listOwnSessionsForRange({
    supportAgentId: ctx.agentId,
    fromIso,
    toIso,
  });

  return {
    fromIso,
    toIso,
    sessions,
    totalOnlineSeconds: totalOnlineSeconds(sessions, fromIso, toIso, nowIso),
    nowIso,
  };
}
