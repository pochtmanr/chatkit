/**
 * Embed authentication.
 *
 * Strategy: tenant API key + per-business Origin/Referer allowlist.
 *
 *   1. The iframe URL carries `?key=<inbox api key>`.
 *   2. We look up the inbox by api_key and join its parent business.
 *   3. We check the request's Origin (or Referer if Origin is absent —
 *      browsers don't always send Origin on GET) against that
 *      business's `allowed_origins` column. Each business edits its
 *      own list at /dashboard/settings/business; there is no env
 *      override anymore.
 *
 * Migration history:
 *   - 0013 moved api_key off `businesses` onto `inboxes`.
 *   - 0020 added `businesses.allowed_origins text[]` — the per-tenant
 *     allowlist this module reads from. Before 0020 we relied on the
 *     process-wide EMBED_ALLOWED_ORIGINS env var (now removed).
 *
 * Why not JWT: we already have a per-tenant secret (the inbox API key)
 * and the embedding host gates page access on its own side. The
 * Origin check adds defense-in-depth: even if the key leaks, it
 * can't be replayed from a different origin without compromising
 * the allowed origin first.
 */

import { headers } from "next/headers";
import { getServiceClient } from "@/lib/supabase/server";

export interface EmbedSession {
  tenantId: string;
  tenantName: string;
  /** Inbox the embed key belongs to. Callers writing `conversations`
   *  rows pass this as `inbox_id` (NOT NULL since 0013). */
  inboxId: string;
}

class EmbedAuthError extends Error {
  constructor(public reason: string) {
    super(`embed auth failed: ${reason}`);
    this.name = "EmbedAuthError";
  }
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

/** chat-admin's own deployed URL, derived from the proxy headers. Used
 *  to detect same-origin internal navigation (e.g. when a Link inside
 *  /embed/widget navigates to /embed/inbox/<id> — the Origin/Referer
 *  on that request reflects chat-admin itself, not the embedding host,
 *  so the allowlist check would otherwise reject it). */
async function selfOrigin(): Promise<string | null> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return host ? `${proto}://${host}` : null;
}

/** Look up an inbox + its business by API key. Returns the bare row
 *  callers need; throws EmbedAuthError if the key is unknown or the
 *  business is suspended. */
async function lookupInbox(key: string): Promise<{
  inboxId: string;
  businessId: string;
  businessName: string;
  businessStatus: string;
  allowedOrigins: string[];
}> {
  const service = getServiceClient();
  const { data, error } = await service
    .from("inboxes")
    .select(`
      id,
      business:businesses (id, name, status, allowed_origins)
    `)
    .eq("api_key", key)
    .maybeSingle();
  if (error || !data || !data.business) throw new EmbedAuthError("invalid key");
  const b = Array.isArray(data.business) ? data.business[0] : data.business;
  return {
    inboxId: data.id,
    businessId: b.id,
    businessName: b.name,
    businessStatus: b.status,
    allowedOrigins: Array.isArray(b.allowed_origins) ? b.allowed_origins : [],
  };
}

export async function verifyEmbedKey(key: string | undefined | null): Promise<EmbedSession> {
  if (!key) throw new EmbedAuthError("missing key");
  if (!key.startsWith("pk_live_") && !key.startsWith("pk_test_")) {
    throw new EmbedAuthError("invalid key format");
  }

  // Resolve the key first so we know which business's allowlist to
  // consult. (Pre-0020 we checked the env list before the DB; with
  // a per-business list we have to hit the DB anyway, and doing it
  // up front keeps the code linear.)
  const inbox = await lookupInbox(key);
  if (inbox.businessStatus !== "active") {
    throw new EmbedAuthError(`tenant ${inbox.businessStatus}`);
  }

  const origin = await requestOrigin();
  const self = await selfOrigin();
  const isDev = process.env.NODE_ENV !== "production";
  if (!origin && !isDev) throw new EmbedAuthError("missing origin/referer");
  // Same-origin requests (chat-admin → chat-admin internal navigation
  // inside the iframe, e.g. clicking a conversation in the widget)
  // always pass. The host-side iframe is what's gated by the allowlist.
  if (origin && self && origin === self) {
    // ok — internal link
  } else if (origin && !inbox.allowedOrigins.includes(origin)) {
    throw new EmbedAuthError(`origin not allowed: ${origin}`);
  }

  return {
    tenantId: inbox.businessId,
    tenantName: inbox.businessName,
    inboxId: inbox.inboxId,
  };
}

/** Frame-ancestors list for the CSP header on /embed/* responses.
 *  Looks up the business by inbox API key; returns ["'self'"] alone
 *  if the key is unknown so the browser blocks unknown embeds. */
export async function frameAncestorsForKey(
  key: string | undefined | null,
): Promise<string[]> {
  if (!key || (!key.startsWith("pk_live_") && !key.startsWith("pk_test_"))) {
    return ["'self'"];
  }
  try {
    const inbox = await lookupInbox(key);
    if (inbox.businessStatus !== "active") return ["'self'"];
    return ["'self'", ...inbox.allowedOrigins];
  } catch {
    return ["'self'"];
  }
}
