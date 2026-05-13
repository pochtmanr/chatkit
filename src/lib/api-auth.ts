/**
 * API-key authentication for the public REST surface (/api/v1/*).
 *
 * The chat SDK identifies itself with the tenant's `pk_live_…` key in
 * the `x-tinychat-api-key` header. We resolve the key to a tenant row
 * via the service client (bypassing RLS, since the SDK isn't a logged-
 * in Supabase user) and pass the tenant down to the route handler.
 */

import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";

export interface AuthedTenant {
  id: string;
  name: string;
  api_key: string;
  status: "active" | "overage" | "suspended";
}

/** Parse + validate the api_key header. Returns either a tenant row
 *  or a NextResponse that the caller should return immediately. */
export async function authTenant(
  request: Request,
): Promise<{ tenant: AuthedTenant } | { error: NextResponse }> {
  const apiKey = request.headers.get("x-tinychat-api-key");
  if (!apiKey) {
    return {
      error: NextResponse.json(
        { error: "missing x-tinychat-api-key header" },
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
    .from("tenants")
    .select("id, name, api_key, status")
    .eq("api_key", apiKey)
    .maybeSingle();
  if (error || !data) {
    return {
      error: NextResponse.json({ error: "invalid api key" }, { status: 401 }),
    };
  }
  if (data.status !== "active") {
    return {
      error: NextResponse.json(
        { error: `tenant is ${data.status}` },
        { status: 403 },
      ),
    };
  }
  return { tenant: data as AuthedTenant };
}

/** CORS headers for SDK origins — the RN app calls from a webview-like
 *  fetch context with no Origin header, but a web SDK would. Keep it
 *  permissive for now; tighten when we have a per-tenant allowlist. */
export const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type, x-tinychat-api-key",
  "access-control-max-age": "86400",
} as const;
