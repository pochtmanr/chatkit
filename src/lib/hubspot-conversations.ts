/**
 * HubSpot Conversations API helpers.
 *
 * This module replaces the Tickets+Notes bridge in lib/hubspot.ts for
 * tenants who want chat history to live in HubSpot Conversations
 * (Inbox) instead of as ticket activities.
 *
 * Architecture (Custom Channel):
 *   1. Per-tenant one-time setup creates a Custom Channel + Channel
 *      Account on HubSpot, mapped to a chosen Inbox. IDs land on the
 *      tenant row.
 *   2. When the app POSTs a user message we forward it as INCOMING to
 *      `/custom-channels/{channelId}/messages`. HubSpot opens (or
 *      reuses) a thread and returns its id, which we store on
 *      conversation_hubspot_links.
 *   3. Reads go through `GET /threads/{threadId}/messages`.
 *   4. Agent replies fire a webhook on the URL we register at channel
 *      creation; the webhook handler pushes a notification to the
 *      device. The actual message body is fetched on-demand by the
 *      app's next poll, not denormalized into Supabase.
 *
 * Why no Supabase mirror: the user chose HubSpot as source of truth.
 * Mirroring would re-introduce a "is the cache fresh?" question every
 * read which is what we're explicitly trying to avoid.
 */

import { getValidAccessToken } from "@/lib/hubspot";

const HUBSPOT_API = "https://api.hubapi.com";

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------

export interface CustomChannel {
  id: string;
  name: string;
  webhookUrl: string;
}

export interface ChannelAccount {
  id: string;
  inboxId: string;
  name: string;
  deliveryIdentifier: { type: string; value: string };
}

/** Shape returned by `POST /custom-channels/{id}/messages`. */
export interface PublishedMessage {
  id: string;
  conversationsThreadId: string;
  createdAt: string;
}

/** Shape returned by `GET /threads/{id}/messages`. We model only the
 *  fields we render in the SDK — HubSpot returns plenty more. */
export interface ThreadMessage {
  id: string;
  conversationsThreadId: string;
  type: "MESSAGE" | "COMMENT" | "WELCOME_MESSAGE";
  direction: "INCOMING" | "OUTGOING";
  text?: string;
  richText?: string;
  createdAt: string;
  senders?: Array<{ actorId?: string; name?: string }>;
}

interface ApiErrorBody {
  status?: string;
  message?: string;
  category?: string;
}

class HubSpotConversationsError extends Error {
  status: number;
  body: ApiErrorBody | null;
  constructor(status: number, message: string, body: ApiErrorBody | null) {
    super(`HubSpot Conversations API ${status}: ${message}`);
    this.name = "HubSpotConversationsError";
    this.status = status;
    this.body = body;
  }
}

async function hubspotFetch(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const res = await fetch(`${HUBSPOT_API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  let body: ApiErrorBody | null = null;
  let raw: unknown = null;
  try {
    raw = await res.json();
    body = raw as ApiErrorBody;
  } catch {
    // some endpoints return 204 with no body
  }
  if (!res.ok) {
    const msg = body?.message ?? `request failed (${res.status})`;
    throw new HubSpotConversationsError(res.status, msg, body);
  }
  return raw;
}

// ---------------------------------------------------------------------
// One-time channel setup
// ---------------------------------------------------------------------

/** Register a Custom Channel for this tenant. Returns the channel id
 *  which must be persisted so subsequent message publishes route to
 *  the right channel.
 *
 *  Creating a channel requires the HubSpot **developer API key**, not
 *  a per-tenant OAuth token — channels live at the *app* level, not
 *  the portal level. The app's `appId` and developer key come from
 *  the HubSpot developer account.
 */
export async function createCustomChannel(args: {
  developerApiKey: string;
  appId: string;
  name: string;
  webhookUrl: string;
}): Promise<CustomChannel> {
  const params = new URLSearchParams({
    hapikey: args.developerApiKey,
    appId: args.appId,
  });
  const res = await fetch(
    `${HUBSPOT_API}/conversations/v3/custom-channels?${params.toString()}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: args.name,
        webhookUrl: args.webhookUrl,
        // Capabilities we need for a chat-style integration. We send
        // plain text; rich text + attachments can be added later when
        // the SDK supports them end-to-end.
        capabilities: {
          deliveryIdentifierTypes: ["HS_EMAIL_ADDRESS"],
          richText: ["BOLD", "ITALIC", "HYPERLINK"],
          allowConversationStart: true,
          allowMultipleRecipients: false,
          allowOutgoingMessages: true,
        },
      }),
    },
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`create-custom-channel failed (${res.status}): ${txt}`);
  }
  const json = (await res.json()) as { id: string; name: string; webhookUrl: string };
  return json;
}

/** Bind a Custom Channel to one of the tenant's HubSpot inboxes.
 *  Requires the tenant's OAuth token (not the developer key) — channel
 *  accounts are portal-scoped.
 *
 *  The `deliveryIdentifier` is what HubSpot uses to label this account
 *  in the agent UI. For a chat-style integration any unique value
 *  works; using a tenant-scoped email-like identifier keeps the agent
 *  view scannable.
 */
