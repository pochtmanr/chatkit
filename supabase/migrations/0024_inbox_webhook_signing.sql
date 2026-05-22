-- =====================================================================
-- Inbox webhook signing + per-event opt-in (round 4, prompt 5).
--
-- Adds Stripe-style dual-secret HMAC signing to outbound webhooks.
-- Each inbox owns its own signing secret. `webhook_secret_previous`
-- enables a 24-hour rotation window during which signatures from
-- either secret verify. `webhook_events` is a per-inbox subscription
-- list so tenants can opt out of events they don't care about.
--
-- Also extends `webhook_deliveries` with `event_kind` and `payload`
-- so the dashboard's deliveries table can show the event name and a
-- payload drawer without joining a separate audit log.
-- =====================================================================

alter table inboxes
  add column if not exists webhook_secret              text,
  add column if not exists webhook_secret_previous     text,
  add column if not exists webhook_secret_rotated_at   timestamptz,
  add column if not exists webhook_events              text[] not null default
    array[
      'message_received',
      'conversation_status_changed',
      'conversation_assigned',
      'conversation_created'
    ];

-- Backfill: every existing inbox gets a fresh secret. New rows
-- inserted after this migration are expected to get a secret from
-- the server action that creates the inbox. We don't add NOT NULL
-- because legacy rows with no webhook configured may want to remain
-- "unsigned" if the URL is also null.
update inboxes
   set webhook_secret = encode(gen_random_bytes(32), 'base64')
 where webhook_secret is null;

-- A secret and its predecessor must differ — otherwise the dual-
-- signature header is degenerate and rotation served no purpose.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'inbox_webhook_secret_distinct'
  ) then
    alter table inboxes
      add constraint inbox_webhook_secret_distinct
      check (
        webhook_secret_previous is null
        or webhook_secret is null
        or webhook_secret <> webhook_secret_previous
      );
  end if;
end$$;

alter table webhook_deliveries
  add column if not exists event_kind text;

-- `webhook_deliveries.payload` already exists (jsonb not null) per
-- migration 0012. No change there.

comment on column inboxes.webhook_secret is
  '32-byte random base64 string used as HMAC-SHA256 key for outbound webhook signatures.';
comment on column inboxes.webhook_secret_previous is
  'Previous signing secret. Valid until 24h after webhook_secret_rotated_at unless explicitly discarded.';
comment on column inboxes.webhook_events is
  'Subset of event kinds this inbox subscribes to. Events not in the array are silently dropped before dispatch.';
comment on column webhook_deliveries.event_kind is
  'Event kind (e.g. message_received). Matches the discriminator in the payload jsonb.';
