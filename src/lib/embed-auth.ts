/**
 * Embed authentication.
 *
 * Strategy: tenant API key + Referer/Origin check.
 *
 *   1. The iframe URL carries `?key=<tenant api key>`.
 *   2. We look up the tenant by that key (same lookup as authTenant on
 *      the /api/v1/* surface).
 *   3. We check the request's Origin (or Referer if Origin is absent —
 *      browsers don't always send Origin on GET) against the allowed
 *      origins list, so a leaked key can only be used from a known
 *      host. Default allowlist comes from EMBED_ALLOWED_ORIGINS env
 *      var (same one that drives CSP frame-ancestors in next.config).
 *
 * Why not JWT: we already have a per-tenant secret (the API key) and
 * the host (e.g. GoDelivery admin) gates page access on its own side.
 * The Referer check adds defense-in-depth: even if the key leaks, it
 * can't be replayed from a different origin without compromising the
 * allowed origin first.
 *
 * Trade-off: every agent's replies show as a single tenant-level
 * sender (we don't carry per-admin identity through). If that
 * matters later we can move to JWT or add a sub-claim parameter
 * without ripping out the API-key path.
 */

import { headers } from "next/headers";
import { getServiceClient } from "@/lib/supabase/server";

export interface EmbedSession {
  tenantId: string;
  tenantName: string;
}

class EmbedAuthError extends Error {
  constructor(public reason: string) {
    super(`embed auth failed: ${reason}`);
    this.name = "EmbedAuthError";
  }
}

/** Allowed iframe origins. Mirrors the CSP frame-ancestors list. */
function allowedOrigins(): string[] {
  const envList = process.env.EMBED_ALLOWED_ORIGINS;
  const fromEnv = envList
    ? envList.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  return Array.from(
    new Set([
      "https://www.isrshipping.com",
      "https://isrshipping.com",
      ...fromEnv,
    ]),
  );
}

/** Pull the request origin from the headers. Prefers Origin (always
 *  sent on cross-origin requests) then falls back to parsing Referer
 *  (sent on top-level iframe loads). */
async function requestOrigin(): Promise<string | null> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const referer = h.get("referer");
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export async function verifyEmbedKey(key: string | undefined | null): Promise<EmbedSession> {
  if (!key) throw new EmbedAuthError("missing key");
  if (!key.startsWith("pk_live_") && !key.startsWith("pk_test_")) {
    throw new EmbedAuthError("invalid key format");
  }

  // Domain check first — cheaper than the DB lookup, and we don't
  // want to leak whether a key is valid to a caller from the wrong
  // origin.
  const origin = await requestOrigin();
  const allowed = allowedOrigins();
  // Localhost/dev mode is permitted when no origin restrictions match
  // and we're explicitly in dev. Prevents the "I'm testing locally and
  // nothing works" pit-trap.
  const isDev = process.env.NODE_ENV !== "production";
  if (!origin && !isDev) throw new EmbedAuthError("missing origin/referer");
  if (origin && !allowed.includes(origin)) {
    throw new EmbedAuthError(`origin not allowed: ${origin}`);
  }

  const service = getServiceClient();
  const { data, error } = await service
    .from("tenants")
    .select("id, name, status, api_key")
    .eq("api_key", key)
    .maybeSingle();
  if (error || !data) throw new EmbedAuthError("invalid key");
  if (data.status !== "active") throw new EmbedAuthError(`tenant ${data.status}`);

  return { tenantId: data.id, tenantName: data.name };
}
