import "server-only";
import { getServiceClient } from "@/lib/supabase/server";

/**
 * Decides where to send a user immediately after sign-in.
 *
 * - Owner of ≥ 1 business → /dashboard (unchanged).
 * - Agent of ≥ 1 business AND not an owner of any → /workbench.
 * - Both → /dashboard (owner default; user can flip via the topbar entry).
 * - Neither (brand new account) → /dashboard (onboarding wizard takes over).
 */
export async function resolvePostLoginPath(userId: string): Promise<string> {
  const admin = getServiceClient();
  const [{ count: ownedCount }, { count: agentCount }] = await Promise.all([
    admin
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .eq("owner_user_id", userId),
    admin
      .from("support_agents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("archived_at", null)
      .not("accepted_at", "is", null),
  ]);

  if ((ownedCount ?? 0) > 0) return "/dashboard";
  if ((agentCount ?? 0) > 0) return "/workbench";
  return "/dashboard";
}
