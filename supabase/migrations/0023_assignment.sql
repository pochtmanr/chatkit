-- Conversation assignment plumbing for round-4 Workbench.
--
-- Adds nullable `assigned_to` + bookkeeping columns on conversations,
-- a `last_assigned_at` round-robin column on support_agents, an
-- `agent_presence_view` with the 5-minute staleness rule from
-- 0-shared.md §4, the `assign_conversation()` selector function,
-- BEFORE/AFTER triggers on conversations (insert + status change)
-- that auto-assign, a messages trigger that maintains
-- `last_outbound_at` / `reassign_after`, an `unassigned_or_stale_view`
-- the Workbench rail queries, and the `pending_webhooks` outbox the
-- /api/cron/auto-assignment-webhooks route drains.
--
-- IMPORTANT: messages has no `direction` column in this schema. The
-- trigger derives direction from sender_id (legacy 'agent' /
-- 'agent-<uuid>' = outbound, anything else = inbound), matching the
-- check in src/lib/tenant-webhook.ts.

-- ---------------------------------------------------------------------
-- 1. Columns + indexes.
-- ---------------------------------------------------------------------
alter table conversations
  add column if not exists assigned_to       uuid references auth.users(id) on delete set null,
  add column if not exists assigned_at       timestamptz,
  add column if not exists last_outbound_at  timestamptz,
  add column if not exists reassign_after    timestamptz;

alter table support_agents
  add column if not exists last_assigned_at  timestamptz;

create index if not exists conversations_assigned_idx
  on conversations(assigned_to, status_updated_at desc)
  where status not in ('done','transferred');

create index if not exists conversations_unassigned_idx
  on conversations(inbox_id, status_updated_at desc)
  where assigned_to is null and status in ('new','active','waiting_support');

