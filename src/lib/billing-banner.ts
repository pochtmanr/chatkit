import { getServerClient } from "@/lib/supabase/server";

export type OverageInfo = {
  businessName: string;
  planId: string;
  capConversations: number;
  monthCount: number;
};

export async function checkOverage(
  businessId: string,
): Promise<OverageInfo | null> {
  const sb = await getServerClient();
  const { data: biz } = await sb
    .from("businesses")
    .select("id, name, status, current_plan_id")
    .eq("id", businessId)
    .maybeSingle();
  if (!biz || biz.status !== "overage") return null;

  const { data: plan } = await sb
    .from("plans")
    .select("max_conversations_per_month")
    .eq("id", biz.current_plan_id)
    .maybeSingle();

  const firstOfMonth = new Date();
  firstOfMonth.setUTCDate(1);
  firstOfMonth.setUTCHours(0, 0, 0, 0);
  const { count } = await sb
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", businessId)
    .gte("created_at", firstOfMonth.toISOString());

  return {
    businessName: biz.name,
    planId: biz.current_plan_id,
    capConversations: plan?.max_conversations_per_month ?? 0,
    monthCount: count ?? 0,
  };
}
