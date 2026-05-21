import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { listMyBusinesses, type Business } from "@/lib/businesses";
import { listInboxesForBusiness, type Inbox } from "@/lib/inboxes";

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

  const businesses = await listMyBusinesses();
  if (businesses.length === 0) return null;

  const cookieStore = await cookies();
  const bizCookie = cookieStore.get(BIZ_COOKIE)?.value;
  const business = businesses.find((b) => b.id === bizCookie) ?? businesses[0];

  const inboxes = await listInboxesForBusiness(business.id);
  if (inboxes.length === 0) return null;

  const inboxCookie = cookieStore.get(INBOX_COOKIE)?.value;
  const inbox = inboxes.find((i) => i.id === inboxCookie) ?? inboxes[0];

  const { data: projects } = await sb
    .from("projects")
    .select("id, name, slug")
    .eq("business_id", business.id)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

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
