# HubSpot Conversations API · Setup Guide

This document walks through the manual steps required on the **HubSpot side**
before `hubspot_conversations_mode` can be turned on for a tenant. The
code changes are in branch `feat/hubspot-conversations-api`.

Once these steps are done a tenant flips from the legacy Tickets+Notes
bridge to having HubSpot Conversations (Inbox) as the source of truth
for chat history. The SDK reads/writes go through the same REST API as
before; only the storage backend changes.

---

## 1. Update OAuth app scopes

In HubSpot Developer Account → Apps → your app → **Auth tab**:

Required scopes (replace the existing scope set):

- `oauth` _(unchanged)_
- `tickets` _(kept for legacy tenants — remove once everyone is migrated)_
- `conversations.read` ← new
- `conversations.write` ← new

The OAuth start route already requests this scope string after the
`feat/hubspot-conversations-api` branch is deployed
(`src/app/api/hubspot/oauth/start/route.ts:60`). Every connected tenant
needs to **disconnect + reconnect** before the new scopes apply — HubSpot
doesn't retroactively upgrade an existing token's scope.

---

## 2. Create the Custom Channel (one-time, app-wide)

A Custom Channel lives at the **developer app** layer, not per portal.
You create it once and every tenant connected through this app reuses
the same `channelId`.

Two ways to create it:

### Option A — let the setup endpoint do it on first call

`POST /api/hubspot/conversations/setup` (see step 4) calls
`createCustomChannel` if `HUBSPOT_CUSTOM_CHANNEL_ID` env var isn't set.
For this to work the chat-admin Vercel deployment needs:

```
HUBSPOT_DEVELOPER_API_KEY=<your developer-account API key>
HUBSPOT_APP_ID=<your app id, numeric>
```

Find both in HubSpot Developer → Apps → your app → **API keys** tab.

### Option B — create manually with curl

```sh
curl -X POST \
  "https://api.hubapi.com/conversations/v3/custom-channels?hapikey=$DEV_KEY&appId=$APP_ID" \
  -H 'content-type: application/json' \
  -d '{
    "name": "GoDelivery Mobile Chat",
    "webhookUrl": "https://<your-chat-admin>.vercel.app/api/hubspot/webhook",
    "capabilities": {
      "deliveryIdentifierTypes": ["HS_EMAIL_ADDRESS"],
      "richText": ["BOLD", "ITALIC", "HYPERLINK"],
      "allowConversationStart": true,
      "allowMultipleRecipients": false,
      "allowOutgoingMessages": true
    }
  }'
```

Save the returned `id` and set it as the `HUBSPOT_CUSTOM_CHANNEL_ID` env
var on Vercel. Subsequent tenant setups won't re-create the channel.

---

## 3. Run the Supabase migration

```sh
# In holylabs-chat-admin/
psql "$DATABASE_URL" -f supabase/migrations/0008_hubspot_custom_channel.sql
```

Or paste it into the Supabase SQL editor. This adds:

- `tenants.hubspot_custom_channel_id`
- `tenants.hubspot_channel_account_id`
- `tenants.hubspot_channel_account_email`
- `tenants.hubspot_conversations_mode` _(boolean, default false)_

Existing tenants stay on the legacy tickets path until they explicitly
flip the flag via the setup endpoint.

---

## 4. Per-tenant setup: register a Channel Account

Each tenant gets its own ChannelAccount under the shared Custom Channel.
The account binds the channel to a specific HubSpot Inbox so agents
see incoming messages routed correctly.

Prerequisites:

1. Tenant has connected HubSpot (i.e. completed the OAuth flow with the
   new conversations scopes — step 1).
2. Tenant has picked an Inbox in their HubSpot account. The inbox id
   is visible in the Inbox URL: `app.hubspot.com/live-messages/<portalId>/inbox/<inboxId>/`.
3. The tenant owner is signed into chat-admin dashboard.

Then POST to the setup endpoint:

```sh
curl -X POST https://<your-chat-admin>.vercel.app/api/hubspot/conversations/setup \
  -H 'content-type: application/json' \
  -b "sb-access-token=$DASHBOARD_SESSION" \
  -d '{
    "inbox_id": "<INBOX_ID>",
    "identifier_email": "godelivery-mobile@chat.local"
  }'
```

`identifier_email` is what agents see as the "from" address in the
inbox. Use a stable, tenant-scoped value — agents can't reply to this
address by email, it's just a UI label.

Successful response:

```json
{
  "channel_id": "1234",
  "channel_account_id": "5678",
  "channel_account_email": "godelivery-mobile@chat.local",
  "inbox_id": "..."
}
```

After this returns, `tenants.hubspot_conversations_mode = true` and the
next message sent through the SDK will be published to a HubSpot thread
instead of a ticket note.

---

## 5. Smoke-test the round-trip

### From the app side

1. Open the support widget in the mobile app and send a message.
2. The SDK POSTs to `/api/v1/conversations/<id>/messages`.
3. chat-admin calls HubSpot `POST /conversations/v3/custom-channels/<id>/messages`
   with `direction: INCOMING` and the user's encoded sender prefix.
4. HubSpot returns `conversationsThreadId`; chat-admin stores it on
   `conversation_hubspot_links.hubspot_thread_id`.

Verify in HubSpot: open the Inbox you bound in step 4 — the message
should appear as a new thread from `godelivery-mobile@chat.local` (or
whatever you set as identifier_email).

### From HubSpot side

1. As an agent, reply in the thread.
2. HubSpot POSTs `OUTGOING_CHANNEL_MESSAGE_CREATED` to the webhook URL
   you set at channel creation (chat-admin's `/api/hubspot/webhook`).
3. chat-admin updates `conversations.last_message` for the snippet and
   fires the tenant's `webhook_url` (if configured) so FCM can push a
   notification.
4. The mobile SDK polls `/api/v1/conversations/<id>/messages` every 5s
   and picks up the new message from the HubSpot thread.

If steps 3 or 4 don't fire, check:

- `tenant.webhook_url` is set in `dashboard/webhooks/page.tsx`.
- HubSpot signature verification (X-HubSpot-Signature-V3) — failures
  log to Vercel function logs.
- The webhook URL on the Custom Channel matches your chat-admin host.
  Patch with `PATCH /conversations/v3/custom-channels/<id>` if not.

---

## 6. Sender identity recovery

Outbound messages from the app get a prefix:

```
**Dima Polskoy** [id:QJKefAKMgVTkT6gm93gLS6826Bv2]

Hi, my order is late
```

`lib/hubspot-conversations.ts::parseSenderFromBody` strips this on read
so the SDK sees the original `sender_user_id` even though HubSpot's
visitor actors are opaque `V-XXX` ids.

Agent replies arrive without this prefix (they're typed in HubSpot UI)
— the parser returns `senderUserId: null` and we route them through
`HUBSPOT_AGENT_SENDER_ID = "hubspot-agent"` so the SDK renders them as
incoming.

---

## Rollback

If something goes wrong after step 4:

```sql
update tenants
set hubspot_conversations_mode = false
where id = '<tenant-id>';
```

The route handlers branch on this flag, so flipping it back routes
writes/reads through the legacy Supabase+Tickets path again. The
existing Tickets+Notes data is untouched by the migration.
