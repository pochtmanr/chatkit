-- Invitations: pending offers to join a business as a support agent.
--
-- Round 4 prompt 2: a `lead` (or the owner) creates a row here, an email
-- ships out with `acceptUrl=/invite/<raw token>`, and the accept route
-- looks the row up by `sha256(raw token)`. Token rotation on resend is
-- deliberately *off* — leads can resend without invalidating live links
-- (see prompt 2 step 3). Schema mirrors round-4-workbench/0-shared.md §2.3.

create table if not exists invitations (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id) on delete cascade,
  email         text not null,
  display_name  text not null,
  role          text not null default 'agent' check (role in ('agent', 'lead')),
  token_hash    text not null unique,
  invited_by    uuid not null references auth.users(id),
  expires_at    timestamptz not null,
  accepted_at   timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists invitations_business_pending_idx
  on invitations (business_id, created_at desc)
  where accepted_at is null and revoked_at is null;

comment on table invitations is 'Pending support-agent invites. token_hash stores sha256(raw token, hex); the raw token never lands in the DB. accepted_at/revoked_at gate the state machine, expires_at gates time.';

alter table invitations enable row level security;

-- Service role (used by server actions) bypasses RLS. Authenticated callers
-- only need read access — and only to invites for businesses they own, so
-- the team-settings page can list pending invites.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'invitations'
      and policyname = 'invitations_owner_select'
  ) then
    create policy invitations_owner_select
      on invitations for select
      using (
        (select auth.uid()) = (
          select owner_user_id from businesses
          where businesses.id = invitations.business_id
        )
      );
  end if;
end $$;
