import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { verifyHubSpotSignature } from "@/lib/hubspot";

/**
 * Inbound: HubSpot fires this webhook when an admin replies to a thread
 * inside HubSpot. We resolve the thread → conversation, then surface the
 * reply back into the chat database so the SDK's realtime listener
 * pushes it to the user's app.
 *
 * Subscribe to the `conversation.newMessage` event in your HubSpot app
 * settings and point it at https://<your-host>/api/hubspot/webhook.
 *
 * The actual write into the chat data store is TODO — chat data lives
 * in Firebase (in the customer's project), not Supabase, so this
 * handler needs the Firebase Admin SDK initialized with that project's
 * service account. See `// TODO: forward-to-firebase` below.
 */

interface HubSpotEventBatchItem {
  eventId: number;
  subscriptionType: string; // e.g. "conversation.newMessage"
  portalId: number;
  objectId?: number; // thread id for conversation events
  propertyName?: string;
  propertyValue?: string;
  occurredAt: number;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // HubSpot v3 signature: header `X-HubSpot-Signature-V3` + timestamp.
  const signature = request.headers.get("x-hubspot-signature-v3");
  const timestamp = request.headers.get("x-hubspot-request-timestamp");
  if (!signature || !timestamp) {
    return NextResponse.json({ error: "missing signature" }, { status: 401 });
  }

  // Reconstruct the URL HubSpot signed (full origin + path).
  const url = `${request.nextUrl.origin}${request.nextUrl.pathname}${request.nextUrl.search}`;
  const ok = verifyHubSpotSignature({
    method: request.method,
    url,
    body: rawBody,
    timestamp,
    signature,
  });
  if (!ok) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let events: HubSpotEventBatchItem[];
  try {
    events = JSON.parse(rawBody) as HubSpotEventBatchItem[];
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!Array.isArray(events)) {
    return NextResponse.json({ error: "expected array" }, { status: 400 });
  }

  const service = getServiceClient();
  for (const event of events) {
    if (event.subscriptionType !== "conversation.newMessage") continue;
    const threadId = event.objectId ? String(event.objectId) : null;
    const portalId = String(event.portalId);
    if (!threadId) continue;

    // Find the tenant + conversation this thread maps to.
    const { data: link } = await service
      .from("conversation_hubspot_links")
      .select("tenant_id, conversation_id, tenants!inner(hubspot_portal_id)")
      .eq("hubspot_thread_id", threadId)
      .maybeSingle();
    if (!link) continue;

    // Sanity check the portal id — defends against another HubSpot
    // account targeting our endpoint with a guessed thread id.
    type LinkRow = {
      tenant_id: string;
      conversation_id: string;
      tenants: { hubspot_portal_id: string | null };
    };
    const tenantPortal = (link as unknown as LinkRow).tenants?.hubspot_portal_id;
    if (tenantPortal && tenantPortal !== portalId) continue;

    // TODO: forward-to-firebase
    // The chat data lives in Firebase, not Supabase. To complete the
    // round-trip, initialize a Firebase Admin SDK here with the
    // tenant's service account (or a shared one) and write the new
    // message into the corresponding chat thread, e.g.:
    //
    //   await admin.firestore()
    //     .collection('tenants').doc(link.tenant_id)
    //     .collection('conversations').doc(link.conversation_id)
    //     .collection('messages').add({
    //       senderId: 'support',
    //       message: <fetched body>,
    //       createdAt: admin.firestore.FieldValue.serverTimestamp(),
    //       source: 'hubspot',
    //     });
    //
    // Note: HubSpot's webhook payload only includes the thread id, not
    // the message body. To get the body you call
    //   GET /conversations/v3/conversations/threads/{threadId}/messages
    // with the tenant's access token (use getValidAccessToken).
  }

  return NextResponse.json({ received: events.length });
}
