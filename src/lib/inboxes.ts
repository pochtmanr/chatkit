import { getServerClient } from "@/lib/supabase/server";

export type Inbox = {
  id: string;
  project_id: string;
  business_id: string;
  name: string;
  slug: string;
  purpose: string;
  audience: string;
  api_key: string;
  webhook_url: string | null;
  archived_at: string | null;
};

export async function listInboxesForBusiness(businessId: string): Promise<Inbox[]> {
  const sb = await getServerClient();
  const { data } = await sb
    .from("inboxes")
    .select(
      "id, project_id, business_id, name, slug, purpose, audience, api_key, webhook_url, archived_at",
    )
    .eq("business_id", businessId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });
  return data ?? [];
}
