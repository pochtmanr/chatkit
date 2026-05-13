import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import {
  fetchEngagement,
  fetchThreadMessages,
  stripHtml,
  verifyHubSpotSignature,
} from "@/lib/hubspot";
import { broadcastMessage } from "@/lib/realtime";

/** Sentinel sender id for messages that came back from a HubSpot agent.
 *  Picked so it can't collide with a real user id and so the mobile SDK's
 *  `isSelf` check (current user id vs sender id) naturally renders these
 *  as incoming. */
const HUBSPOT_AGENT_SENDER_ID = "hubspot-agent";

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
    if (event.subscriptionType === "engagement.creation") {
      await handleEngagementCreation(service, event);
      continue;
    }
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

    // HubSpot's webhook only gives us the thread id, not the message
    // body — fetch the latest messages and forward any agent (OUTGOING)
    // replies we haven't seen yet into our messages table. We dedupe on
    // hubspot_message_id so redelivered webhooks don't double-post.
    let thread: Awaited<ReturnType<typeof fetchThreadMessages>>;
    try {
      thread = await fetchThreadMessages(link.tenant_id, threadId, 20);
    } catch (err) {
      console.error(
        `[hubspot/webhook] fetchThreadMessages failed for thread ${threadId}:`,
        err,
      );
      continue;
    }

    // Only outgoing 'MESSAGE' entries are agent replies to the customer.
    // 'COMMENT' is an internal note inside HubSpot, not visible to the
    // user — skip those. Order is newest-first; we want oldest-first so
    // multiple unseen replies land in chronological order.
    const candidates = thread
      .filter((m) => m.type === "MESSAGE" && m.direction === "OUTGOING")
      .reverse();

    for (const hsMsg of candidates) {
      const body = hsMsg.text ?? hsMsg.richText ?? "";
      if (!body.trim()) continue;

      const { data: inserted, error: insErr } = await service
        .from("messages")
        .insert({
          tenant_id: link.tenant_id,
          conversation_id: link.conversation_id,
          sender_id: HUBSPOT_AGENT_SENDER_ID,
          receiver_id: null,
          body,
          message_type: "text",
          hubspot_message_id: hsMsg.id,
        })
        .select()
        .single();

      // Duplicate (already inserted from a previous webhook) → unique
      // index error code 23505. That's the happy path for redeliveries.
      if (insErr) {
        const code = (insErr as { code?: string }).code;
        if (code !== "23505") {
          console.error(
            `[hubspot/webhook] insert failed for hubspot msg ${hsMsg.id}:`,
            insErr,
          );
        }
        continue;
      }
      if (!inserted) continue;

      // Mirror what the user-facing sendMessage route does so list
      // endpoints / preview rows stay consistent.
      await service
        .from("conversations")
        .update({ last_message: body, last_at: inserted.created_at })
        .eq("id", link.conversation_id);

      // Realtime broadcast — this is what the SDK's subscribeToConversation
      // listens to. Without it, the message only appears on next refresh.
      try {
        await broadcastMessage(link.conversation_id, inserted);
      } catch (err) {
        console.warn(
          `[hubspot/webhook] broadcastMessage failed for msg ${inserted.id}:`,
          err,
        );
      }
    }
  }

  return NextResponse.json({ received: events.length });
}

/** Inbound: an agent added a NOTE to a HubSpot ticket. We forward the
 *  note's body into our chat as a message from the tenant's support
 *  sentinel, so the user's app sees it as a normal incoming chat message
 *  rather than having to crack open the ticket.
 *
 *  This is the reverse direction of `sendMessageToHubSpot` /
 *  `appendNoteToTicket`. The outbound path puts user messages on the
 *  ticket; this path takes agent notes back off it.
 */
async function handleEngagementCreation(
  service: ReturnType<typeof getServiceClient>,
  event: HubSpotEventBatchItem,
): Promise<void> {
  const engagementId = event.objectId ? String(event.objectId) : null;
  const portalId = String(event.portalId);
  if (!engagementId) return;

  // Identify the tenant via portal id. We need it both for the API call
  // and for the dedup unique-index scope.
  const { data: tenant } = await service
    .from("tenants")
    .select("id")
    .eq("hubspot_portal_id", portalId)
    .maybeSingle();
  if (!tenant) return;

  // Fetch the engagement details — the webhook payload alone doesn't
  // carry the body or associations.
  let engagement;
  try {
    engagement = await fetchEngagement(tenant.id, engagementId);
  } catch (err) {
    console.error(
      `[hubspot/webhook] fetchEngagement failed for ${engagementId}:`,
      err,
    );
    return;
  }
  if (!engagement) return;

  // Only NOTE engagements map to chat messages. Skip CALLs, EMAILs, etc.
  if (engagement.type !== "NOTE") return;

  // Note must be associated with a ticket we're tracking — otherwise
  // there's no conversation to attach to.
  const ticketIds = engagement.associations?.ticketIds ?? [];
  if (ticketIds.length === 0) return;

  for (const ticketId of ticketIds) {
    const { data: link } = await service
      .from("conversation_hubspot_links")
      .select("conversation_id")
      .eq("tenant_id", tenant.id)
      .eq("hubspot_ticket_id", String(ticketId))
      .maybeSingle();
    if (!link) continue;

    // sendMessageToHubSpot writes every user message as a note too, and
    // prefixes it with "**Name**\n\n…". Skip our own outbound copy so
    // we don't ingest the user's own messages back as agent replies.
    const rawBody =
      engagement.metadata?.body ?? engagement.body ?? "";
    const text = stripHtml(rawBody);
    if (!text.trim()) continue;
    // Heuristic: notes we wrote start with "**…**\n\n". Agent-typed
    // notes inside HubSpot don't have that prefix.
    if (/^\*\*[^*]+\*\*\n/.test(text)) continue;

    const { data: inserted, error: insErr } = await service
      .from("messages")
      .insert({
        tenant_id: tenant.id,
        conversation_id: link.conversation_id,
        sender_id: HUBSPOT_AGENT_SENDER_ID,
        receiver_id: null,
        body: text,
        message_type: "text",
        hubspot_engagement_id: engagement.id,
      })
      .select()
      .single();
    if (insErr) {
      // 23505 = unique violation → duplicate redelivery, expected.
      if ((insErr as { code?: string }).code !== "23505") {
        console.error(
          `[hubspot/webhook] insert failed for engagement ${engagement.id}:`,
          insErr,
        );
      }
      continue;
    }
    if (!inserted) continue;

    await service
      .from("conversations")
      .update({ last_message: text, last_at: inserted.created_at })
      .eq("id", link.conversation_id);

    try {
      await broadcastMessage(link.conversation_id, inserted);
    } catch (err) {
      console.warn(
        `[hubspot/webhook] broadcastMessage failed for engagement ${engagement.id}:`,
        err,
      );
    }
  }
}
