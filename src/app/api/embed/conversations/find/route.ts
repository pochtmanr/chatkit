import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { verifyEmbedKey } from "@/lib/embed-auth";

/**
 * GET /api/embed/conversations/find?external_ref=…&kind=order|support
 *
 * Look up a single conversation by its external_ref within the
 * authenticated tenant. Used by the widget to deep-link from a host-
 * page action ("Join chat" on an order row) into the right thread.
 *
 * Returns 404 if no conversation matches — caller falls back to the
 * conversation list view in that case.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return NextResponse.json({ error: "missing bearer key" }, { status: 401 });
  }
  let session;
  try {
    session = await verifyEmbedKey(m[1]);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "invalid key" },
      { status: 401 },
    );
  }

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
