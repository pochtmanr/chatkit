-- =====================================================================
-- One-time-migration support: idempotency columns for importing the
-- pre-existing chat history out of Firestore.
--
-- We tag each migrated conversation + message with its Firestore origin
-- id so the migration script can be safely re-run without creating
-- duplicates (ON CONFLICT DO NOTHING via the unique indexes).
--
-- Once the migration finishes for good these columns can stay (handy
-- as an audit trail) or be dropped — they aren't read at runtime by
-- any production code path.
-- =====================================================================

alter table conversations
  add column if not exists firestore_id text;

alter table messages
  add column if not exists firestore_id text;

-- Per-tenant uniqueness — different tenants might legitimately have
-- the same Firestore document id if they share a Firebase project.
create unique index if not exists conversations_tenant_firestore_uniq
  on conversations(tenant_id, firestore_id)
  where firestore_id is not null;

create unique index if not exists messages_tenant_firestore_uniq
  on messages(tenant_id, firestore_id)
  where firestore_id is not null;
