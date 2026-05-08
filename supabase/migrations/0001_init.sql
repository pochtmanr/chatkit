-- =====================================================================
-- holylabs-chat-sdk · initial schema
-- Run this once in Supabase Dashboard → SQL Editor (project uhpuqiptxcjluwsetoev)
-- All chat data lives here. Multi-tenant via tenant_id; auth via Supabase
-- Auth (a tenant 'owner' is a row in auth.users).
-- =====================================================================

create extension if not exists "uuid-ossp";

-- ----- helper: enforce updated_at -----
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =====================================================================
-- Tenants — one row per customer of the SDK. Owner is the auth user that
-- signed up. The SDK identifies a tenant by its `api_key`.
-- =====================================================================
create table if not exists tenants (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  api_key text not null unique,
  webhook_url text,
  email_from text,
  plan text not null default 'starter' check (plan in ('free','starter','growth','scale','custom')),
  status text not null default 'active' check (status in ('active','overage','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tenants_owner_idx on tenants(owner_user_id);
create trigger tenants_updated_at before update on tenants
  for each row execute function set_updated_at();

-- =====================================================================
-- End-users — people in the customer's app (NOT auth.users). The client
-- writes user identity here so we can route messages and send emails.
-- =====================================================================
create table if not exists chat_users (
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id text not null,                              -- client's id, opaque to us
  name text,
  email text,
  role text not null default 'customer'
    check (role in ('customer','driver','admin','support')),
  fcm_tokens text[] not null default '{}',
  last_seen_at timestamptz,
  notification_prefs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create trigger chat_users_updated_at before update on chat_users
  for each row execute function set_updated_at();

-- =====================================================================
-- Conversations — abstract container. `kind` distinguishes order chats
-- (group, per-order) from support (1:1 admin chat). external_ref carries
-- the order id when kind='order'.
-- =====================================================================
create table if not exists conversations (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  kind text not null check (kind in ('order','support','direct')),
  external_ref text,                                  -- e.g. orderId
  participants text[] not null default '{}',           -- user_ids
  last_message text,
  last_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, kind, external_ref)
);
create index if not exists conv_tenant_kind_idx on conversations(tenant_id, kind);
create index if not exists conv_participants_gin on conversations using gin (participants);
create trigger conversations_updated_at before update on conversations
  for each row execute function set_updated_at();

-- =====================================================================
-- Messages — the actual chat content.
-- =====================================================================
create table if not exists messages (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id text not null,
  receiver_id text,
  body text,
  message_type text not null default 'text'
    check (message_type in ('text','image','file','system')),
  media_url text,
  read_by text[] not null default '{}',
  reply_to uuid references messages(id) on delete set null,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists msgs_conv_created_idx on messages(conversation_id, created_at desc);
create index if not exists msgs_tenant_idx on messages(tenant_id);

-- =====================================================================
-- FAQ items — dynamic, per-tenant, per-audience, per-language. Replaces
-- the hardcoded defaults that ship with the SDK.
-- =====================================================================
create table if not exists faq_items (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  audience text not null check (audience in ('customer','driver','admin','all')),
  language text not null default 'en',
  question text not null,
  answer text not null,
  category text,
  -- Optional deep-link the SDK can follow when the FAQ row is tapped
  -- (e.g. 'navigate://documents'). Renderer interprets it.
  action_href text,
  position integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists faq_lookup_idx
  on faq_items(tenant_id, audience, language, is_published, position);
create trigger faq_updated_at before update on faq_items
  for each row execute function set_updated_at();

-- =====================================================================
-- Quick links — same shape as FAQ but specifically for action shortcuts.
-- =====================================================================
create table if not exists quick_links (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  audience text not null check (audience in ('customer','driver','admin','all')),
  language text not null default 'en',
  label text not null,
  hint text,
  action_href text not null,
  position integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quick_links_lookup_idx
  on quick_links(tenant_id, audience, language, is_published, position);
create trigger quick_links_updated_at before update on quick_links
  for each row execute function set_updated_at();

-- =====================================================================
-- Billing meter — one row per tenant per month.
-- =====================================================================
create table if not exists chat_billing (
  tenant_id uuid not null references tenants(id) on delete cascade,
  period_key text not null,                           -- e.g. '2026-05'
  conversations_used int not null default 0,
  admin_seats_used int not null default 0,
  status text not null default 'active'
    check (status in ('active','overage','suspended')),
  seen_conversations text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (tenant_id, period_key)
);
create trigger chat_billing_updated_at before update on chat_billing
  for each row execute function set_updated_at();

-- =====================================================================
-- Row Level Security — every table is tenant-scoped. The dashboard's
-- authenticated user can only see/edit rows for tenants they own.
-- The SDK will use the service role (server-side) and gate by api_key
-- itself; client-side direct DB access is intentionally NOT supported.
-- =====================================================================
alter table tenants        enable row level security;
alter table chat_users     enable row level security;
alter table conversations  enable row level security;
alter table messages       enable row level security;
alter table faq_items      enable row level security;
alter table quick_links    enable row level security;
alter table chat_billing   enable row level security;

-- Tenants: an authed user can read/write their own tenants.
create policy tenants_owner_all on tenants
  for all
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- Helper: tenant ownership predicate used by every other policy.
create or replace function user_owns_tenant(t uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from tenants where id = t and owner_user_id = auth.uid()
  );
$$;

create policy chat_users_owner_all on chat_users
  for all to authenticated
  using (user_owns_tenant(tenant_id))
  with check (user_owns_tenant(tenant_id));

create policy conversations_owner_all on conversations
  for all to authenticated
  using (user_owns_tenant(tenant_id))
  with check (user_owns_tenant(tenant_id));

create policy messages_owner_all on messages
  for all to authenticated
  using (user_owns_tenant(tenant_id))
  with check (user_owns_tenant(tenant_id));

create policy faq_owner_all on faq_items
  for all to authenticated
  using (user_owns_tenant(tenant_id))
  with check (user_owns_tenant(tenant_id));

create policy quick_links_owner_all on quick_links
  for all to authenticated
  using (user_owns_tenant(tenant_id))
  with check (user_owns_tenant(tenant_id));

create policy chat_billing_owner_read on chat_billing
  for select to authenticated
  using (user_owns_tenant(tenant_id));

-- Anonymous read access for published FAQ + quick links so the SDK can
-- fetch them without exposing the service role to clients. Filtered by
-- api_key claim via a cookie/JWT custom claim in production (TODO).
-- For now, published rows are publicly readable — scope by tenant_id+lang.
create policy faq_public_read on faq_items
  for select to anon
  using (is_published = true);

create policy quick_links_public_read on quick_links
  for select to anon
  using (is_published = true);
