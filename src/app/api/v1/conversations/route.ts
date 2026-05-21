import { NextResponse, type NextRequest } from "next/server";
import { authTenant, corsHeaders } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/v1/conversations?user_id=… &kind=…
 *   Lists conversations the given user_id participates in. Most recent
 *   activity first.
 *
 * POST /api/v1/conversations
 *   Get-or-create a conversation. Body:
 *     {
 *       kind: 'order' | 'support' | 'direct',
 *       external_ref?: string,   // e.g. order id; required for kind='order'
 *       participants: string[],  // user_ids
 *     }
 *   Idempotent on (tenant_id, kind, external_ref) — same external_ref
 *   returns the existing row instead of failing on the unique index.
 */

export async function GET(request: NextRequest) {
  const auth = await authTenant(request);
  if ("error" in auth) return auth.error;
  const tenant = auth.tenant;

  const url = request.nextUrl;
  const userId = url.searchParams.get("user_id");
  const kind = url.searchParams.get("kind");
  if (!userId) {
    return NextResponse.json(
      { error: "user_id query param is required" },
      { status: 400, headers: corsHeaders },
    );
  }

  const service = getServiceClient();
  let query = service
    .from("conversations")
    .select("*")
    .eq("tenant_id", tenant.id)
    .contains("participants", [userId])
    .order("last_at", { ascending: false, nullsFirst: false })
    .limit(100);
  if (kind) query = query.eq("kind", kind);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders },
    );
  }
  return NextResponse.json({ conversations: data ?? [] }, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  const auth = await authTenant(request);
  if ("error" in auth) return auth.error;
  const { tenant, inbox } = auth;

  let payload: {
    kind?: "order" | "support" | "direct";
    external_ref?: string | null;
    participants?: string[];
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400, headers: corsHeaders });
  }
  if (!payload.kind || !["order", "support", "direct"].includes(payload.kind)) {
    return NextResponse.json(
      { error: "kind must be one of order|support|direct" },
      { status: 400, headers: corsHeaders },
    );
  }
  const participants = (payload.participants ?? []).filter(Boolean);
  if (participants.length === 0) {
    return NextResponse.json(
      { error: "participants must be a non-empty array of user ids" },
      { status: 400, headers: corsHeaders },
    );
  }

  const service = getServiceClient();

  // For kinds with an external_ref (order), respect the unique index by
  // doing a get-then-create rather than relying on upsert (which would
  // overwrite participants on re-call).
  if (payload.external_ref) {
    const { data: existing } = await service
      .from("conversations")
      .select("*")
      .eq("tenant_id", tenant.id)
      .eq("kind", payload.kind)
      .eq("external_ref", payload.external_ref)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ conversation: existing }, { headers: corsHeaders });
    }
  }

  const { data, error } = await service
    .from("conversations")
    .insert({
      tenant_id: tenant.id,
      inbox_id: inbox.id,
      kind: payload.kind,
      external_ref: payload.external_ref ?? null,
      participants,
    })
    .select()
    .single();
  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders },
    );
  }
  return NextResponse.json({ conversation: data }, { headers: corsHeaders });
}

export function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}
