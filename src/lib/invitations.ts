import "server-only";
import { createHash } from "node:crypto";
import { getServiceClient } from "@/lib/supabase/server";

export const INVITE_TOKEN_PREFIX = "inv_";

/** sha256 hex of the raw invite token. Tokens are never persisted in
 *  cleartext — we only store the hash. */
export function hashInviteToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export type InvitationRecord = {
  id: string;
  business_id: string;
  email: string;
  display_name: string;
  role: "agent" | "manager";
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  invited_by: string;
};

export async function getInvitationByToken(
  rawToken: string,
): Promise<InvitationRecord | null> {
  if (!rawToken.startsWith(INVITE_TOKEN_PREFIX)) return null;
  const hash = hashInviteToken(rawToken);

  const admin = getServiceClient();
  const { data } = await admin
    .from("invitations")
    .select(
      "id, business_id, email, display_name, role, expires_at, accepted_at, revoked_at, invited_by, token_hash",
    )
    .eq("token_hash", hash)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    business_id: data.business_id,
    email: data.email,
    display_name: data.display_name,
    role: data.role === "manager" ? "manager" : "agent",
    expires_at: data.expires_at,
    accepted_at: data.accepted_at,
    revoked_at: data.revoked_at,
    invited_by: data.invited_by,
  };
}
