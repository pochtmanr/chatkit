begin;

-- Plans — global catalog. RLS enabled, read open to anon + authenticated;
-- writes are blocked (service role bypasses RLS for seeding/edits).
alter table plans enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'plans' and policyname = 'plans_public_read'
  ) then
    create policy plans_public_read
      on plans for select
      to anon, authenticated
      using (true);
  end if;
end $$;

-- Invoices — readable only by the owning business. Writes are server-only
-- (the Revolut webhook + checkout action go via the service role).
alter table invoices enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoices' and policyname = 'invoices_owner_read'
  ) then
    create policy invoices_owner_read
      on invoices for select
      to authenticated
      using (user_owns_business(business_id));
  end if;
end $$;

-- Billing events — same scoping as invoices. Append-only is enforced by
-- only granting select to client roles; the service role writes.
alter table billing_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'billing_events' and policyname = 'billing_events_owner_read'
  ) then
    create policy billing_events_owner_read
      on billing_events for select
      to authenticated
      using (business_id is not null and user_owns_business(business_id));
  end if;
end $$;

commit;
