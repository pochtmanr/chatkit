begin;

alter table conversations
  add column if not exists status text not null default 'new'
    check (status in ('new','active','waiting_customer','waiting_support','done','transferred')),
  add column if not exists status_updated_at timestamptz not null default now(),
  add column if not exists transferred_note text;

-- Backfill: touch existing rows once so they aren't stranded on 'new'.
-- New rows get 'new' via the column default.
update conversations
   set status = case
     when last_at >= now() - interval '7 days' then 'active'
     else 'done'
   end,
   status_updated_at = coalesce(last_at, created_at)
 where status = 'new';

-- Index for the "open conversations" filter (everything except done).
create index if not exists conversations_open_idx
  on conversations(inbox_id, status_updated_at desc)
  where status <> 'done';

commit;
