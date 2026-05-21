-- =====================================================================
-- 0013_multi_business_schema
-- Introduces businesses (renamed from tenants), projects, inboxes,
-- and profiles. Moves api_key + webhook_url off the business and
-- onto each inbox so every embed point is independent.
-- Caps accounts at 2 businesses per owner_user_id.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. Drop policies that name the old `tenants` table / helper so the
--    rename doesn't fail and the policies can be recreated cleanly.
-- ---------------------------------------------------------------------
drop policy if exists tenants_owner_all       on tenants;
drop policy if exists chat_users_owner_all    on chat_users;
drop policy if exists conversations_owner_all on conversations;
drop policy if exists messages_owner_all      on messages;
drop policy if exists faq_owner_all           on faq_items;
drop policy if exists faq_public_read         on faq_items;
drop policy if exists quick_links_owner_all   on quick_links;
drop policy if exists quick_links_public_read on quick_links;
drop policy if exists chat_billing_owner_read on chat_billing;
drop function if exists user_owns_tenant(uuid);

-- ---------------------------------------------------------------------
-- 1. Rename tenants -> businesses. Foreign keys on dependent tables
--    follow the rename automatically; the FK columns themselves stay
--    named `tenant_id` to minimise app-code churn. We can rename them
--    later if the inconsistency starts hurting.
-- ---------------------------------------------------------------------
alter table tenants rename to businesses;
alter index if exists tenants_owner_idx rename to businesses_owner_idx;
alter trigger tenants_updated_at on businesses rename to businesses_updated_at;

-- ---------------------------------------------------------------------
-- 2. New onboarding fields on businesses.
-- ---------------------------------------------------------------------
alter table businesses
  add column if not exists industry text,
  add column if not exists company_size text,
  add column if not exists onboarding_completed_at timestamptz;

alter table businesses
  add constraint businesses_company_size_check
    check (company_size is null or company_size in
           ('1-10','11-50','51-200','201-1000','1000+')),
  add constraint businesses_industry_check
    check (industry is null or industry in
           ('software_saas','ecommerce_retail','delivery_logistics',
            'healthcare','finance','education','media','manufacturing',
            'professional_services','other'));

-- ---------------------------------------------------------------------
-- 3. profiles — 1:1 with auth.users. Holds the user's self-declared
--    role from step 1 of the wizard. More fields can land here later.
-- ---------------------------------------------------------------------
create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text check (role in
    ('developer','founder_owner','designer','hr_people','ops',
     'marketer','sales','support','other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- 4. projects — children of a business.
-- ---------------------------------------------------------------------
create table if not exists projects (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, slug)
);
create index if not exists projects_business_idx on projects(business_id);
create trigger projects_updated_at before update on projects
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- 5. inboxes — children of a project. Each inbox is the integration
--    boundary: own api_key (pk_live_…), own webhook_url.
-- ---------------------------------------------------------------------
create table if not exists inboxes (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  -- Denormalised FK so RLS policies + api_key lookups don't have to
  -- join through projects every time.
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  slug text not null,
  purpose text not null check (purpose in
    ('customer_support','staff_ops','courier','warehouse',
     'contractor','sales','other')),
  audience text not null check (audience in ('customer','staff','partner')),
  api_key text not null unique,
  webhook_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, slug)
);
create index if not exists inboxes_project_idx  on inboxes(project_id);
create index if not exists inboxes_business_idx on inboxes(business_id);
create trigger inboxes_updated_at before update on inboxes
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- 6. Backfill — every existing business gets a default project +
--    default inbox carrying its old api_key/webhook_url. Existing
--    businesses are marked already-onboarded so they skip the modal.
-- ---------------------------------------------------------------------
insert into projects (business_id, name, slug, description)
select b.id, 'Workspace', 'workspace',
       'Default project created during multi-business migration.'
from businesses b
where not exists (
  select 1 from projects p where p.business_id = b.id
);

insert into inboxes (project_id, business_id, name, slug, purpose, audience, api_key, webhook_url)
select p.id, b.id, 'Main', 'main',
       'customer_support', 'customer', b.api_key, b.webhook_url
