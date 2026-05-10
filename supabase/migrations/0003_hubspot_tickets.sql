-- =====================================================================
-- holylabs-chat-sdk · HubSpot Tickets pivot
--
-- The original 0002 design assumed we'd push messages directly into a
-- HubSpot Conversations Inbox, but HubSpot's API doesn't allow creating
-- threads from outside a registered Custom Channel. Tickets work on
-- every paid tier and have a clean create/append API, so each chat
-- conversation now maps to exactly one HubSpot ticket.
--
-- Run in Supabase Dashboard → SQL Editor (project tqekzwpaxvnkbluhkjql).
-- =====================================================================

-- Allow the link row to exist with only a ticket id and no thread id.
alter table conversation_hubspot_links
  alter column hubspot_thread_id drop not null;

-- At least one of thread_id or ticket_id must be set, otherwise the
-- row carries no useful pointer.
alter table conversation_hubspot_links
  add constraint conversation_hubspot_links_has_target
  check (hubspot_thread_id is not null or hubspot_ticket_id is not null);

-- Index on ticket_id so the inbound webhook handler can resolve a
-- HubSpot ticket id back to (tenant, conversation) in O(log n).
create unique index if not exists conversation_hubspot_links_ticket_unique
  on conversation_hubspot_links(tenant_id, hubspot_ticket_id)
  where hubspot_ticket_id is not null;
