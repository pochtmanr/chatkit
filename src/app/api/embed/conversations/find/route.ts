import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { verifyEmbedKey } from "@/lib/embed-auth";

/**
 * GET  /api/embed/conversations/find?external_ref=…&kind=…
 *   Look up a single conversation by external_ref. 404 if missing.
 *
 * POST /api/embed/conversations/find
 *   Same lookup, but creates the conversation if it doesn't exist.
 *   Body: { external_ref, kind: 'order'|'support', participants?: string[] }
 *
 * The POST variant lets the FAB's "Chat" / "Join chat" buttons open
 * a thread even when nothing has been written yet (e.g. an order that
 * has never seen a chat message). Admins can start the conversation
 * from their side.
 */
async function authSession(request: NextRequest) {
  const auth = request.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return {
      err: NextResponse.json({ error: "missing bearer key" }, { status: 401 }),
    };
  }
  try {
    const session = await verifyEmbedKey(m[1]);
    return { session };
  } catch (err) {
    return {
      err: NextResponse.json(
        { error: err instanceof Error ? err.message : "invalid key" },
        { status: 401 },
      ),
    };
  }
}

export async function GET(request: NextRequest) {
  const auth = await authSession(request);
  if ("err" in auth) return auth.err;
  const session = auth.session;

  const externalRef = request.nextUrl.searchParams.get("external_ref");
  const kind = request.nextUrl.searchParams.get("kind");
  if (!externalRef) {
    return NextResponse.json(
      { error: "external_ref required" },
      { status: 400 },
    );
  }

  const service = getServiceClient();
  let query = service
    .from("conversations")
    .select("id, kind, external_ref")
    .eq("tenant_id", session.tenantId)
    .eq("external_ref", externalRef);
  if (kind) query = query.eq("kind", kind);
  const { data, error } = await query.maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ conversation: data });
}

export async function POST(request: NextRequest) {
  const auth = await authSession(request);
  if ("err" in auth) return auth.err;
  const session = auth.session;

  let payload: {
    external_ref?: string;
    kind?: "support" | "order";
    participants?: string[];
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!payload.external_ref || !payload.kind) {
    return NextResponse.json(
      { error: "external_ref + kind required" },
      { status: 400 },
    );
  }

  const service = getServiceClient();

  // Lookup first. If it exists, we're done.
  const { data: existing } = await service
    .from("conversations")
    .select("id, kind, external_ref")
    .eq("tenant_id", session.tenantId)
    .eq("external_ref", payload.external_ref)
    .eq("kind", payload.kind)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ conversation: existing, created: false });
  }

  // Otherwise insert.
  const participants =
    Array.isArray(payload.participants) && payload.participants.length > 0
      ? payload.participants.filter((p): p is string => !!p)
      : payload.kind === "support"
        ? [payload.external_ref] // support: end-user is the participant
        : [];
  const { data: inserted, error } = await service
    .from("conversations")
    .insert({
      tenant_id: session.tenantId,
      kind: payload.kind,
      external_ref: payload.external_ref,
      participants,
    })
    .select("id, kind, external_ref")
    .single();
  if (error || !inserted) {
    return NextResponse.json(
      { error: error?.message ?? "insert failed" },
      { status: 500 },
    );
  }
  return NextResponse.json({ conversation: inserted, created: true });
}