from businesses b
join projects p on p.business_id = b.id and p.slug = 'workspace'
where not exists (
  select 1 from inboxes i where i.business_id = b.id
);

update businesses
  set onboarding_completed_at = coalesce(onboarding_completed_at, now());

-- ---------------------------------------------------------------------
-- 7. Add inbox_id to conversations; backfill; tighten NOT NULL.
-- ---------------------------------------------------------------------
alter table conversations
  add column if not exists inbox_id uuid references inboxes(id);

update conversations c
  set inbox_id = i.id
  from inboxes i
  where i.business_id = c.tenant_id
    and i.slug = 'main'
    and c.inbox_id is null;

alter table conversations
  alter column inbox_id set not null;
create index if not exists conv_inbox_idx on conversations(inbox_id);

-- ---------------------------------------------------------------------
-- 8. faq_items / quick_links — nullable inbox_id so the schema is
--    ready for per-inbox FAQ in a later round. NULL means
--    business-wide (current behaviour).
-- ---------------------------------------------------------------------
alter table faq_items
  add column if not exists inbox_id uuid references inboxes(id);
alter table quick_links
  add column if not exists inbox_id uuid references inboxes(id);

-- ---------------------------------------------------------------------
-- 9. Drop the now-redundant api_key / webhook_url columns on
--    businesses (they live on each inbox).
-- ---------------------------------------------------------------------
alter table businesses
  drop column api_key,
  drop column webhook_url;

-- ---------------------------------------------------------------------
-- 10. RLS helpers — replace user_owns_tenant.
-- ---------------------------------------------------------------------
create or replace function user_owns_business(b uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from businesses
    where id = b and owner_user_id = auth.uid()
  );
$$;

create or replace function user_owns_inbox(i uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from inboxes ib
    join businesses b on b.id = ib.business_id
    where ib.id = i and b.owner_user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------
-- 11. RLS on new tables + recreate policies on existing ones.
-- ---------------------------------------------------------------------
alter table businesses enable row level security;
alter table profiles   enable row level security;
alter table projects   enable row level security;
alter table inboxes    enable row level security;

create policy businesses_owner_all on businesses
  for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy profiles_self_all on profiles
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy projects_owner_all on projects
  for all to authenticated
  using (user_owns_business(business_id))
  with check (user_owns_business(business_id));

create policy inboxes_owner_all on inboxes
  for all to authenticated
  using (user_owns_business(business_id))
  with check (user_owns_business(business_id));

create policy chat_users_owner_all on chat_users
  for all to authenticated
  using (user_owns_business(tenant_id))
  with check (user_owns_business(tenant_id));

create policy conversations_owner_all on conversations
  for all to authenticated
  using (user_owns_business(tenant_id))
  with check (user_owns_business(tenant_id));

create policy messages_owner_all on messages
  for all to authenticated
  using (user_owns_business(tenant_id))
  with check (user_owns_business(tenant_id));

create policy faq_owner_all on faq_items
  for all to authenticated
  using (user_owns_business(tenant_id))
  with check (user_owns_business(tenant_id));

create policy quick_links_owner_all on quick_links
  for all to authenticated
  using (user_owns_business(tenant_id))
  with check (user_owns_business(tenant_id));

create policy chat_billing_owner_read on chat_billing
  for select to authenticated
  using (user_owns_business(tenant_id));

create policy faq_public_read on faq_items
  for select to anon
  using (is_published = true);

create policy quick_links_public_read on quick_links
  for select to anon
  using (is_published = true);

-- ---------------------------------------------------------------------
-- 12. Cap at 2 businesses per owner_user_id.
-- ---------------------------------------------------------------------
create or replace function enforce_business_cap()
returns trigger as $$
declare
  current_count int;
begin
  select count(*) into current_count
  from businesses
  where owner_user_id = new.owner_user_id;
  if current_count >= 2 then
    raise exception 'business limit reached (max 2 per account)'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger businesses_cap_check
  before insert on businesses
  for each row execute function enforce_business_cap();

commit;
