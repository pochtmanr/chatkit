-- =====================================================================
-- Round 5 — keys and widget foundation.
--
-- Adds (1) per-inbox sk_live_ server secret hash columns with a 24h
-- rotation grace window, (2) per-inbox widget JWT signing key (HS256),
-- (3) auth_mode column (locked to 'authenticated' this round), (4)
-- support_agents.skills for routing, (5) conversation_start_options
-- and widget_config tables, and (6) conversations.start_option_id.
--
-- Applied via Supabase MCP (apply_migration) on 2026-05-22, alongside
-- a follow-up `0025b` that adds a column default to widget_signing_secret
-- so existing inbox-creation server actions don't need to know about it.
--
-- Constraint patterns mirror 0024_inbox_webhook_signing.sql.
-- =====================================================================

alter table inboxes
  add column if not exists server_secret_hash            text,
  add column if not exists server_secret_previous_hash   text,
  add column if not exists server_secret_rotated_at      timestamptz,
  add column if not exists widget_signing_secret         bytea,
  add column if not exists widget_signing_secret_previous bytea,
  add column if not exists auth_mode                     text not null
                                                          default 'authenticated';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'inboxes_auth_mode_check'
  ) then
    alter table inboxes
      add constraint inboxes_auth_mode_check
      check (auth_mode in ('authenticated'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'inbox_server_secret_distinct'
  ) then
    alter table inboxes
      add constraint inbox_server_secret_distinct
      check (
        server_secret_previous_hash is null
        or server_secret_hash is null
        or server_secret_hash <> server_secret_previous_hash
      );
  end if;
end$$;

update inboxes
   set widget_signing_secret = gen_random_bytes(32)
 where widget_signing_secret is null;

alter table inboxes
  alter column widget_signing_secret set not null;

-- Column-level default — applied in follow-up 0025b but kept here in
-- the local copy so a fresh clone applies both at once.
alter table inboxes
  alter column widget_signing_secret set default gen_random_bytes(32);

comment on column inboxes.server_secret_hash is
  'SHA-256(base64) of the sk_live_ raw key. Used by host backends to mint widget JWTs via POST /api/v1/widget-tokens.';
comment on column inboxes.server_secret_previous_hash is
  'Previous sk_live_ hash. Valid for 24h after server_secret_rotated_at.';
comment on column inboxes.widget_signing_secret is
  '32 random bytes — HS256 key for widget JWTs minted by this inbox.';
comment on column inboxes.widget_signing_secret_previous is
  'Previous widget signing key. Tokens signed with this key keep verifying until the column is cleared.';
comment on column inboxes.auth_mode is
  'Widget auth mode. Round 5 locks this to authenticated; round 6 will add anonymous.';

alter table support_agents
  add column if not exists skills text[] not null default '{}';

create index if not exists support_agents_skills_gin
  on support_agents using gin (skills);

comment on column support_agents.skills is
  'Free-form short tokens (billing, orders, returns). Used by the assignment trigger to match start_option.required_skills.';

create table if not exists conversation_start_options (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references businesses(id) on delete cascade,
  inbox_id          uuid not null references inboxes(id) on delete cascade,
  label             text not null,
  description       text,
  icon              text not null default 'message-circle',
  kind              text not null check (kind in ('support','order','direct')),
  required_skills   text[] not null default '{}',
  sort_order        int  not null default 0,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists conversation_start_options_lookup
  on conversation_start_options(inbox_id, is_active, sort_order)
  where is_active = true;

alter table conversation_start_options enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'conversation_start_options'
      and policyname = 'cso_owner_select'
  ) then
    create policy cso_owner_select
      on conversation_start_options for select
      using (
        (select auth.uid()) = (
          select owner_user_id from businesses
          where businesses.id = conversation_start_options.business_id
        )
      );
  end if;
end$$;

comment on table conversation_start_options is
  'Per-inbox topic picker entries shown to the customer when they click "Start a conversation". Selected entry id is stored on conversations.start_option_id.';

create table if not exists widget_config (
  business_id            uuid primary key references businesses(id) on delete cascade,
  primary_color          text not null default '#0F172A',
  roundness              text not null default 'rounded'
                         check (roundness in ('sharp','rounded','pill')),
  button_style           text not null default 'solid'
                         check (button_style in ('solid','outline','ghost')),
  bubble_style           text not null default 'rounded'
                         check (bubble_style in ('rounded','square','tail')),
  launcher_icon_url      text,
  launcher_icon_preset   text,
  greeting_message       text,
  updated_at             timestamptz not null default now()
);

alter table widget_config enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'widget_config'
      and policyname = 'widget_config_owner_select'
  ) then
    create policy widget_config_owner_select
      on widget_config for select
      using (
        (select auth.uid()) = (
          select owner_user_id from businesses
          where businesses.id = widget_config.business_id
        )
      );
  end if;
end$$;

comment on table widget_config is
  'One row per business. Controls customer-widget theming (color, roundness, button/bubble style, launcher icon, greeting). Edited via dashboard server actions.';

alter table conversations
  add column if not exists start_option_id uuid
    references conversation_start_options(id) on delete set null;

create index if not exists conversations_start_option_idx
  on conversations(start_option_id)
  where start_option_id is not null;

comment on column conversations.start_option_id is
  'Topic picker entry the customer selected when starting the conversation. Read by the assignment trigger to pull required_skills.';
