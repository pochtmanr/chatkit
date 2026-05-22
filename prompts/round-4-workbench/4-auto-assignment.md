# 4 — Auto-assignment: column, function, triggers, re-pickup

Read `AGENTS.md` and `0-shared.md` before starting. Depends on
prompts 1 + 2 + 3 — agents exist, can sign in, and have a
Workbench to surface assignments in.

## Goal

When a new visitor conversation arrives (or transitions to
`waiting_support`) and no agent is assigned, the system picks an
online agent and assigns them. Manual claim/transfer from
prompt 3 stays. After 10 minutes without an outbound reply
from the assigned agent, the conversation surfaces in the
Unassigned pane (re-pickup flag) but the assignee stays set.

If zero agents are online: queue stays idle. No auto-replies, no
out-of-office flag. Founder-confirmed.

---

## Step 1 — Migration `0023_assignment.sql`

Create `supabase/migrations/0023_assignment.sql` with:

### 1a — Columns

Per `0-shared.md` §2.4:

```sql
alter table conversations
  add column if not exists assigned_to     uuid references auth.users(id) on delete set null,
  add column if not exists assigned_at     timestamptz,
  add column if not exists last_outbound_at timestamptz,
  add column if not exists reassign_after  timestamptz;

alter table support_agents
  add column if not exists last_assigned_at timestamptz;

create index if not exists conversations_assigned_idx
  on conversations(assigned_to, status_updated_at desc)
  where status not in ('done','transferred');

create index if not exists conversations_unassigned_idx
  on conversations(inbox_id, status_updated_at desc)
  where assigned_to is null and status in ('new','active','waiting_support');
```

### 1b — Backfill

Backfill `last_outbound_at` for existing conversations:

```sql
update conversations c
   set last_outbound_at = (
     select max(created_at)
       from messages m
      where m.conversation_id = c.id
        and m.direction = 'outbound'
   )
 where last_outbound_at is null;
```

(Adjust column names if `messages.direction` is actually called
something else — grep migration 0001.)

### 1c — Effective-status view

```sql
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
      then 'away'   -- stale heartbeat
    else a.status
  end as effective_status
from support_agents a
where a.archived_at is null
  and a.accepted_at is not null;

comment on view agent_presence_view is
  'support_agents with computed effective_status. ' ||
  '''online'' flips to ''away'' if status_changed_at is > 5 min old.';
```

### 1d — `assign_conversation()` function

```sql
create or replace function assign_conversation(conv_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_business_id uuid;
  v_chosen      uuid;
begin
  select b.id
    into v_business_id
    from conversations c
    join inboxes i on i.id = c.inbox_id
    join projects p on p.id = i.project_id
    join businesses b on b.id = p.business_id
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
```

### 1e — Triggers

```sql
create or replace function tg_assign_on_insert()
returns trigger
language plpgsql
as $$
begin
  if new.assigned_to is null
     and new.status in ('new','waiting_support') then
    -- We can't call assign_conversation here because new.id may
    -- not be visible yet for the lateral join. Defer to AFTER.
    null;
  end if;
  return new;
end;
$$;

create or replace function tg_assign_after_insert()
returns trigger
language plpgsql
as $$
begin
  if new.assigned_to is null
     and new.status in ('new','waiting_support') then
    perform assign_conversation(new.id);
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
begin
  if old.status is distinct from new.status
     and new.status in ('new','waiting_support')
     and new.assigned_to is null then
    perform assign_conversation(new.id);
  end if;
  return null;
end;
$$;

drop trigger if exists conversations_assign_after_update on conversations;
create trigger conversations_assign_after_update
  after update of status on conversations
  for each row
  execute function tg_assign_on_status_change();
```

### 1f — Outbound-reply tracking + reassign flag

The existing `messages` insert path (probably in a server
action under `src/app/api/embed/` or `src/app/dashboard/_actions/`)
must update `conversations.last_outbound_at` when the message
direction is outbound, and `reassign_after` when inbound and
the conversation has an assignee.

Choose: do this in SQL via a trigger (more robust) or in
application code (more visible). Pick **trigger** — outbound
messages happen from multiple code paths and a trigger
guarantees consistency.

