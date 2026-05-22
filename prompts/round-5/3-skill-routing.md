# 3 — Skill-tag routing

Read `AGENTS.md` and `0-shared.md` before starting. Independent
of prompts 1 and 2; only needs the 0-shared schema spec.

## Goal

Replace the kind-only round-robin from round 4 with skill-tag
routing. Agents declare their skills; conversation start options
declare required skills; `assign_conversation()` filters the
candidate pool by required skills (intersect/match), with a
graceful fallback when no skills are required.

After this prompt:

- Agents have a `skills text[]` column owners can edit from
  `/dashboard/settings/team`.
- The `assign_conversation()` SQL function filters
  `agent_presence_view` candidates by the conversation's
  required skills.
- A new conversation with `required_skills: ['billing']` only
  goes to an agent whose `skills @> ['billing']`.
- A conversation with no required skills routes to the
  unfiltered pool (today's behavior).

---

## Step 0 — Pre-flight

```bash
cat AGENTS.md
cat supabase/migrations/0023_assignment.sql      # the existing assign_conversation
grep -n 'support_agents' src/lib/team.ts          # current shape
ls supabase/migrations/                           # last entry should be 0024
```

If migration 0025 hasn't run yet, prompt 1 must run first — it
applies the migration with the `support_agents.skills` column
and (jointly) the `conversation_start_options.required_skills`
column. Coordinate so the migration is applied **once**, not
twice; prompt 1 is the canonical applier.

---

## Step 1 — Migration content (specified, not re-run)

Migration `0025_round5_keys_and_widget.sql` (applied by prompt 1)
must include these lines. Verify they're in place; do **not**
re-apply if 0025 already ran:

```sql
alter table support_agents
  add column if not exists skills text[] not null default '{}';

create index if not exists support_agents_skills_gin
  on support_agents using gin (skills);

-- (conversation_start_options table including required_skills text[]
-- is also in 0025 — see 0-shared.md §3.3.)
```

If prompt 1 has not yet run when you start, either coordinate
with the prompt-1 author or add the columns yourself **inside the
same migration file**. Never create a separate 0026 migration for
these columns — the round 5 contract is one migration.

---

## Step 2 — Read existing assignment logic

The function and triggers are in
`supabase/migrations/0023_assignment.sql`. Key facts:

- `agent_presence_view` already filters to `effective_status =
  'online'`, scoped by `business_id`, joined with archived/
  unaccepted exclusion.
- `assign_conversation(conv_id)` picks the least-loaded agent
  from that view.
- `tg_assign_after_insert` fires on `conversations` insert and
  filters to `kind = 'support'`. **Round 5 keeps this filter** —
  but the inner selector now considers required skills.

Goal: extend the **selector**, not the trigger guard. The trigger
keeps gating on `kind` and `status`; the selector reads
`required_skills` from the conversation row (sourced from the
`start_option_id` join) and filters candidates.

---

## Step 3 — New migration `0026_skill_routing.sql`

Replace `assign_conversation()` and add a one-time backfill.

Apply via Supabase MCP:

```
mcp__plugin_supabase_supabase__apply_migration name=0026_skill_routing query=<sql>
```

Migration body:

```sql
-- =====================================================================
-- 0026_skill_routing.sql
--
-- Round 5: extend assign_conversation() to filter candidates by the
-- required_skills of the conversation's start_option. Conversations
-- without a start_option (or whose start_option has empty
-- required_skills) keep today's behavior — unfiltered round-robin.
-- =====================================================================

create or replace function assign_conversation(conv_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id      uuid;
  v_required_skills  text[];
  v_chosen           uuid;
begin
  -- Resolve business id + the start option's required skills in one
  -- shot. left join because most conversations have no start_option_id.
  select
    coalesce(i.business_id, c.tenant_id),
    coalesce(o.required_skills, '{}')::text[]
    into v_business_id, v_required_skills
    from conversations c
    left join inboxes i  on i.id = c.inbox_id
    left join conversation_start_options o on o.id = c.start_option_id
   where c.id = conv_id;

  if v_business_id is null then
    return null;
  end if;

  -- Round 4 behavior preserved when no required skills: candidate
  -- pool is every online agent for the business. With required
  -- skills, restrict to agents whose skills array contains every
  -- required skill (@> = "contains").
  with candidates as (
    select
      v.id                            as agent_row_id,
      v.user_id                       as agent_user_id,
      coalesce(open_load.cnt, 0)      as open_count,
      v.last_assigned_at
    from agent_presence_view v
    join support_agents a on a.id = v.id
    left join lateral (
      select count(*) as cnt
        from conversations c2
       where c2.assigned_to = v.user_id
         and c2.status in ('active','waiting_customer','waiting_support')
    ) open_load on true
   where v.business_id = v_business_id
     and v.effective_status = 'online'
     and (
       cardinality(v_required_skills) = 0
       or a.skills @> v_required_skills
     )
  )
  select agent_user_id
    into v_chosen
    from candidates
   order by open_count asc nulls last,
            last_assigned_at asc nulls first,
            agent_user_id asc
   limit 1;

  -- Skill-match fallback policy: if a strict match returned no
  -- candidate, do NOT silently route to a non-matching agent. The
  -- conversation stays unassigned and surfaces in the Workbench
  -- Unassigned rail. Owners can claim it manually or expand the
  -- skill coverage.
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

-- Triggers from 0023 are unchanged; they call assign_conversation()
-- which now sees the new filter logic.

-- Add a comment so future maintainers understand the fallback.
comment on function assign_conversation(uuid) is
  'Round-robin assignment among online agents for the conversation''s ' ||
  'business. When start_option.required_skills is non-empty, candidates ' ||
  'must contain every required skill. No-match returns NULL (conversation ' ||
  'remains unassigned; surfaces in Workbench Unassigned rail).';
```

After applying:

```
mcp__plugin_supabase_supabase__generate_typescript_types
```

Regenerate `src/lib/supabase/database.types.ts`. Confirm
`support_agents.skills` and `conversation_start_options.required_skills`
appear in the regenerated types.

---

## Step 4 — Skills editor in the team settings page

Open `src/app/dashboard/settings/team/page.tsx` and the matching
client component (likely `TeamSettings.tsx` per the working tree
in this repo). Add a "Skills" column to the agent table.

Editor UX (minimal, owner-only):

- One row per agent. Each row shows existing skills as
  chips with an `x` to remove. A small text input + "Add"
  button to add a new skill.
- Skills are normalized to lower-kebab on save:
  `"Billing Issue"` → `"billing-issue"`. Reject empty strings.
- Cap: 16 skills per agent, ≤ 32 chars each.

Server action in `src/app/dashboard/_actions/agent-profile.ts`
(extend the existing file rather than create a new one — the
agent CRUD already lives there):

```ts
export async function setAgentSkills(input: {
  agentId: string;
  skills: string[];
}): Promise<ActionResult>;
```

Behavior:

- Resolve `activeBusinessId()`. `requireRole(businessId, 'lead')`
  — leads and owners can edit any agent's skills, agents
  cannot edit their own this round (round 6 polish).
- Validate `skills`: ≤ 16 unique entries; each matches
  `/^[a-z0-9][a-z0-9-]{0,31}$/`; reject anything else.
- `update support_agents set skills = $skills where id =
  agentId and business_id = businessId`.
- `revalidatePath('/dashboard/settings/team')`.

Render the UI inside the existing agents table. Keep it
compact — chips with rounded backgrounds (`bg-zinc-100`,
`text-zinc-700`, `px-2 py-0.5`).

---

## Step 5 — Surface in Workbench (read-only)

The Workbench should show each agent's skills as chips next to
their name in the status panel and in the assignee chip on a
conversation. This is read-only — no editing from Workbench.

Files to touch (paths from the existing repo state):

- `src/app/workbench/_components/StatusToggle.tsx` (or the
  equivalent presence component): under the agent's name, show
  up to 3 skill chips + a "+N" overflow.
- `src/app/workbench/[conversationId]/_components/` (whichever
  component shows the assignee header): same chip treatment.

Keep visual consistency with the dashboard team page — same
chip style and color tokens.

---

## Step 6 — Verification

```sql
-- 1. Agent with no skills, conversation with no required skills
--    → still assigned (regression check).
insert into conversations (tenant_id, inbox_id, kind, external_ref, participants)
values ('<biz>', '<inbox>', 'support', 'u_test_no_skills', array['u_test_no_skills']);
-- expect: assigned_to set to an online agent

-- 2. Conversation with required_skills=['billing'], only Alice has 'billing'
update conversation_start_options
   set required_skills = array['billing']
 where id = '<billing-option-id>';
update support_agents set skills = array['billing']  where display_name = 'Alice';
update support_agents set skills = array['orders']   where display_name = 'Bob';
-- ...insert a new conversation with start_option_id = '<billing-option-id>'
-- expect: assigned_to = Alice's user_id

-- 3. Same as 2, but Alice is offline → unassigned.
update support_agents set status='offline' where display_name='Alice';
-- ...insert conversation
-- expect: assigned_to = null; row surfaces in unassigned_or_stale_view

-- 4. required_skills = ['billing','vip']. Alice has ['billing'].
--    Carol has ['billing','vip']. → Carol.
update support_agents set skills = array['billing','vip'] where display_name='Carol';
-- ...insert conversation
-- expect: assigned_to = Carol
```

Run these against a Supabase preview branch via
`mcp__plugin_supabase_supabase__execute_sql`. Document each
result in the PR description.

Also browser-verify:

- Open `/dashboard/settings/team`. Add a `billing` skill to one
  agent. Reload — the chip persists.
- Open Workbench. The chip appears next to that agent's name.

---

## Step 7 — Out of scope

- **Topic picker UI.** Prompt 4.
- **Conversation start options CRUD UI.** Prompt 4. This prompt
  assumes prompt 4 will produce options; the migration spec
  comes from 0-shared.
- **Agent self-service skill editing.** Round 6.
- **Skill hierarchies / parent-child skills** (`billing/refunds`
  matching `billing`). Round 6 if there's demand.

---

## Definition of done

- [ ] Migration 0026 (or the skill section of 0025) applied via
      Supabase MCP. `assign_conversation()` body shows the
      required_skills filter.
- [ ] `database.types.ts` regenerated; `support_agents.skills`
      and `conversation_start_options.required_skills` typed.
- [ ] Dashboard team page lets owners/leads add and remove skill
      chips for each agent. Server action validates the chip
      format.
- [ ] Workbench surfaces each agent's skills next to their name
      and in the assignee chip on a conversation.
- [ ] The four verification SQL scenarios all pass against the
      preview branch.
- [ ] `wc -l` on every touched/created file ≤ 600.

End the PR description with the four verification result lines
and the `assign_conversation()` function comment.
