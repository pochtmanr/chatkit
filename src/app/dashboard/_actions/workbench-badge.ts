"use server";

import { getServerClient, getServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

const BIZ_COOKIE = "chatkit_active_biz";
const OPEN_STATUSES = ["new", "active", "waiting_customer", "waiting_support"];
const QUEUEABLE_STATUSES = ["new", "active", "waiting_support"];

/** Sidebar badge for the "Workbench" entry: counts conversations
 *  assigned to me PLUS unassigned-and-queueable in the active business
 *  — the work that's mine or that I might pick up. Polled every 30s
 *  from a tiny client component (NavMenu). */
export async function getWorkbenchBadgeCount(): Promise<{ count: number }> {
  const sb = await getServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { count: 0 };

  const store = await cookies();
  const businessId = store.get(BIZ_COOKIE)?.value;
  if (!businessId) return { count: 0 };

  const admin = getServiceClient();
  const { data: inboxes } = await admin
    .from("inboxes")
    .select("id")
    .eq("business_id", businessId)
    .is("archived_at", null);
  const inboxIds = (inboxes ?? []).map((r) => r.id);
  if (inboxIds.length === 0) return { count: 0 };

  const [mine, unassigned] = await Promise.all([
    admin
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", businessId)
      .in("inbox_id", inboxIds)
      .in("status", OPEN_STATUSES)
      .eq("assigned_to", user.id),
    admin
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", businessId)
      .in("inbox_id", inboxIds)
      .in("status", QUEUEABLE_STATUSES)
      .is("assigned_to", null),
  ]);

  return { count: (mine.count ?? 0) + (unassigned.count ?? 0) };
}
