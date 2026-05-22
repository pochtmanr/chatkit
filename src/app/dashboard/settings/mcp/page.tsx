import { requireActiveContext } from "@/lib/active-context";
import { getServiceClient } from "@/lib/supabase/server";
import { getRoleForBusiness } from "@/lib/team";
import { McpKeysSection } from "@/app/dashboard/_components/settings/McpKeysSection";

export default async function SettingsMcpPage() {
  const ctx = await requireActiveContext();
  const role = await getRoleForBusiness(ctx.business.id);

  const admin = getServiceClient();
  const { data: keys } = await admin
    .from("mcp_access_keys")
    .select("id, name, key_prefix, created_at, last_used_at, revoked_at")
    .eq("business_id", ctx.business.id)
    .order("created_at", { ascending: false });

  return (
    <McpKeysSection
      keys={(keys ?? []).map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.key_prefix,
        createdAt: k.created_at,
        lastUsedAt: k.last_used_at,
        revokedAt: k.revoked_at,
      }))}
      canManage={role === "owner" || role === "manager"}
    />
  );
}
