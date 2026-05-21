begin;

-- 1. Plans catalogue.
create table if not exists plans (
  id text primary key,
  name text not null,
  monthly_price_cents int not null,
  currency text not null default 'GBP',
  max_businesses int not null,
  max_inboxes_per_business int not null,
  max_conversations_per_month int not null,
  features jsonb not null default '{}'::jsonb,
  is_public boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Placeholder seed. monthly_price_cents for paid tiers is left at 0 and
-- marked in the features.todo flag; replace before going live.
insert into plans (id, name, monthly_price_cents, currency, max_businesses, max_inboxes_per_business, max_conversations_per_month, features, sort_order)
values
  ('free',    'Free',    0, 'GBP', 2, 2,   500,    '{"todo": false}'::jsonb, 0),
  ('starter', 'Starter', 0, 'GBP', 2, 5,   5000,   '{"todo": "set price"}'::jsonb, 1),
  ('growth',  'Growth',  0, 'GBP', 2, 20,  50000,  '{"todo": "set price"}'::jsonb, 2),
  ('scale',   'Scale',   0, 'GBP', 2, 100, 500000, '{"todo": "set price"}'::jsonb, 3)
on conflict (id) do nothing;

-- 2. Billing columns on businesses.
alter table businesses
  add column if not exists current_plan_id        text not null default 'free' references plans(id),
  add column if not exists plan_renews_at         timestamptz,
  add column if not exists revolut_customer_id    text,
  add column if not exists revolut_subscription_id text;

-- Backfill current_plan_id from the legacy `plan` text column where it
-- matches a known plan id.
update businesses b
   set current_plan_id = b.plan
 where b.plan in (select id from plans)
   and b.current_plan_id = 'free';

-- 3. Invoices.
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  plan_id text not null references plans(id),
  amount_cents int not null,
  currency text not null default 'GBP',
  status text not null check (status in ('draft','open','paid','failed','refunded')),
  revolut_order_id text,
  revolut_payment_id text,
  paid_at timestamptz,
  period_start date not null,
  period_end date not null,
  hosted_invoice_url text,
  created_at timestamptz not null default now()
);
create index if not exists invoices_business_idx
  on invoices(business_id, created_at desc);
create unique index if not exists invoices_revolut_order_uidx
  on invoices(revolut_order_id) where revolut_order_id is not null;

-- 4. Billing events (append-only).
create table if not exists billing_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete set null,
  kind text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists billing_events_business_idx
  on billing_events(business_id, created_at desc);

-- 5. Inbox-cap trigger. Reads the business's current plan and enforces
--    max_inboxes_per_business. Counts only non-archived rows.
create or replace function enforce_inbox_cap() returns trigger language plpgsql as $$
declare
  cap int;
  current_count int;
  plan_id text;
begin
  select b.current_plan_id into plan_id from businesses b where b.id = new.business_id;
  select p.max_inboxes_per_business into cap from plans p where p.id = plan_id;

  if cap is null then
    return new;
  end if;

  select count(*) into current_count
    from inboxes
   where business_id = new.business_id
     and archived_at is null
     and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if current_count >= cap then
    raise exception 'inbox limit reached for plan: %', plan_id using errcode = 'P0001';
  end if;

  return new;
end $$;

drop trigger if exists inboxes_cap_check on inboxes;
create trigger inboxes_cap_check
  before insert on inboxes
  for each row execute function enforce_inbox_cap();

-- 6. Helpful index for the per-month conversation cap (consumed by an
--    out-of-band job in a future round).
create index if not exists conversations_month_idx
  on conversations(tenant_id, created_at);

commit;
