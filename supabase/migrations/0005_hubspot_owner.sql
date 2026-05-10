-- =====================================================================
-- holylabs-chat-sdk · HubSpot ticket owner
--
-- Tickets created without an owner don't trigger HubSpot's "ticket
-- assigned to me" notifications, so reps never hear about them. This
-- column stores which HubSpot user/team should own every relay-created
-- ticket. Set in chat-admin Settings; applied as `hubspot_owner_id`
-- when we POST /crm/v3/objects/tickets.
--
-- Run in Supabase Dashboard → SQL Editor (project tqekzwpaxvnkbluhkjql).
-- =====================================================================

alter table tenants
  add column if not exists hubspot_owner_id text;
