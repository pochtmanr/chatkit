import { NextResponse, type NextRequest } from "next/server";
import { authTenant, corsHeaders, type AuthedTenant } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase/server";
import { sendMessageToHubSpot } from "@/lib/hubspot";
import {
  listThreadMessages,
  parseSenderFromBody,
  publishIncomingMessage,
  type ThreadMessage,
} from "@/lib/hubspot-conversations";
import { broadcastMessage } from "@/lib/realtime";

/**
 * GET  /api/v1/conversations/:id/messages?before=…&limit=…
 * POST /api/v1/conversations/:id/messages
 *
 * Two backends, picked by tenant flag:
 *
 *   hubspot_conversations_mode = true
 *     POST publishes the message into HubSpot Conversations (Custom
 *     Channel → ChannelAccount → thread). No Supabase writes.
 *     GET reads directly from the HubSpot thread.
 *
 *   hubspot_conversations_mode = false  (default / legacy)
 *     POST inserts into Supabase + bridges to HubSpot ticket notes.
 *     GET reads from Supabase. This is the original Phase-1/2 path.
 *
 * Tenants migrate by hitting POST /api/hubspot/conversations/setup
 * once. Until that flips the flag, behaviour is unchanged.
 */

const HUBSPOT_AGENT_SENDER_ID = "hubspot-agent";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authTenant(request);
  if ("error" in auth) return auth.error;
  const tenant = auth.tenant;

  const { id: conversationId } = await params;
  const url = request.nextUrl;
  const before = url.searchParams.get("before");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

  if (tenant.hubspot_conversations_mode) {
    return getFromHubSpotConversations(tenant, conversationId, limit);
  }
  return getFromSupabase(tenant, conversationId, before, limit);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authTenant(request);
  if ("error" in auth) return auth.error;
  const tenant = auth.tenant;

  const { id: conversationId } = await params;

  let payload: {
    sender_id?: string;
    body?: string;
    message_type?: "text" | "image" | "file" | "system";
    media_url?: string;
    reply_to?: string;
    receiver_id?: string;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400, headers: corsHeaders });
  }
  if (!payload.sender_id) {
    return NextResponse.json(
      { error: "sender_id is required" },
      { status: 400, headers: corsHeaders },
    );
  }
  const messageType = payload.message_type ?? "text";
  const hasBody = typeof payload.body === "string" && payload.body.trim().length > 0;
  const hasMedia = !!payload.media_url;
  if (messageType === "text" && !hasBody) {
    return NextResponse.json(
      { error: "body is required for text messages" },
      { status: 400, headers: corsHeaders },
    );
  }
  if (messageType !== "text" && !hasMedia) {
    return NextResponse.json(
      { error: "media_url is required for non-text messages" },
      { status: 400, headers: corsHeaders },
    );
  }

  if (tenant.hubspot_conversations_mode) {
    return postToHubSpotConversations(tenant, conversationId, {
      sender_id: payload.sender_id,
      body: payload.body!,
    });
  }
  return postLegacyTicketsPath(tenant, conversationId, payload, hasBody, messageType);
}

export function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}

// ---------------------------------------------------------------------
// Conversations-mode (HubSpot as source of truth)
// ---------------------------------------------------------------------

async function getFromHubSpotConversations(
  tenant: AuthedTenant,
  conversationId: string,
  limit: number,
): Promise<NextResponse> {
  const service = getServiceClient();
  const { data: conv } = await service
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  if (!conv) {
    return NextResponse.json(
      { error: "conversation not found" },
      { status: 404, headers: corsHeaders },
    );
  }
  // Find the HubSpot thread for this conversation. If no link exists
  // yet (no message ever sent), return empty — same as a fresh chat.
  const { data: link } = await service
    .from("conversation_hubspot_links")
    .select("hubspot_thread_id")
    .eq("tenant_id", tenant.id)
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (!link?.hubspot_thread_id) {
    return NextResponse.json({ messages: [] }, { headers: corsHeaders });
  }

  let result: Awaited<ReturnType<typeof listThreadMessages>>;
  try {
    result = await listThreadMessages({
      tenantId: tenant.id,
      threadId: link.hubspot_thread_id,
      opts: { limit },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "hubspot read failed" },
      { status: 502, headers: corsHeaders },
    );
  }

  // HubSpot returns newest-first. The SDK expects oldest-first.
  const oldestFirst = result.messages.slice().reverse();
  const messages = oldestFirst
    .filter((m) => m.type === "MESSAGE")
    .map((m) => toApiMessage(m, conversationId, tenant.id));
  return NextResponse.json({ messages }, { headers: corsHeaders });
}

