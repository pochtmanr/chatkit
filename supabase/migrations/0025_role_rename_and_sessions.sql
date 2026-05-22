-- Round 5: rename lead -> manager + agent_sessions timeline table.
--
-- Background
--   The third tier in the role hierarchy was originally called "lead" so it
--   would read naturally next to "agent". Product language has since
--   settled on Admin / Manager / Agent, so this migration renames the
--   stored role values from 'lead' to 'manager' in both support_agents
--   and invitations. Admin stays implicit via businesses.owner_user_id.
--
--   It also introduces agent_sessions, which records each contiguous
--   "online" interval an agent worked. The Workbench's Agent Hub popover
--   and the new manager-facing /dashboard/team timeline both read from
--   this table.

-- 1. Rename existing rows from 'lead' to 'manager'.

alter table support_agents drop constraint if exists support_agents_role_check;
update support_agents set role = 'manager' where role = 'lead';
alter table support_agents
  add constraint support_agents_role_check
  check (role in ('agent', 'manager'));

alter table invitations drop constraint if exists invitations_role_check;
update invitations set role = 'manager' where role = 'lead';
alter table invitations
  add constraint invitations_role_check
  check (role in ('agent', 'manager'));

-- Update the table comment to match the new vocabulary.
comment on table support_agents is
  'Support agents per business. role=agent works the queue; ' ||
  'role=manager also invites/revokes, manages schedules, and sees the ' ||
  'team timeline. Admin is implicit via businesses.owner_user_id and ' ||
  'outranks manager.';

-- 2. agent_sessions: one row per "online" interval.

create table if not exists agent_sessions (
  id                 uuid primary key default gen_random_uuid(),
  support_agent_id   uuid not null references support_agents(id) on delete cascade,
  business_id        uuid not null references businesses(id) on delete cascade,
  started_at         timestamptz not null default now(),
  ended_at           timestamptz,
  -- Status the agent was in when this row was opened. Today this is
  -- always 'online' (the only assignable state), but the column is here
  -- so future shifts (e.g. 'busy', 'in-meeting') can ride on the same
  -- mechanism without a schema change.
  status             text not null default 'online'
                     check (status in ('online')),
  -- 'manual' = closed by the agent flipping status; 'stale' = closed by
  -- the workbench staleness sweeper after a missed heartbeat;
  -- 'transition' = closed by an automatic state transition (e.g.
  -- archived). Null while the session is still open.
  ended_reason       text check (ended_reason in ('manual', 'stale', 'transition')),
  created_at         timestamptz not null default now()
);

create index if not exists agent_sessions_business_started_idx
  on agent_sessions (business_id, started_at desc);

create index if not exists agent_sessions_agent_started_idx
  on agent_sessions (support_agent_id, started_at desc);

-- Partial index for the "find this agent's currently-open session" lookup
-- that setStatus + the sweeper both perform on every status change.
create index if not exists agent_sessions_open_idx
  on agent_sessions (support_agent_id)
  where ended_at is null;

comment on table agent_sessions is
  'Online-time intervals per support agent. Opened when the agent flips ' ||
  'their status to online; closed by manual flip, the 5-min staleness ' ||
  'sweep, or automatic state transitions. Reads back as the agent''s ' ||
  'shift history.';

alter table agent_sessions enable row level security;

-- All writes go through server actions with the service role; SELECT
-- policies cover authenticated reads. An agent can see their own
-- sessions; admins (business owners) can see every session in their
-- business.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'agent_sessions'
      and policyname = 'agent_sessions_self_select'
  ) then
    create policy agent_sessions_self_select
      on agent_sessions for select
      using (
        support_agent_id in (
          select id from support_agents
          where user_id = (select auth.uid())
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'agent_sessions'
      and policyname = 'agent_sessions_admin_select'
  ) then
    create policy agent_sessions_admin_select
      on agent_sessions for select
      using (
        (select auth.uid()) = (
          select owner_user_id from businesses
          where businesses.id = agent_sessions.business_id
        )
      );
  end if;
end $$;
