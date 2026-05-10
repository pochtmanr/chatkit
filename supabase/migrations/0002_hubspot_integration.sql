-- =====================================================================
-- holylabs-chat-sdk · HubSpot integration
--
-- Adds the columns and lookup table needed to bridge a tenant's chat
-- conversations to a HubSpot Conversations Inbox / Service Hub tickets.
--
-- Architecture:
--   1. Tenant owner clicks "Connect HubSpot" in the dashboard.
--   2. We run the HubSpot OAuth flow and store the access + refresh
--      tokens on the tenant row.
--   3. When a chat user sends a message, the customer's Firebase Function
--      POSTs to /api/hubspot/relay on chat-admin, which forwards to
--      HubSpot using the tenant's stored token.
--   4. HubSpot fires a webhook on /api/hubspot/webhook when an admin
--      replies in HubSpot; we look up the conversation by external_ref
--      and write the reply back into the chat database.
--
-- Run in Supabase Dashboard → SQL Editor (project tqekzwpaxvnkbluhkjql).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tenant integration fields
-- ---------------------------------------------------------------------

-- 'native' = chat-only, no third-party bridge (default).
-- 'hubspot' = messages mirrored to HubSpot tickets / conversations.
alter table tenants
  add column if not exists integration_type text not null default 'native'
    check (integration_type in ('native', 'hubspot'));

-- HubSpot OAuth tokens. Stored encrypted at rest by Postgres TDE; we
-- still treat these as secrets and never return them to the client.
alter table tenants
  add column if not exists hubspot_access_token text,
  add column if not exists hubspot_refresh_token text,
  add column if not exists hubspot_token_expires_at timestamptz,
  -- HubSpot account id ("portal id"). Useful for building deep links
  -- back into the HubSpot UI from the admin dashboard.
  add column if not exists hubspot_portal_id text,
  -- Inbox we route incoming chat messages to. A HubSpot account can
  -- have multiple inboxes (Sales, Support, etc.); the tenant picks one
  -- after connecting.
  add column if not exists hubspot_inbox_id text,
  -- Webhook signing secret HubSpot generates per app. We verify
  -- inbound webhook requests against this.
  add column if not exists hubspot_webhook_secret text;

-- ---------------------------------------------------------------------
-- 2. Conversation ↔ HubSpot mapping
-- ---------------------------------------------------------------------
-- We could reuse the existing `external_ref` column on conversations,
-- but a tenant might want to bridge to multiple systems eventually
-- (HubSpot today, Zendesk later). Keeping a side-table makes that
-- additive instead of a schema migration each time.

create table if not exists conversation_hubspot_links (
  tenant_id uuid not null references tenants(id) on delete cascade,
  conversation_id uuid not null,
  -- HubSpot's conversation thread id (different from ticket id).
  -- This is what we POST messages to.
  hubspot_thread_id text not null,
  -- Optional: the ticket created from this conversation, if the
  -- tenant is using Service Hub tickets rather than just Inbox.
  hubspot_ticket_id text,
  created_at timestamptz not null default now(),
  primary key (tenant_id, conversation_id)
);
create index if not exists conversation_hubspot_links_thread_idx
  on conversation_hubspot_links(tenant_id, hubspot_thread_id);

-- Reverse index so the inbound webhook handler can find the
-- conversation by HubSpot thread id in O(log n).
create unique index if not exists conversation_hubspot_links_thread_unique
  on conversation_hubspot_links(tenant_id, hubspot_thread_id);
