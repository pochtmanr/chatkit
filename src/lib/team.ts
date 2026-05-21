import "server-only";
import { getServerClient, getServiceClient } from "@/lib/supabase/server";

export type TeamRole = "owner" | "admin" | "agent";

export type RoleGuardResult =
  | { ok: true; userId: string; role: TeamRole }
  | { ok: false; error: string };

const ROLE_RANK: Record<TeamRole, number> = {
  agent: 1,
  admin: 2,
  owner: 3,
};

/**
 * Resolves the caller's role for `businessId` and enforces a minimum.
 *
 * Until round-3 prompt 8 introduces `business_members`, only the
 * business's `owner_user_id` has access — anyone else gets a forbidden
 * result. Treat that single membership as `owner` so callers requiring
 * `admin` or `agent` still pass.
 */
export async function requireRole(
  businessId: string,
  minRole: TeamRole,
): Promise<RoleGuardResult> {
  const sb = await getServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "not signed in" };

  const admin = getServiceClient();
  const { data: biz } = await admin
    .from("businesses")
    .select("id, owner_user_id")
    .eq("id", businessId)
    .maybeSingle();
  if (!biz) return { ok: false, error: "business not found" };
  if (biz.owner_user_id !== user.id) return { ok: false, error: "forbidden" };

  const role: TeamRole = "owner";
  if (ROLE_RANK[role] < ROLE_RANK[minRole]) {
    return { ok: false, error: "forbidden" };
  }
  return { ok: true, userId: user.id, role };
}

export async function getRoleForBusiness(
  businessId: string,
): Promise<TeamRole | null> {
  const sb = await getServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  const admin = getServiceClient();
  const { data: biz } = await admin
    .from("businesses")
    .select("owner_user_id")
    .eq("id", businessId)
    .maybeSingle();
  if (!biz) return null;
  return biz.owner_user_id === user.id ? "owner" : null;
}
