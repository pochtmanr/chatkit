import { NextResponse, type NextRequest } from "next/server";
import { authTenant, corsHeaders } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase/server";

/**
 * Upsert an end-user from the consumer's app. The SDK calls this once
 * per app session (or whenever user identity changes) so we have a
 * record to attach messages to and route HubSpot tickets against.
 *
 * Body shape:
 *   {
 *     user_id: string,            // opaque to us; the customer's id
 *     name?: string,
 *     email?: string,
 *     role?: 'customer'|'driver'|'admin'|'support',
 *     fcm_tokens?: string[],
 *     notification_prefs?: object,
 *   }
 *
 * Idempotent on (tenant_id, user_id). Returns the upserted row.
 */
export async function POST(request: NextRequest) {
  const auth = await authTenant(request);
  if ("error" in auth) return auth.error;
  const tenant = auth.tenant;

  let payload: {
    user_id?: string;
    name?: string;
    email?: string;
    role?: "customer" | "driver" | "admin" | "support";
    fcm_tokens?: string[];
    notification_prefs?: Record<string, unknown>;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400, headers: corsHeaders });
  }
  if (!payload.user_id) {
    return NextResponse.json(
      { error: "user_id is required" },
      { status: 400, headers: corsHeaders },
    );
  }

  const service = getServiceClient();

  // Normalize empty strings to null so an unauthenticated session
  // ("") never wipes a previously-good name from the row. We then
  // read the existing row and only carry over non-null fields from
  // the incoming payload, so a quiet anonymous upsert doesn't blank
  // out the display name we already had.
  const inName =
    typeof payload.name === "string" && payload.name.trim().length > 0
      ? payload.name.trim()
      : null;
  const inEmail =
    typeof payload.email === "string" && payload.email.trim().length > 0
      ? payload.email.trim()
      : null;

  const { data: existing } = await service
    .from("chat_users")
    .select("name, email")
    .eq("tenant_id", tenant.id)
    .eq("user_id", payload.user_id)
    .maybeSingle();

  const { data, error } = await service
    .from("chat_users")
    .upsert(
      {
        tenant_id: tenant.id,
        user_id: payload.user_id,
        name: inName ?? existing?.name ?? null,
        email: inEmail ?? existing?.email ?? null,
        role: payload.role ?? "customer",
        fcm_tokens: payload.fcm_tokens ?? [],
        notification_prefs: payload.notification_prefs ?? {},
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,user_id" },
    )
    .select()
    .single();
  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders },
    );
  }
  return NextResponse.json({ user: data }, { headers: corsHeaders });
}

export function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}