-- Backfill last_outbound_at from the historical messages table. The
-- legacy schema has no `direction` column; we treat sender_id starting
-- with 'agent' as outbound (mirrors fireTenantWebhook's isAgent check).
update conversations c
   set last_outbound_at = (
     select max(created_at)
       from messages m
      where m.conversation_id = c.id
        and m.deleted_at is null
        and (m.sender_id = 'agent' or m.sender_id like 'agent-%')
   )
 where last_outbound_at is null;

-- ---------------------------------------------------------------------
-- 2. Effective-status view. status='online' older than 5 minutes
--    silently degrades to 'away' so the assignment selector doesn't
--    route to a tab that closed.
-- ---------------------------------------------------------------------
create or replace view agent_presence_view as
select
  a.id,
  a.user_id,
  a.business_id,
  a.role,
  a.display_name,
  a.avatar_url,
  a.status,
  a.status_changed_at,
  a.last_assigned_at,
  case
    when a.status = 'online'
     and now() - a.status_changed_at < interval '5 minutes'
      then 'online'
    when a.status = 'online'
      then 'away'
    else a.status
  end as effective_status
from support_agents a
where a.archived_at is null
  and a.accepted_at is not null;

comment on view agent_presence_view is
  'support_agents joined with computed effective_status. ' ||
  'status=online flips to away when status_changed_at > 5 minutes old.';

-- ---------------------------------------------------------------------
-- 3. Selector: least-loaded round-robin among online agents.
-- ---------------------------------------------------------------------
create or replace function assign_conversation(conv_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_chosen      uuid;
begin
  -- conversations.tenant_id IS the business id (legacy column name);
  -- inboxes.business_id matches, so join through inboxes for safety
  -- but fall back to tenant_id if the inbox row was archived.
  select coalesce(i.business_id, c.tenant_id)
    into v_business_id
    from conversations c
    left join inboxes i on i.id = c.inbox_id
   where c.id = conv_id;

  if v_business_id is null then
    return null;
  end if;

  with candidates as (
    select
      v.id                            as agent_row_id,
      v.user_id                       as agent_user_id,
      coalesce(open_load.cnt, 0)      as open_count,
      v.last_assigned_at
    from agent_presence_view v
    left join lateral (
      select count(*) as cnt
        from conversations c2
       where c2.assigned_to = v.user_id
         and c2.status in ('active','waiting_customer','waiting_support')
    ) open_load on true
   where v.business_id = v_business_id
     and v.effective_status = 'online'
  )
  select agent_user_id
    into v_chosen
    from candidates
   order by open_count asc nulls last,
            last_assigned_at asc nulls first,
            agent_user_id asc
   limit 1;

  if v_chosen is null then
    return null;
  end if;

  update conversations
     set assigned_to = v_chosen,
         assigned_at = now()
   where id = conv_id;

  update support_agents
     set last_assigned_at = now()
   where business_id = v_business_id
     and user_id = v_chosen;

  return v_chosen;
end;
$$;

revoke all on function assign_conversation(uuid) from public;
grant execute on function assign_conversation(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4. Auto-assignment triggers. The webhook outbox row is inserted in
--    the same trigger so the cron drainer can ship a
--    conversation_assigned event regardless of which code path
--    created the conversation.
-- ---------------------------------------------------------------------

-- Outbox table for assignment webhooks. Insert is cheap; the cron
-- route at /api/cron/auto-assignment-webhooks drains in batches.
create table if not exists pending_webhooks (
  id              uuid primary key default gen_random_uuid(),
  event_kind      text not null,
  inbox_id        uuid not null references inboxes(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  payload         jsonb not null,
  created_at      timestamptz not null default now(),
  sent_at         timestamptz,
  retry_count     int not null default 0,
  last_error      text
);
create index if not exists pending_webhooks_unsent_idx
  on pending_webhooks(created_at)
  where sent_at is null;

create or replace function tg_enqueue_assignment_webhook(
  p_conversation_id uuid,
  p_previous        uuid,
  p_new             uuid
) returns void
language plpgsql
as $$
declare
  v_inbox_id     uuid;
  v_display_name text;
  v_avatar_url   text;
  v_business_id  uuid;
begin
  select c.inbox_id, coalesce(i.business_id, c.tenant_id)
    into v_inbox_id, v_business_id
    from conversations c
    left join inboxes i on i.id = c.inbox_id
   where c.id = p_conversation_id;
  if v_inbox_id is null then return; end if;

  if p_new is not null then
    select a.display_name, a.avatar_url
      into v_display_name, v_avatar_url
      from support_agents a
     where a.business_id = v_business_id
       and a.user_id = p_new
       and a.archived_at is null;
  end if;

  insert into pending_webhooks (event_kind, inbox_id, conversation_id, payload)
  values (
    'conversation_assigned',
    v_inbox_id,
    p_conversation_id,
    jsonb_build_object(
      'event', 'conversation_assigned',
      'tenant_id', v_business_id,
      'inbox_id', v_inbox_id,
      'conversation_id', p_conversation_id,
      'previous_agent_user_id', p_previous,
      'new_agent_user_id', p_new,
      'new_agent_display_name', v_display_name,
      'new_agent_avatar_url', v_avatar_url,
      'occurred_at', now()
    )
  );
end;
$$;

create or replace function tg_assign_after_insert()
returns trigger
language plpgsql
as $$
declare
  v_new_assignee uuid;
begin
  if new.assigned_to is null
     and new.status in ('new','waiting_support')
     and new.kind = 'support' then
    v_new_assignee := assign_conversation(new.id);
    if v_new_assignee is not null then
      perform tg_enqueue_assignment_webhook(new.id, null, v_new_assignee);
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists conversations_assign_after_insert on conversations;
create trigger conversations_assign_after_insert
  after insert on conversations
  for each row
  execute function tg_assign_after_insert();

create or replace function tg_assign_on_status_change()
returns trigger
language plpgsql
as $$
declare
  v_new_assignee uuid;
begin
  if old.status is distinct from new.status
     and new.status in ('new','waiting_support')
     and new.assigned_to is null
     and new.kind = 'support' then
    v_new_assignee := assign_conversation(new.id);
    if v_new_assignee is not null then
      perform tg_enqueue_assignment_webhook(new.id, null, v_new_assignee);
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists conversations_assign_after_update on conversations;
create trigger conversations_assign_after_update
  after update of status on conversations
  for each row
  execute function tg_assign_on_status_change();

-- ---------------------------------------------------------------------
-- 5. Messages trigger — maintain last_outbound_at and reassign_after.
--    Direction inferred from sender_id (no `direction` column in this
--    schema; legacy convention is 'agent' / 'agent-<id>' for outbound).
-- ---------------------------------------------------------------------
create or replace function tg_update_reassign_on_message()
returns trigger
language plpgsql
as $$
declare
  v_is_outbound boolean;
begin
  v_is_outbound := new.sender_id = 'agent' or new.sender_id like 'agent-%';
  if v_is_outbound then
    update conversations
       set last_outbound_at = new.created_at,
           reassign_after   = null
     where id = new.conversation_id;
  else
    update conversations
       set reassign_after = case
             when assigned_to is null then null
             when last_outbound_at is null
                  or last_outbound_at < now() - interval '10 minutes'
               then now() + interval '10 minutes'
             else reassign_after
           end
     where id = new.conversation_id;
  end if;
  return null;
end;
$$;

drop trigger if exists messages_update_reassign on messages;
create trigger messages_update_reassign
  after insert on messages
  for each row
  execute function tg_update_reassign_on_message();

-- ---------------------------------------------------------------------
-- 6. View: unassigned + stale-assigned. Workbench's "Unassigned" rail
--    queries this so a stale-assigned conversation surfaces alongside
--    its (still-set) assignee.
-- ---------------------------------------------------------------------
create or replace view unassigned_or_stale_view as
select c.*
  from conversations c
 where (c.assigned_to is null
        and c.status in ('new','active','waiting_support'))
    or (c.reassign_after is not null
        and c.reassign_after < now()
        and c.status not in ('done','transferred'));

comment on view unassigned_or_stale_view is
  'Conversations that should appear in the Workbench Unassigned rail: ' ||
  'either no assignee, or assignee has been idle past reassign_after.';
