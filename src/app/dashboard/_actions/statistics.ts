"use server";

import { unstable_cache as nextCache } from "next/cache";
import { getServiceClient } from "@/lib/supabase/server";
import { requireActiveContext } from "@/lib/active-context";

export type StatsRange = "7d" | "30d" | "90d" | "all";

export type BusinessStats = {
  conversationsCreated: number;
  inboundMessages: number;
  outboundMessages: number;
  conversationsResolved: number;
  medianResolutionHours: number | null;
  averageFirstResponseMinutes: number | null;
  activeInboxes: number;
  perInbox: Array<{
    inboxId: string;
    inboxName: string;
    conversations: number;
    messages: number;
  }>;
};

export async function getBusinessStats(
  businessId: string,
  range: StatsRange,
): Promise<BusinessStats> {
  // Auth boundary stays outside the cache: cookies() can't be read inside
  // unstable_cache in Next 16. Validate the caller has access to this
  // businessId here, then the cached fetcher uses the service client.
  const ctx = await requireActiveContext();
  if (!ctx.businesses.some((b) => b.id === businessId)) {
    throw new Error("Forbidden");
  }

  const since = sinceFor(range);
  const fetcher = nextCache(
    async (bid: string, sinceIso: string | null) => {
      const sb = getServiceClient();
      return computeStats(sb, bid, sinceIso);
    },
    [`business-stats:${businessId}:${range}`],
    { revalidate: 300 },
  );
  return fetcher(businessId, since?.toISOString() ?? null);
}

function sinceFor(range: StatsRange): Date | null {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function computeStats(
  sb: ReturnType<typeof getServiceClient>,
  businessId: string,
  sinceIso: string | null,
): Promise<BusinessStats> {
  const sinceClause = sinceIso ?? "1970-01-01T00:00:00Z";

  const { count: conversationsCreated } = await sb
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", businessId)
    .gte("created_at", sinceClause);

  const { count: conversationsResolved } = await sb
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", businessId)
    .eq("status", "done")
    .gte("status_updated_at", sinceClause);

  // Messages — split by direction via sender_id heuristic. Mirrors the
  // rule in src/lib/tenant-webhook.ts: agent if sender_id === "agent"
  // or starts with "agent-"; otherwise inbound.
  const { data: messageRows } = await sb
    .from("messages")
    .select("sender_id")
    .eq("tenant_id", businessId)
    .gte("created_at", sinceClause);
  const totalMessages = messageRows ?? [];
  const outboundMessages = totalMessages.filter(
    (m) =>
      typeof m.sender_id === "string" &&
      (m.sender_id === "agent" || m.sender_id.startsWith("agent-")),
  ).length;
  const inboundMessages = totalMessages.length - outboundMessages;

  // Median resolution time — computed in JS over a recent slice. Fine for
  // v0.x volumes; move to a SQL view when a tenant grows past this.
  const { data: resolved } = await sb
    .from("conversations")
    .select("id, created_at, status_updated_at")
    .eq("tenant_id", businessId)
    .eq("status", "done")
    .gte("status_updated_at", sinceClause)
    .limit(500);
  const resolutionMs = (resolved ?? [])
    .map(
      (r) =>
        new Date(r.status_updated_at).getTime() -
        new Date(r.created_at).getTime(),
    )
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  const medianResolutionHours = resolutionMs.length
    ? Math.round(
        (resolutionMs[Math.floor(resolutionMs.length / 2)] / 1000 / 60 / 60) *
          10,
      ) / 10
    : null;

  // First-response average is deferred to a future round (needs first
  // inbound + first outbound per conversation). Surface null → "—".
  const averageFirstResponseMinutes: number | null = null;

  const { count: activeInboxes } = await sb
    .from("inboxes")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .is("archived_at", null);

  const { data: inboxes } = await sb
    .from("inboxes")
    .select("id, name")
    .eq("business_id", businessId)
    .is("archived_at", null)
    .order("name", { ascending: true });
  const perInbox: BusinessStats["perInbox"] = [];
  for (const ib of inboxes ?? []) {
    const [{ count: cConv }, { count: cMsg }] = await Promise.all([
      sb
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("inbox_id", ib.id)
        .gte("created_at", sinceClause),
      sb
        .from("messages")
        .select("id, conversations!inner(inbox_id)", {
          count: "exact",
          head: true,
        })
        .eq("conversations.inbox_id", ib.id)
        .gte("created_at", sinceClause),
    ]);
    perInbox.push({
      inboxId: ib.id,
      inboxName: ib.name,
      conversations: cConv ?? 0,
      messages: cMsg ?? 0,
    });
  }

  return {
    conversationsCreated: conversationsCreated ?? 0,
    inboundMessages,
    outboundMessages,
    conversationsResolved: conversationsResolved ?? 0,
    medianResolutionHours,
    averageFirstResponseMinutes,
    activeInboxes: activeInboxes ?? 0,
    perInbox,
  };
}
