-- =====================================================================
-- 0026_skill_routing.sql
--
-- Round 5: extend assign_conversation() to filter candidates by the
-- required_skills of the conversation's start_option. Conversations
-- without a start_option (or whose start_option has empty
-- required_skills) keep today's behavior — unfiltered round-robin.
--
-- Applied via Supabase MCP (apply_migration) on 2026-05-22.
-- =====================================================================

create or replace function assign_conversation(conv_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $func$
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
  -- Unassigned rail.
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
$func$;

revoke all on function assign_conversation(uuid) from public;
grant execute on function assign_conversation(uuid) to authenticated, service_role;

-- Triggers from 0023 are unchanged; they call assign_conversation()
-- which now sees the new filter logic.

comment on function assign_conversation(uuid) is 'Round-robin assignment among online agents for the conversation business. When start_option.required_skills is non-empty, candidates must contain every required skill. No-match returns NULL (conversation remains unassigned; surfaces in Workbench Unassigned rail).';
