import { NextResponse, type NextRequest } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { fireTenantWebhook } from "@/lib/tenant-webhook";

/**
 * POST /api/dashboard/webhooks/test
 *
 * Fires a synthetic test webhook so the tenant can verify their URL
 * works without sending an actual chat message. Records a delivery
 * row like any normal fire — the page polls/re-renders to show the
 * outcome.
 */
export async function POST(request: NextRequest) {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, webhook_url")
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (!tenant?.webhook_url) {
    return NextResponse.json(
      { error: "no webhook_url configured" },
      { status: 400 },
    );
  }

  await fireTenantWebhook(tenant.id, {
    conversationId: "00000000-0000-0000-0000-000000000000",
    senderId: "webhook-test",
    body: "Test payload from chat-admin webhooks page.",
    mediaUrl: null,
  });
  return NextResponse.json({ ok: true });
}
