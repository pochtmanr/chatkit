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
  const { data, error } = await service
    .from("chat_users")
    .upsert(
      {
        tenant_id: tenant.id,
        user_id: payload.user_id,
        name: payload.name ?? null,
        email: payload.email ?? null,
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
