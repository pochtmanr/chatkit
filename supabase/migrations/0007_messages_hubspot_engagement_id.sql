-- =====================================================================
-- Tag messages that originated from a HubSpot engagement (ticket note).
-- The inbound webhook fires per engagement create but can be redelivered,
-- so we dedupe on this column.
-- =====================================================================
alter table messages
  add column if not exists hubspot_engagement_id text;

create unique index if not exists messages_tenant_hubspot_engagement_uniq
  on messages(tenant_id, hubspot_engagement_id)
  where hubspot_engagement_id is not null;
