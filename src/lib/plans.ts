import { getServerClient, getServiceClient } from "@/lib/supabase/server";

export type Plan = {
  id: "free" | "starter" | "growth" | "scale" | string;
  name: string;
  monthly_price_cents: number;
  currency: string;
  max_businesses: number;
  max_inboxes_per_business: number;
  max_conversations_per_month: number;
  features: Record<string, unknown>;
  is_public: boolean;
  sort_order: number;
};

export async function listPlans(): Promise<Plan[]> {
  // Plans are global catalog data — bypass RLS so the call doesn't depend
  // on session state.
  const admin = getServiceClient();
  const { data } = await admin
    .from("plans")
    .select("*")
    .order("sort_order", { ascending: true });
  return (data ?? []) as Plan[];
}

export async function getCurrentPlanForBusiness(
  businessId: string,
): Promise<Plan | null> {
  const sb = await getServerClient();
  const { data: biz } = await sb
    .from("businesses")
    .select("current_plan_id")
    .eq("id", businessId)
    .maybeSingle();
  if (!biz) return null;

  const admin = getServiceClient();
  const { data: plan } = await admin
    .from("plans")
    .select("*")
    .eq("id", biz.current_plan_id)
    .maybeSingle();
  return (plan ?? null) as Plan | null;
}