export async function createChannelAccount(args: {
  tenantId: string;
  channelId: string;
  inboxId: string;
  name: string;
  identifierEmail: string;
}): Promise<ChannelAccount> {
  const token = await getValidAccessToken(args.tenantId);
  const json = (await hubspotFetch(
    token,
    `/conversations/v3/custom-channels/${args.channelId}/channel-accounts`,
    {
      method: "POST",
      body: JSON.stringify({
        inboxId: args.inboxId,
        name: args.name,
        deliveryIdentifier: {
          type: "HS_EMAIL_ADDRESS",
          value: args.identifierEmail,
        },
        // `authorized: true` flips the channel from "pending" to
        // ready-to-route in the inbox settings. Without this, agents
        // can't see incoming messages.
        authorized: true,
      }),
    },
  )) as ChannelAccount;
  return json;
}

// ---------------------------------------------------------------------
// Message publish (app → HubSpot, INCOMING direction)
// ---------------------------------------------------------------------

export interface PublishIncomingArgs {
  tenantId: string;
  channelId: string;
  channelAccountId: string;
  /** The chat-admin conversation id. Passed as integrationThreadId so
   *  HubSpot threads stay 1:1 with our conversations even if the agent
   *  archives/reopens. */
  conversationId: string;
  /** End-user identity. Email is what HubSpot uses to dedupe visitor
   *  actors, so it's important for grouping a user's messages under
   *  the same contact card. */
  sender: { email: string; name?: string; senderUserId: string };
  /** Mailbox identifier for the channel account (the same string we
   *  passed as `identifierEmail` at account creation). HubSpot routes
   *  by this when fanning out to agents. */
  recipientIdentifier: string;
  /** Plain text message body. */
  text: string;
  /** Optional client-generated timestamp; defaults to now(). HubSpot
   *  uses this for thread ordering in the inbox UI. */
  timestamp?: string;
}

/** Publish a message into HubSpot as if it came from the customer.
 *  Returns the HubSpot thread id, which the caller should persist on
 *  conversation_hubspot_links so future reads/writes target the same
 *  thread.
 *
 *  Sender identity preservation: HubSpot stores its own internal
 *  visitor actor ids (`V-XXX`) on each message. To recover our
 *  `sender_user_id` on read, we embed it in the body prefix:
 *      **Name** [id:abc123]\n\nactual text
 *  See parseSenderFromBody() for the reverse.
 */
export async function publishIncomingMessage(
  args: PublishIncomingArgs,
): Promise<{ threadId: string; messageId: string }> {
  const token = await getValidAccessToken(args.tenantId);
  const decorated = encodeSenderInBody(args.sender, args.text);
  const json = (await hubspotFetch(
    token,
    `/conversations/v3/custom-channels/${args.channelId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        channelAccountId: args.channelAccountId,
        sender: { type: "ACTOR", value: args.sender.email },
        recipient: { type: "ACTOR", value: args.recipientIdentifier },
        messageText: decorated,
        direction: "INCOMING",
        timestamp: args.timestamp ?? new Date().toISOString(),
        integrationThreadId: args.conversationId,
      }),
    },
  )) as PublishedMessage;
  return { threadId: json.conversationsThreadId, messageId: json.id };
}

// ---------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------

export interface ListThreadMessagesOptions {
  /** Paging cursor returned in the previous response's `paging.next.after`. */
  after?: string;
  /** Max items to return (HubSpot caps at 500). Default 100. */
  limit?: number;
}

/** Read messages from a HubSpot thread, newest-first. The SDK reverses
 *  for chronological display.
 */
export async function listThreadMessages(args: {
  tenantId: string;
  threadId: string;
  opts?: ListThreadMessagesOptions;
}): Promise<{ messages: ThreadMessage[]; next?: string }> {
  const token = await getValidAccessToken(args.tenantId);
  const params = new URLSearchParams();
  params.set("limit", String(args.opts?.limit ?? 100));
  if (args.opts?.after) params.set("after", args.opts.after);
  const json = (await hubspotFetch(
    token,
    `/conversations/v3/conversations/threads/${args.threadId}/messages?${params.toString()}`,
  )) as { results: ThreadMessage[]; paging?: { next?: { after?: string } } };
  return {
    messages: json.results ?? [],
    next: json.paging?.next?.after,
  };
}

// ---------------------------------------------------------------------
// Sender encoding helpers
// ---------------------------------------------------------------------

/** Prefix the message body with `**Name** [id:abc]\n\n` so we can
 *  recover the original sender_user_id when reading back from HubSpot.
 *  HubSpot's own visitor actor ids (`V-XXX`) are opaque and don't map
 *  to our app's user ids. */
export function encodeSenderInBody(
  sender: { name?: string; senderUserId: string },
  text: string,
): string {
  const safeName = (sender.name ?? "user").replace(/\]/g, ""); // strip ] so the regex stays unambiguous
  return `**${safeName}** [id:${sender.senderUserId}]\n\n${text}`;
}

export interface ParsedSender {
  senderUserId: string | null;
  name: string | null;
  body: string;
}

/** Inverse of encodeSenderInBody. When the prefix is missing
 *  (e.g. a message typed by an agent inside HubSpot), returns
 *  `senderUserId: null` so callers can route it to the agent sentinel. */
export function parseSenderFromBody(raw: string): ParsedSender {
  // **Name** [id:abc123]\n\n<body>
  const match = raw.match(/^\*\*([^*]+)\*\*\s*\[id:([^\]]+)\]\n\n([\s\S]*)$/);
  if (!match) return { senderUserId: null, name: null, body: raw };
  return {
    senderUserId: match[2],
    name: match[1],
    body: match[3],
  };
}
