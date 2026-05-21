-- Per-business iframe allowlist.
--
-- Replaces the EMBED_ALLOWED_ORIGINS env var as the source of truth
-- for which hosts can iframe /embed/widget and /embed/inbox. Each
-- business owns its own list, edited from /dashboard/settings/business.
--
-- We deliberately do NOT seed from the env var: the env list was
-- chat-wide and mixed origins from different tenants. Each business
-- must explicitly opt in to the hosts allowed to embed it.
--
-- The default empty array means: until a business adds at least one
-- origin, no host can embed it. That's the safe default — the
-- existing iframe on isrshipping.com will stop working at deploy
-- time unless that business adds its origin. Document this in the
-- deploy notes for round-3-allowlist.

alter table businesses
  add column if not exists allowed_origins text[] not null default '{}';

-- A CHECK constraint guarding origin format would help, but Postgres
-- doesn't support running a regex per-element on a text[] in a CHECK
-- cleanly. Validation lives in the server action that writes this
-- column (src/app/dashboard/_actions/businesses.ts).

comment on column businesses.allowed_origins is
  'Hosts allowed to iframe /embed/* for this business. ' ||
  'Origin strings like "https://example.com" (no trailing slash). ' ||
  'Driven by /dashboard/settings/business UI; not env-driven.';
