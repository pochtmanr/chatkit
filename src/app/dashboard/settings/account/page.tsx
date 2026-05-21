import { requireActiveContext } from "@/lib/active-context";
import { getServiceClient } from "@/lib/supabase/server";
import { getRoleForBusiness } from "@/lib/team";
import { AccountSection } from "@/app/dashboard/_components/settings/AccountSection";

type DeletionRow = {
  id: string;
  kind: "business_data" | "account";
  business_id: string | null;
  scheduled_at: string;
  requested_at: string;
  cancelled_at: string | null;
  executed_at: string | null;
};

type ExportRow = {
  id: string;
  business_id: string;
  status: "queued" | "ready" | "failed" | "expired";
  download_url: string | null;
  ready_at: string | null;
  expires_at: string | null;
  error: string | null;
  created_at: string;
};

export default async function SettingsAccountPage() {
  const ctx = await requireActiveContext();
  const role = await getRoleForBusiness(ctx.business.id);

  const admin = getServiceClient();
  const { data: deletionRequests } = await admin
    .from("deletion_requests")
    .select(
      "id, kind, business_id, scheduled_at, requested_at, cancelled_at, executed_at",
    )
    .eq("user_id", ctx.user.id)
    .order("requested_at", { ascending: false });

  const { data: exportRequests } = await admin
    .from("data_export_requests")
    .select(
      "id, business_id, status, download_url, ready_at, expires_at, error, created_at",
    )
    .eq("user_id", ctx.user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <AccountSection
      businessId={ctx.business.id}
      businessName={ctx.business.name}
      myRole={role ?? "agent"}
      deletionRequests={(deletionRequests ?? []) as DeletionRow[]}
      exportRequests={(exportRequests ?? []) as ExportRow[]}
    />
  );
}
