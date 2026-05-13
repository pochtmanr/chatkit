-- =====================================================================
-- HubSpot Conversations API · Custom Channel setup
--
-- Stores the per-tenant Custom Channel + Channel Account ids needed to
-- route chat messages through HubSpot Conversations (Inbox) instead of
-- the Tickets+Notes bridge that 0002–0007 enabled.
--
-- See lib/hubspot-conversations.ts for how these are used.
-- =====================================================================

alter table tenants
  -- The Custom Channel id is app-wide (one per HubSpot dev app), not
  -- per portal, but we cache it on the tenant row so a runtime lookup
  -- doesn't need to call HubSpot just to know which channel to post
  -- to. Set on first connect; same value across all tenants of this app.
  add column if not exists hubspot_custom_channel_id text,
  -- Per-tenant ChannelAccount under that Custom Channel — this is what
  -- HubSpot routes by when fanning out incoming messages to agents.
  add column if not exists hubspot_channel_account_id text,
  -- The deliveryIdentifier we registered the ChannelAccount with.
  -- Used as the `recipient` value on every outbound publish call so the
  -- chat-admin server doesn't have to re-resolve it on each message.
  add column if not exists hubspot_channel_account_email text;

-- Conversations-API mode is selected separately from integration_type so
-- existing 'hubspot' (tickets) tenants don't get auto-flipped on this
-- migration. They opt-in by hitting the setup endpoint.
alter table tenants
  add column if not exists hubspot_conversations_mode boolean not null default false;