async function postToHubSpotConversations(
  tenant: AuthedTenant,
  conversationId: string,
  args: { sender_id: string; body: string },
): Promise<NextResponse> {
  if (
    !tenant.hubspot_custom_channel_id ||
    !tenant.hubspot_channel_account_id ||
    !tenant.hubspot_channel_account_email
  ) {
    return NextResponse.json(
      {
        error:
          "tenant has hubspot_conversations_mode=true but is missing custom-channel ids — re-run /api/hubspot/conversations/setup",
      },
      { status: 500, headers: corsHeaders },
    );
  }

  const service = getServiceClient();
  // Conversation row must belong to this tenant.
  const { data: conv } = await service
    .from("conversations")
    .select("id, kind")
    .eq("id", conversationId)
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  if (!conv) {
    return NextResponse.json(
      { error: "conversation not found" },
      { status: 404, headers: corsHeaders },
    );
  }

  // Pull the sender's email so HubSpot can match (or create) a Contact
  // when the message lands. Without an email HubSpot treats each
  // session as an anonymous visitor, which loses cross-session history.
  const { data: senderProfile } = await service
    .from("chat_users")
    .select("email, name, role")
    .eq("tenant_id", tenant.id)
    .eq("user_id", args.sender_id)
    .maybeSingle();

  // HubSpot's visitor matching uses the email as the primary key for
  // the actor. Fall back to a stable synthetic so per-user threads
  // still group correctly when a real email isn't available.
  const senderEmail =
    senderProfile?.email ?? `${args.sender_id}@chat.local`;
  const senderName = senderProfile?.name ?? "User";

  let published;
  try {
    published = await publishIncomingMessage({
      tenantId: tenant.id,
      channelId: tenant.hubspot_custom_channel_id,
      channelAccountId: tenant.hubspot_channel_account_id,
      conversationId,
      sender: {
        email: senderEmail,
        name: senderName,
        senderUserId: args.sender_id,
      },
      recipientIdentifier: tenant.hubspot_channel_account_email,
      text: args.body,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "hubspot publish failed" },
      { status: 502, headers: corsHeaders },
    );
  }

  // Upsert the thread mapping so subsequent reads target the same
  // thread. HubSpot guarantees the same threadId for a given
  // (channelAccount, integrationThreadId, sender) tuple, so this is
  // effectively a one-shot write per conversation but we upsert
  // defensively in case the thread was archived + reopened.
  await service
    .from("conversation_hubspot_links")
    .upsert(
      {
        tenant_id: tenant.id,
        conversation_id: conversationId,
        hubspot_thread_id: published.threadId,
      },
      { onConflict: "tenant_id,conversation_id" },
    );

  // Cache last-message preview so the conversations list endpoint
  // doesn't have to round-trip HubSpot for each row.
  await service
    .from("conversations")
    .update({
      last_message: args.body,
      last_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  // Return a Supabase-shaped message object so the SDK doesn't have to
  // branch on backend — the only field that differs is `id`, which now
  // carries the HubSpot message id.
  const apiMessage = {
    id: published.messageId,
    tenant_id: tenant.id,
    conversation_id: conversationId,
    sender_id: args.sender_id,
    receiver_id: null,
    body: args.body,
    message_type: "text",
    media_url: null,
    read_by: [],
    reply_to: null,
    edited_at: null,
    deleted_at: null,
    created_at: new Date().toISOString(),
    hubspot_message_id: published.messageId,
    hubspot_thread_id: published.threadId,
  };
  return NextResponse.json({ message: apiMessage }, { headers: corsHeaders });
}

/** Map a HubSpot Conversations thread message into the shape the SDK
 *  already understands (same one the Supabase path returns). */
function toApiMessage(
  m: ThreadMessage,
  conversationId: string,
  tenantId: string,
) {
  const rawBody = m.text ?? m.richText ?? "";
  const parsed = parseSenderFromBody(rawBody);
  const isFromCustomer = m.direction === "INCOMING";
  // INCOMING with a parseable prefix = our app message — recover the
  // original sender_user_id. INCOMING without a prefix shouldn't happen
  // (we always encode), but fall back to the HubSpot actor id. OUTGOING
  // is an agent reply — route through the sentinel.
  const senderId = isFromCustomer
    ? parsed.senderUserId ?? m.senders?.[0]?.actorId ?? "unknown"
    : HUBSPOT_AGENT_SENDER_ID;
  return {
    id: m.id,
    tenant_id: tenantId,
    conversation_id: conversationId,
    sender_id: senderId,
    receiver_id: null,
    body: parsed.body,
    message_type: "text",
    media_url: null,
    read_by: [],
    reply_to: null,
    edited_at: null,
    deleted_at: null,
    created_at: m.createdAt,
    hubspot_message_id: m.id,
    hubspot_thread_id: m.conversationsThreadId,
  };
}

// ---------------------------------------------------------------------
// Legacy Supabase + Tickets path (pre-migration tenants)
// ---------------------------------------------------------------------

async function getFromSupabase(
  tenant: AuthedTenant,
  conversationId: string,
  before: string | null,
  limit: number,
): Promise<NextResponse> {
  const service = getServiceClient();
  const { data: conv } = await service
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  if (!conv) {
    return NextResponse.json(
      { error: "conversation not found" },
      { status: 404, headers: corsHeaders },
    );
  }
  let query = service
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (before) query = query.lt("created_at", before);
  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders },
    );
  }
  return NextResponse.json(
    { messages: (data ?? []).reverse() },
    { headers: corsHeaders },
  );
}

