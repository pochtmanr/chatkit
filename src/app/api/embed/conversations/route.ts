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
  // Return both kinds: support (user ↔ admin) and order (customer ↔
  // driver). The widget shows them side-by-side so agents see every
  // conversation that needs attention in one place.
  const { data: conversations, error } = await service
    .from("conversations")
    .select("id, kind, external_ref, last_message, last_at, participants")
    .eq("tenant_id", session.tenantId)
    .in("kind", ["support", "order"])
    .order("last_at", { ascending: false, nullsFirst: false })
    .limit(100);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // For support conversations external_ref is the user's uid; for
  // order conversations it's the order id (so we'd need to look up
  // the customer separately via participants[0]). Collect every uid
  // we'd want a display name for in one pass.
  const namesNeeded = new Set<string>();
  (conversations ?? []).forEach((c) => {
    if (c.kind === "support" && c.external_ref) {
      namesNeeded.add(c.external_ref);
    } else if (c.kind === "order" && Array.isArray(c.participants)) {
      // Customer = first participant by convention from the migration
      // script. Show them in the list row.
      c.participants.slice(0, 1).forEach((p: string) => namesNeeded.add(p));
    }
  });

  const { data: usersData } = namesNeeded.size
    ? await service
        .from("chat_users")
        .select("user_id, name, email")
        .eq("tenant_id", session.tenantId)
        .in("user_id", Array.from(namesNeeded))
    : { data: [] };

  return NextResponse.json({
    conversations: conversations ?? [],
    users: usersData ?? [],
  });
}
