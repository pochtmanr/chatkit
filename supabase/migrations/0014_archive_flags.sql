-- =====================================================================
-- 0014_archive_flags
-- Soft-delete columns on projects + inboxes. Archived rows are hidden
-- from switchers and tab lists; conversations attached to archived
-- inboxes remain readable.
-- =====================================================================

begin;
alter table projects add column if not exists archived_at timestamptz;
alter table inboxes  add column if not exists archived_at timestamptz;
create index if not exists projects_active_idx on projects(business_id) where archived_at is null;
create index if not exists inboxes_active_idx  on inboxes(business_id)  where archived_at is null;
commit;
