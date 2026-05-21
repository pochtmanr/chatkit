begin;

-- 1. MCP access keys.
create table if not exists mcp_access_keys (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  key_prefix text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists mcp_access_keys_business_active_idx
  on mcp_access_keys(business_id) where revoked_at is null;
create index if not exists mcp_access_keys_prefix_active_idx
  on mcp_access_keys(key_prefix) where revoked_at is null;

-- 2. Deletion requests.
create table if not exists deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('business_data','account')),
  business_id uuid references businesses(id),
  requested_at timestamptz not null default now(),
  scheduled_at timestamptz not null,
  cancelled_at timestamptz,
  executed_at timestamptz,
  constraint deletion_requests_business_required
    check ((kind = 'business_data' and business_id is not null) or kind = 'account')
);
create index if not exists deletion_requests_due_idx
  on deletion_requests(scheduled_at)
  where executed_at is null and cancelled_at is null;

-- 3. Data export requests.
create table if not exists data_export_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  status text not null check (status in ('queued','ready','failed','expired')) default 'queued',
  download_url text,
  ready_at timestamptz,
  expires_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists data_export_requests_queued_idx
  on data_export_requests(created_at)
  where status = 'queued';

commit;
