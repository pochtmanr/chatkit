import { getServerClient } from "@/lib/supabase/server";

export type Business = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  industry: string | null;
  company_size: string | null;
  onboarding_completed_at: string | null;
  // Round 3, prompt 2 — business profile.
  logo_url: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website_url: string | null;
  about: string | null;
};

const BUSINESS_COLUMNS =
  "id, name, slug, plan, status, industry, company_size, onboarding_completed_at, logo_url, address_line1, address_line2, city, region, postal_code, country, contact_email, contact_phone, website_url, about";

/** Returns the user's businesses ordered by created_at asc. RLS scopes
 *  the result to those they own. The 2-business cap means the array
 *  is at most length 2. */
export async function listMyBusinesses(): Promise<Business[]> {
  const sb = await getServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return [];
  const { data } = await sb
    .from("businesses")
    .select(BUSINESS_COLUMNS)
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true });
  return (data ?? []) as Business[];
}

export async function getPrimaryBusiness(): Promise<Business | null> {
  const businesses = await listMyBusinesses();
  return businesses[0] ?? null;
}

/** True iff the user has at least one business with onboarding_completed_at set. */
export async function isOnboarded(): Promise<boolean> {
  const businesses = await listMyBusinesses();
  return businesses.some((b) => b.onboarding_completed_at !== null);
}
