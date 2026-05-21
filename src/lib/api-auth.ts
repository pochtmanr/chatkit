/**
 * API-key authentication for the public REST surface (/api/v1/*).
 *
 * The chat SDK identifies itself with the inbox's `pk_live_…` key in
 * the `x-chatkit-api-key` header (legacy `x-tinychat-api-key` still
 * accepted for the pre-rebrand SDK). We resolve the key to an inbox
 * row via the service client (bypassing RLS, since the SDK isn't a
 * logged-in Supabase user), then hand both the inbox and the parent
 * business down to the route handler.
 *
 * `tenant.id` on the returned context is the BUSINESS id — every
 * dependent table still has a `tenant_id` column that FKs into the
 * renamed `businesses` table, so existing route handlers continue to
 * work without changes. The new `inbox` field is what callers reach
 * for when they need per-inbox routing of replies/webhooks.
 */

import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";

export interface AuthedTenant {
  // Field name kept as `tenant` for backward compat with existing
  // route handlers that do `tenant.id` and pass it to tenant_id
  // columns. The id IS the business id.
  id: string;
  name: string;
  api_key: string;
  status: "active" | "overage" | "suspended";
}

export interface AuthedInbox {
  id: string;
  name: string;
  api_key: string;
  webhook_url: string | null;
}

export interface AuthedContext {
  tenant: AuthedTenant;
  inbox: AuthedInbox;
}

/** Parse + validate the api_key header. Returns either an inbox/business
 *  pair or a NextResponse that the caller should return immediately. */
export async function authTenant(
  request: Request,
): Promise<AuthedContext | { error: NextResponse }> {
  const apiKey =
    request.headers.get("x-chatkit-api-key") ??
    request.headers.get("x-tinychat-api-key");
  if (!apiKey) {
    return {
      error: NextResponse.json(
        { error: "missing x-chatkit-api-key header" },
        { status: 401 },
      ),
    };
  }
  if (!apiKey.startsWith("pk_live_") && !apiKey.startsWith("pk_test_")) {
    // Reject malformed keys before hitting the database. Anyone scanning
    // the endpoint with random strings will burn DB connections otherwise.
    return {
      error: NextResponse.json({ error: "invalid api key format" }, { status: 401 }),
    };
  }

  const service = getServiceClient();
  const { data, error } = await service
    .from("inboxes")
    .select(`
      id, name, api_key, webhook_url,
      business:businesses (id, name, status)
    `)
    .eq("api_key", apiKey)
    .maybeSingle();
  if (error || !data || !data.business) {
    return {
      error: NextResponse.json({ error: "invalid api key" }, { status: 401 }),
    };
  }
  const business = Array.isArray(data.business) ? data.business[0] : data.business;
  if (business.status !== "active") {
    return {
      error: NextResponse.json(
        { error: `tenant is ${business.status}` },
        { status: 403 },
      ),
    };
  }
  return {
    tenant: {
      id: business.id,
      name: business.name,
      api_key: data.api_key,
      status: business.status as "active",
    },
    inbox: {
      id: data.id,
      name: data.name,
      api_key: data.api_key,
      webhook_url: data.webhook_url,
    },
  };
}

/** CORS headers for SDK origins — the RN app calls from a webview-like
 *  fetch context with no Origin header, but a web SDK would. Keep it
 *  permissive for now; tighten when we have a per-inbox allowlist. */
export const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "access-control-allow-headers":
    "content-type, x-chatkit-api-key, x-tinychat-api-key",
  "access-control-max-age": "86400",
} as const;
