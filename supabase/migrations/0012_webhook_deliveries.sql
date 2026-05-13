-- =====================================================================
-- Webhook delivery log.
--
-- Records every outbound POST to a tenant's webhook_url so the
-- dashboard can show "sent / arrived / failed" for each event. Old
-- rows can be aged out periodically — we only render the last N on
-- the page anyway.
-- =====================================================================

create table if not exists webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  webhook_url text not null,
  event text not null,
  payload jsonb not null,
  -- 'pending' (in flight), 'success' (2xx), 'failed' (4xx/5xx/network)
  status text not null default 'pending'
    check (status in ('pending', 'success', 'failed')),
  response_code int,
  response_body text,
  error text,
  attempted_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists webhook_deliveries_tenant_attempt_idx
  on webhook_deliveries(tenant_id, attempted_at desc);

-- RLS on for safety — tenants only see their own rows via owner_user_id.
alter table webhook_deliveries enable row level security;
create policy webhook_deliveries_owner_select on webhook_deliveries
  for select using (
    exists (
      select 1 from tenants
      where tenants.id = webhook_deliveries.tenant_id
        and tenants.owner_user_id = auth.uid()
    )
  );
