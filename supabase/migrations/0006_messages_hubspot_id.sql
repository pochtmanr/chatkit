-- =====================================================================
-- Allow tagging a message with the HubSpot message id it originated from.
-- Inbound webhook fires once per HubSpot message but can be redelivered;
-- we dedupe on this column so an admin reply only lands in the chat once.
-- =====================================================================
alter table messages
  add column if not exists hubspot_message_id text;

-- One row per tenant/hubspot_message_id pair when set. Two tenants could
-- conceivably see the same id from different HubSpot portals, so we scope
-- the uniqueness to tenant.
create unique index if not exists messages_tenant_hubspot_id_uniq
  on messages(tenant_id, hubspot_message_id)
  where hubspot_message_id is not null;
