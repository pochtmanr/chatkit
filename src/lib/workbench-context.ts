import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerClient, getServiceClient } from "@/lib/supabase/server";
import type { Business } from "@/lib/businesses";
import type { Inbox } from "@/lib/inboxes";

const BIZ_COOKIE = "chatkit_active_biz";

const BUSINESS_COLUMNS =
  "id, name, slug, plan, status, industry, company_size, onboarding_completed_at, logo_url, address_line1, address_line2, city, region, postal_code, country, contact_email, contact_phone, website_url, about, allowed_origins";

export type WorkbenchRole = "owner" | "manager" | "agent";

export type WorkbenchContext = {
  user: { id: string; email: string };
  /** Businesses the user can act in — owner OR accepted agent. */
  businesses: Business[];
  business: Business;
  role: WorkbenchRole;
  /** True when the caller has a support_agents row for the active
   *  business. Agent-row presence drives whether the Workbench shows
   *  the personal status toggle. */
  hasAgentRow: boolean;
  agentId: string | null;
  inboxes: Inbox[];
};

/**
 * Resolves the active workbench context.
 *
 * Unlike `getActiveContext` (dashboard-only — owner businesses), this
 * returns the union of owned businesses and businesses the user agents
 * for, so a non-owner agent can pick the right business from the
 * top-bar switcher. Uses the service client because the inboxes table's
 * RLS is owner-only and the workbench surfaces them to agents too.
 */
export async function getWorkbenchContext(): Promise<WorkbenchContext | null> {
  const sb = await getServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  const admin = getServiceClient();

  const [{ data: owned }, { data: agentRows }] = await Promise.all([
    admin
      .from("businesses")
      .select(BUSINESS_COLUMNS)
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: true }),
    admin
      .from("support_agents")
      .select("id, business_id, role")
      .eq("user_id", user.id)
      .is("archived_at", null)
      .not("accepted_at", "is", null),
  ]);

  const ownedBusinesses = (owned ?? []) as Business[];
  const ownedIds = new Set(ownedBusinesses.map((b) => b.id));
  const agentBusinessIds = (agentRows ?? [])
    .map((r) => r.business_id)
    .filter((id) => !ownedIds.has(id));

  const { data: agentBusinesses } = agentBusinessIds.length
    ? await admin
        .from("businesses")
        .select(BUSINESS_COLUMNS)
        .in("id", agentBusinessIds)
        .order("created_at", { ascending: true })
    : { data: [] };

  const businesses = [
    ...ownedBusinesses,
    ...((agentBusinesses ?? []) as Business[]),
  ];
  if (businesses.length === 0) return null;

  const cookieStore = await cookies();
  const bizCookie = cookieStore.get(BIZ_COOKIE)?.value;
  const business =
    businesses.find((b) => b.id === bizCookie) ?? businesses[0];

  let role: WorkbenchRole;
  if (ownedIds.has(business.id)) {
    role = "owner";
  } else {
    const row = (agentRows ?? []).find((r) => r.business_id === business.id);
    role = row?.role === "manager" ? "manager" : "agent";
  }

  // Agent row for the *active* business — owners may also have an agent
  // row (rare, but the toggle should appear when they do).
  const matchingAgent = (agentRows ?? []).find(
    (r) => r.business_id === business.id,
  );
  const hasAgentRow = !!matchingAgent;
  const agentId = matchingAgent?.id ?? null;

  const { data: inboxes } = await admin
    .from("inboxes")
    .select(
      "id, project_id, business_id, name, slug, purpose, audience, api_key, webhook_url, archived_at",
    )
    .eq("business_id", business.id)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  return {
    user: { id: user.id, email: user.email ?? "" },
    businesses,
    business,
    role,
    hasAgentRow,
    agentId,
    inboxes: (inboxes ?? []) as Inbox[],
  };
}

export async function requireWorkbenchContext(): Promise<WorkbenchContext> {
  const ctx = await getWorkbenchContext();
  if (!ctx) redirect("/login");
  return ctx;
}