async function postLegacyTicketsPath(
  tenant: AuthedTenant,
  conversationId: string,
  payload: {
    sender_id?: string;
    body?: string;
    message_type?: "text" | "image" | "file" | "system";
    media_url?: string;
    reply_to?: string;
    receiver_id?: string;
  },
  hasBody: boolean,
  messageType: "text" | "image" | "file" | "system",
): Promise<NextResponse> {
  const service = getServiceClient();
  const { data: conv } = await service
    .from("conversations")
    .select("id, kind, external_ref")
    .eq("id", conversationId)
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  if (!conv) {
    return NextResponse.json(
      { error: "conversation not found" },
      { status: 404, headers: corsHeaders },
    );
  }

  const { data: senderProfile } = await service
    .from("chat_users")
    .select("email, name, role")
    .eq("tenant_id", tenant.id)
    .eq("user_id", payload.sender_id!)
    .maybeSingle();

  const { data: message, error: msgErr } = await service
    .from("messages")
    .insert({
      tenant_id: tenant.id,
      conversation_id: conversationId,
      sender_id: payload.sender_id,
      receiver_id: payload.receiver_id ?? null,
      body: payload.body ?? null,
      message_type: messageType,
      media_url: payload.media_url ?? null,
      reply_to: payload.reply_to ?? null,
    })
    .select()
    .single();
  if (msgErr || !message) {
    return NextResponse.json(
      { error: msgErr?.message ?? "insert failed" },
      { status: 500, headers: corsHeaders },
    );
  }

  await service
    .from("conversations")
    .update({
      last_message: hasBody ? payload.body : `[${messageType}]`,
      last_at: message.created_at,
    })
    .eq("id", conversationId);

  await broadcastMessage(conversationId, message);

  const shouldBridge =
    tenant.integration_type === "hubspot" &&
    conv.kind === "support" &&
    senderProfile?.role !== "admin" &&
    senderProfile?.role !== "support" &&
    hasBody;

  if (shouldBridge) {
    try {
      await sendMessageToHubSpot({
        tenantId: tenant.id,
        conversationId,
        message: payload.body!,
        fromUser: {
          email: senderProfile?.email ?? undefined,
          name: senderProfile?.name ?? undefined,
        },
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown";
      return NextResponse.json(
        { message, hubspot_error: reason },
        { headers: corsHeaders },
      );
    }
  }

  return NextResponse.json({ message }, { headers: corsHeaders });
}