```sql
create or replace function tg_update_reassign_on_message()
returns trigger
language plpgsql
as $$
begin
  if new.direction = 'outbound' then
    update conversations
       set last_outbound_at = new.created_at,
           reassign_after = null
     where id = new.conversation_id;
  elsif new.direction = 'inbound' then
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
```

Verify `messages.direction` is the actual column name. If it's
`role` or something else, adapt.

### 1g — Unassigned-or-stale view

```sql
create or replace view unassigned_or_stale_view as
select c.*
  from conversations c
 where (c.assigned_to is null
        and c.status in ('new','active','waiting_support'))
    or (c.reassign_after is not null
        and c.reassign_after < now()
        and c.status not in ('done','transferred'));
```

The Workbench's "Unassigned" pane query (built in prompt 3
against a hand-rolled fallback) should switch to this view in
this prompt's UI step (step 3).

---

## Step 2 — Remove the fallback in prompt 3's Workbench queries

Prompt 3 wrote the Workbench against a schema-shape check
(`hasAssignedTo`). With this migration applied, the column
exists. Update:

- `src/app/workbench/_components/QueueRail.tsx` (or the
  `loadQueues.ts` helper extracted in prompt 3) — switch
  "Unassigned" query to read from `unassigned_or_stale_view`.
- Delete the `hasAssignedTo` schema check helper and any
  fallback branches.
- `ClaimButton.tsx` — remove the "Assignment isn't enabled
  yet" error path.

Re-run the prompt 3 acceptance checks at the bottom of this
prompt to confirm nothing regressed.

---

## Step 3 — Server actions: claim/transfer use the new column directly

Update `src/app/workbench/_actions/claim.ts`:

- `claimConversation(id)` — straightforward UPDATE of
  `assigned_to` + `assigned_at`. Also clears `reassign_after`.
- `transferConversation(id, toUserId)` — same, plus verify
  `toUserId` is an accepted agent in the active business.
- `claimNextUnassigned()` — query
  `unassigned_or_stale_view` filtered by `business_id` (joined
  through inboxes), pick oldest, claim it. Return id.

No call to `assign_conversation()` here — these are manual
flows that bypass the round-robin.

---

## Step 4 — Webhook events for assignment changes

When `assigned_to` flips from null → user (assignment) or
user A → user B (transfer), fire a webhook to the inbox's
configured URL — **only if** the event is enabled in
`webhook_events` (which gets the column in prompt 5).

Prompt 5 hasn't shipped yet, so this prompt fires the event
unconditionally and prompt 5 wires the filter. Add the new
event type to `src/lib/tenant-webhook.ts`:

```ts
export interface ConversationAssignedPayload {
  event: "conversation_assigned";
  tenant_id: string;
  inbox_id: string;
  conversation_id: string;
  previous_agent_user_id: string | null;
  new_agent_user_id: string | null;        // null when unassigned (e.g. re-pickup expiry future)
  new_agent_display_name: string | null;
  new_agent_avatar_url: string | null;
  occurred_at: string;
}
```

Fire from the SQL trigger? No — webhooks must not block
inserts. Fire from the server actions
(`claimConversation` / `transferConversation`) and from a
small **outbox pattern** for the SQL trigger path: have
`tg_assign_after_insert` and `tg_assign_on_status_change`
insert a row into a `pending_webhooks` table when assignment
happens; a Vercel Cron route every 30s drains it.

Lightweight alternative: skip the outbox for round 4. The
auto-assignment trigger fires inside the transaction that
created/updated the conversation; we can move auto-assignment
out of SQL and into the same code path that inserts the
conversation — then `tenant-webhook` can fire from
application code.

**Choose**: keep the SQL trigger (more robust under future
direct-DB inserts), **plus** a Vercel Cron at
`/api/cron/auto-assignment-webhooks` that runs every 60s and
fires any unsent `conversation_assigned` webhooks recorded in
a new `pending_webhooks` table:

```sql
create table if not exists pending_webhooks (
  id              uuid primary key default uuid_generate_v4(),
  event_kind      text not null,
  inbox_id        uuid not null references inboxes(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  payload         jsonb not null,
  created_at      timestamptz not null default now(),
  sent_at         timestamptz,
  retry_count     int not null default 0
);
create index pending_webhooks_unsent on pending_webhooks(created_at)
  where sent_at is null;
```

The triggers append to `pending_webhooks`; the cron route
drains them in batches of 25 with the existing
`tenant-webhook.ts` fire helper.

