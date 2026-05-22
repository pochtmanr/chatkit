import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerClient, getServiceClient } from "@/lib/supabase/server";
import { listMyBusinesses, type Business } from "@/lib/businesses";
import { listInboxesForBusiness, type Inbox } from "@/lib/inboxes";

const BUSINESS_COLUMNS =
  "id, name, slug, plan, status, industry, company_size, onboarding_completed_at, logo_url, address_line1, address_line2, city, region, postal_code, country, contact_email, contact_phone, website_url, about, allowed_origins";

const BIZ_COOKIE = "chatkit_active_biz";
const INBOX_COOKIE = "chatkit_active_inbox";

export type ProjectGroup = {
  project: { id: string; name: string; slug: string };
  inboxes: Inbox[];
};

export type ActiveContext = {
  user: { id: string; email: string };
  businesses: Business[];
  business: Business;
  inboxes: Inbox[];
  inbox: Inbox;
  groups: ProjectGroup[];
};

export async function getActiveContext(): Promise<ActiveContext | null> {
  const sb = await getServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  // Owners read businesses through their own RLS-scoped view; invited
  // members (managers / agents) don't satisfy that policy, so we look
  // them up via the service client. The result is the union, ordered by
  // creation date.
  let businesses = await listMyBusinesses();
  if (businesses.length === 0) {
    const admin = getServiceClient();
    const { data: agentRows } = await admin
      .from("support_agents")
      .select("business_id")
      .eq("user_id", user.id)
      .is("archived_at", null)
      .not("accepted_at", "is", null);
    const ids = (agentRows ?? []).map((r) => r.business_id);
    if (ids.length === 0) return null;
    const { data } = await admin
      .from("businesses")
      .select(BUSINESS_COLUMNS)
      .in("id", ids)
      .order("created_at", { ascending: true });
    businesses = (data ?? []) as Business[];
    if (businesses.length === 0) return null;
  }

  const cookieStore = await cookies();
  const bizCookie = cookieStore.get(BIZ_COOKIE)?.value;
  const business = businesses.find((b) => b.id === bizCookie) ?? businesses[0];

  // Inboxes RLS is owner-only; use the user-scoped client first (cheap
  // and authoritative for owners) and fall back to the service client
  // when the read comes back empty so invited members still see the
  // sidebar's inbox switcher.
  let inboxes = await listInboxesForBusiness(business.id);
  if (inboxes.length === 0) {
    const admin = getServiceClient();
    const { data } = await admin
      .from("inboxes")
      .select(
        "id, project_id, business_id, name, slug, purpose, audience, api_key, webhook_url, archived_at",
      )
      .eq("business_id", business.id)
      .is("archived_at", null)
      .order("created_at", { ascending: true });
    inboxes = (data ?? []) as Inbox[];
  }
  if (inboxes.length === 0) return null;

  const inboxCookie = cookieStore.get(INBOX_COOKIE)?.value;
  const inbox = inboxes.find((i) => i.id === inboxCookie) ?? inboxes[0];

  let { data: projects } = await sb
    .from("projects")
    .select("id, name, slug")
    .eq("business_id", business.id)
    .is("archived_at", null)
    .order("created_at", { ascending: true });
  if (!projects || projects.length === 0) {
    const admin = getServiceClient();
    const { data } = await admin
      .from("projects")
      .select("id, name, slug")
      .eq("business_id", business.id)
      .is("archived_at", null)
      .order("created_at", { ascending: true });
    projects = data ?? null;
  }

  const inboxesByProject = new Map<string, Inbox[]>();
  for (const ib of inboxes) {
    const list = inboxesByProject.get(ib.project_id) ?? [];
    list.push(ib);
    inboxesByProject.set(ib.project_id, list);
  }
  const groups: ProjectGroup[] = (projects ?? [])
    .map((p) => ({ project: p, inboxes: inboxesByProject.get(p.id) ?? [] }))
    .filter((g) => g.inboxes.length > 0);

  return {
    user: { id: user.id, email: user.email ?? "" },
    businesses,
    business,
    inboxes,
    inbox,
    groups,
  };
}

/** Convenience for pages that *must* have an active context. Redirects
 *  to /dashboard (where the empty-state modal renders) if context is
 *  unresolvable. */
export async function requireActiveContext(): Promise<ActiveContext> {
  const ctx = await getActiveContext();
  if (!ctx) redirect("/dashboard");
  return ctx;
}
