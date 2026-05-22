-- Support agents: non-owner humans who can work a business's inbox.
--
-- Round 4 introduces this table as the basis for invites (0022),
-- the Workbench queue (prompt 3), and auto-assignment (0023). Owners
-- remain implicit via businesses.owner_user_id; this table only
-- holds the "agent" and "lead" ranks. See round-4-workbench/0-shared.md
-- for the full mental model.

create table if not exists support_agents (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  business_id        uuid not null references businesses(id) on delete cascade,
  display_name       text not null,
  avatar_url         text,
  role               text not null default 'agent'
                     check (role in ('agent', 'lead')),
  status             text not null default 'offline'
                     check (status in ('online', 'away', 'offline')),
  status_changed_at  timestamptz not null default now(),
  invited_by         uuid references auth.users(id),
  invited_at         timestamptz not null default now(),
  accepted_at        timestamptz,
  archived_at        timestamptz,
  created_at         timestamptz not null default now(),
  unique (business_id, user_id)
);

create index if not exists support_agents_business_active_idx
  on support_agents (business_id)
  where archived_at is null;

create index if not exists support_agents_user_active_idx
  on support_agents (user_id)
  where archived_at is null;

create index if not exists support_agents_assignment_idx
  on support_agents (business_id, status)
  where archived_at is null and accepted_at is not null;

comment on table support_agents is
  'Support agents per business. role=agent works the queue; ' ||
  'role=lead also invites/revokes others. Owner is implicit via ' ||
  'businesses.owner_user_id and outranks lead.';

alter table support_agents enable row level security;

-- Service role bypasses RLS automatically; the policies below cover
-- the authenticated role. All writes go through server actions using
-- the service client, so we only need select policies here.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'support_agents'
      and policyname = 'support_agents_self_select'
  ) then
    create policy support_agents_self_select
      on support_agents for select
      using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'support_agents'
      and policyname = 'support_agents_owner_select'
  ) then
    create policy support_agents_owner_select
      on support_agents for select
      using (
        (select auth.uid()) = (
          select owner_user_id from businesses
          where businesses.id = support_agents.business_id
        )
      );
  end if;
end $$;

-- Avatars bucket: public read, writes scoped to <user_id>/<...> path.
-- Mirrors the round-3 business-logos bucket pattern (migration 0015)
-- but with the path-prefix RLS used by Supabase Storage RLS guides.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2 * 1024 * 1024,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'avatars_public_read'
  ) then
    create policy avatars_public_read
      on storage.objects for select
      using (bucket_id = 'avatars');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'avatars_owner_insert'
  ) then
    create policy avatars_owner_insert
      on storage.objects for insert
      with check (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = ((select auth.uid()))::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'avatars_owner_update'
  ) then
    create policy avatars_owner_update
      on storage.objects for update
      using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = ((select auth.uid()))::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'avatars_owner_delete'
  ) then
    create policy avatars_owner_delete
      on storage.objects for delete
      using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = ((select auth.uid()))::text
      );
  end if;
end $$;