Add to `vercel.json` (or `vercel.ts`):

```json
"crons": [
  { "path": "/api/cron/auto-assignment-webhooks", "schedule": "* * * * *" }
]
```

(One-minute schedule is fine — `webhook_deliveries` already
records each attempt.)

---

## Step 5 — Offline re-pickup behaviour

The `reassign_after` column lights up automatically via the
message trigger from step 1f. The Workbench surfaces it via
`unassigned_or_stale_view`. No extra UI in this prompt.

What's **not** in scope: auto-reassigning the conversation to
another agent after the 10-minute window. The brief decision is
"stay assigned, surface in Unassigned alongside its
assignee." Owners and other agents see the conversation in
Unassigned and can manually claim/transfer.

When another agent claims a stale conversation,
`reassign_after` clears and `assigned_to` swaps to the new
claimer. That's the existing `claimConversation` path — no
change needed.

---

## Step 6 — Visitor-side agent identity wiring

Prompt 1 added the API field `agent` to the embed conversation
endpoint but always returned `null` (with a TODO). With
`assigned_to` now present, complete the wiring:

- In whichever endpoint serves the conversation envelope
  (grep for the TODO from prompt 1), select
  `assigned_to`, and if non-null, call
  `getAssignedAgentSummary(business_id, assigned_to)`.
- Remove the TODO.

Verify on greenflagged.xyz:
1. Open the FAB widget as a visitor (anon browser profile).
2. In a separate session, an agent claims the conversation.
3. The widget refreshes (or the next message lands) — header
   updates to agent display name + avatar.

The widget already polls / subscribes to message updates;
agent identity rides on the conversation envelope which
refreshes alongside. If the envelope only loads once on widget
init, add a refetch on the existing "new message" Realtime
event. Don't introduce a new channel just for this.

---

## Step 7 — Acceptance

1. `pnpm typecheck` clean.
2. `pnpm lint` clean.
3. Migration applied. `\d conversations` shows the four new
   columns; `\d support_agents` shows `last_assigned_at`.
4. With two agents accepted and online (browsers A + B):
   - Visitor on greenflagged.xyz starts a new conversation
     (`pk_live_45f4942f494ae8a94da8aca3`).
   - Within < 1s, exactly one of A/B sees the conversation
     in "My Queue" (the other doesn't).
   - Visitor's widget shows the assigned agent's name +
     avatar.
   - `conversation_assigned` webhook fires within 60s
     (verify by checking `webhook_deliveries` table; or hit a
     `webhook.site` URL configured on the test inbox).
5. With one agent online and 5 incoming conversations
   back-to-back, the assigned agent's
   `support_agents.last_assigned_at` is the most recent for
   each, and the `count(open conversations)` ordering means
   the *second* agent (if brought online) gets the *next*
   conversation.
6. With zero agents online, a new conversation lands and
   stays in "Unassigned". When an agent flips to "Online",
   the conversation is **not** automatically assigned
   retroactively — they must claim it manually. (This is the
   intended trade-off; document in PR description.)
7. Re-pickup: assign conversation X to agent A. Visitor
   sends a message. Wait 11 minutes (or set
   `last_outbound_at` directly via SQL to simulate). Send
   another inbound message. `reassign_after` is now
   `now() + 10m`-ish. The conversation surfaces in
   Unassigned. Agent A is still the `assigned_to`. Another
   agent can claim it.

`wc -l`:

```bash
wc -l \
  supabase/migrations/0023_assignment.sql \
  src/app/workbench/_components/QueueRail.tsx \
  src/app/workbench/_actions/claim.ts \
  src/lib/tenant-webhook.ts \
  src/app/api/cron/auto-assignment-webhooks/route.ts \
  $(grep -rl "getAssignedAgentSummary\|TODO.*prompt 4" src/app/api/embed/)
```

≤ 600 each. The migration is dense — if it exceeds the cap,
split it into `0023_assignment.sql` (table + indexes + view)
and `0023b_assignment_function.sql` (function + triggers).
Both must apply atomically; document the ordering.

---

## Out of scope

- Skill-based routing — round 5+.
- Auto-reassign-on-offline (vs surface-in-queue) — round 5.
- Webhook event filtering / dual-secret signing — prompt 5.
- Realtime presence — round 5.

Hand off to prompt 5.
