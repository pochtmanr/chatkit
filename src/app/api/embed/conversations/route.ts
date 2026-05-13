import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { verifyEmbedKey } from "@/lib/embed-auth";

/**
 * GET /api/embed/conversations
 *
 * Auth: Bearer <tenant api key>. Returns the support conversations
 * for the bearer's tenant + counterpart display names — exactly the
 * data the widget's ConversationList renders. We can't query Supabase
 * directly from the browser because RLS hides rows from the anon
 * role; this route uses the service client server-side instead.
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

  const service = getServiceClient();
  const { data: conversations, error } = await service
    .from("conversations")
    .select("id, external_ref, last_message, last_at")
    .eq("tenant_id", session.tenantId)
    .eq("kind", "support")
    .order("last_at", { ascending: false, nullsFirst: false })
    .limit(50);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const refs = (conversations ?? [])
    .map((c) => c.external_ref)
    .filter((v): v is string => !!v);
  const { data: usersData } = refs.length
    ? await service
        .from("chat_users")
        .select("user_id, name, email")
        .eq("tenant_id", session.tenantId)
        .in("user_id", refs)
    : { data: [] };

  return NextResponse.json({
    conversations: conversations ?? [],
    users: usersData ?? [],
  });
}
