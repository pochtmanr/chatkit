import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { getServiceClient } from "@/lib/supabase/server";

const ROTATION_GRACE_MS = 24 * 60 * 60 * 1000;

/** `sk_live_<32 hex chars>` — 16 bytes of entropy = 128 bits, ample. */
export function generateServerSecret(): { raw: string; prefix: string } {
  const raw = `sk_live_${randomBytes(16).toString("hex")}`;
  return { raw, prefix: raw.slice(0, 12) };
}

/** SHA-256(base64) of the raw key. No salt: we hash for lookup, not for
 *  password storage, and 128 bits of input entropy makes dictionary
 *  attacks on the hash a non-starter. */
export function hashServerSecret(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("base64");
}

/** Resolve a raw sk_live_ to its inbox + business. Honors dual-key
 *  rotation: matches `server_secret_hash` or `server_secret_previous_hash`,
 *  but the previous hash only verifies within 24h of rotation. Returns
 *  null on no match or stale previous hash.
 *
 *  Service-role only. Never call from browser code. */
export async function lookupServerSecret(raw: string): Promise<{
  inboxId: string;
  businessId: string;
} | null> {
  if (!raw.startsWith("sk_live_")) return null;
  const hash = hashServerSecret(raw);

  const admin = getServiceClient();
  const { data, error } = await admin
    .from("inboxes")
    .select(
      "id, business_id, server_secret_hash, server_secret_previous_hash, server_secret_rotated_at",
    )
    .or(
      `server_secret_hash.eq.${hash},server_secret_previous_hash.eq.${hash}`,
    )
    .maybeSingle();
  if (error || !data) return null;

  if (data.server_secret_hash === hash) {
    return { inboxId: data.id, businessId: data.business_id };
  }

  // Previous hash matched — only valid inside the rotation grace window.
  const rotatedAt = data.server_secret_rotated_at
    ? Date.parse(data.server_secret_rotated_at)
    : 0;
  if (!rotatedAt || Date.now() - rotatedAt > ROTATION_GRACE_MS) {
    // Fire-and-forget: clear the stale previous hash so future lookups
    // return null fast. Errors here do not affect the caller.
    void admin
      .from("inboxes")
      .update({
        server_secret_previous_hash: null,
        server_secret_rotated_at: null,
      })
      .eq("id", data.id);
    return null;
  }
  return { inboxId: data.id, businessId: data.business_id };
}
