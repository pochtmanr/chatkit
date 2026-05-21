import { NextResponse, type NextRequest } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { fireInboxTestWebhook } from "@/lib/tenant-webhook";

/**
 * POST /api/dashboard/webhooks/test
 * Body: { inboxId: string }
 *
 * Fires a synthetic test webhook against the given inbox's
 * webhook_url. The user must own the inbox (RLS scopes the lookup).
 */
export async function POST(request: NextRequest) {
  const sb = await getServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    inboxId?: string;
  } | null;
  const inboxId = body?.inboxId;
  if (!inboxId)
    return NextResponse.json({ error: "inboxId required" }, { status: 400 });

  const { data: inbox } = await sb
    .from("inboxes")
    .select("id, business_id, webhook_url")
    .eq("id", inboxId)
    .is("archived_at", null)
    .maybeSingle();
  if (!inbox)
    return NextResponse.json({ error: "inbox not found" }, { status: 404 });
  if (!inbox.webhook_url) {
    return NextResponse.json(
      { error: "no webhook_url configured" },
      { status: 400 },
    );
  }

  await fireInboxTestWebhook(inbox.id);
  return NextResponse.json({ ok: true });
}
