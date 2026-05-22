# 0 — Shared contracts for round 4

Every prompt in this folder depends on the contracts on this page.
Read this once at the start of your session; the individual prompts
assume you've absorbed it and will not restate the rules.

This document is **specification, not implementation**. The
prompts that follow reference these names and shapes; if you
deviate here, every later prompt breaks.

---

## 1. The mental model

Round 4 introduces **support agents**: non-owner humans who can
work an inbox without seeing billing, MCP, business profile, or
allowlist settings. The owner remains the only person who can
invite agents, change plans, rotate webhook secrets, or edit
business profile fields.

Three relationships matter:

```
auth.users  ──┬──< businesses (owner_user_id)              # round 1
              │
              └──< support_agents >── businesses           # round 4
                                       │
conversations >── inboxes >── projects >── businesses     # round 1
            │
            └── assigned_to: auth.users.id (nullable)     # round 4
```

A human can be the **owner** of business A *and* a **support
agent** for business B at the same time — different rows, same
`auth.users.id`. The dashboard's active-context cookie
(`src/lib/active-context.ts`) decides which business they're
acting on right now.

---

## 2. The schema (final shape — round 4 will create exactly this)

### 2.1 `support_agents` (migration 0021, prompt 1)

```sql
create table support_agents (
  id                 uuid primary key default uuid_generate_v4(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  business_id        uuid not null references businesses(id) on delete cascade,
  display_name       text not null,
  avatar_url         text,                         -- public URL in `avatars` bucket; null = use initials
  role               text not null default 'agent'
                     check (role in ('agent','lead')),
  status             text not null default 'offline'
                     check (status in ('online','away','offline')),
  status_changed_at  timestamptz not null default now(),
  invited_by         uuid references auth.users(id),
  invited_at         timestamptz not null default now(),
  accepted_at        timestamptz,                  -- null = pending invite
  archived_at        timestamptz,
  created_at         timestamptz not null default now(),
  unique (business_id, user_id)
);
```

Indexes:
- `(business_id) where archived_at is null` — list active agents per business.
- `(user_id) where archived_at is null` — answer "what businesses
  do I agent for?" without scanning.
- `(business_id, status) where archived_at is null and accepted_at is not null`
  — assignment trigger's hot path.

RLS:
- Service-role bypass (used by server actions).
- `select` for the agent themselves: `auth.uid() = user_id`.
- `select` for the business owner: `auth.uid() = (select owner_user_id from businesses where id = business_id)`.
- All writes go through server actions; no direct insert/update RLS.

Role meaning:
- `agent` — sees and works the queue.
- `lead` — same plus can invite/revoke other agents in the same
  business. The owner is implicitly above `lead`. `lead` is the
  scaffolding for future delegated admin; round 4 only checks
  it where prompt 2 specifies.

### 2.2 `avatars` storage bucket (prompt 1)

Public read, writes RLS-scoped to `auth.uid() = (storage path's
first segment)`. Path layout: `<user_id>/<filename>`. Reuses the
exact pattern from the round-3 `logos` bucket — see
`src/app/dashboard/_components/ui/BusinessLogoUploader.tsx`.

### 2.3 `invitations` (migration 0022, prompt 2)

```sql
create table invitations (
  id            uuid primary key default uuid_generate_v4(),
  business_id   uuid not null references businesses(id) on delete cascade,
  email         text not null,
  display_name  text not null,
  role          text not null default 'agent' check (role in ('agent','lead')),
  token_hash    text not null unique,             -- SHA-256 hex of the raw token
  invited_by    uuid not null references auth.users(id),
  expires_at    timestamptz not null,             -- created_at + interval '7 days'
  accepted_at   timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index invitations_business_pending_idx
  on invitations(business_id, created_at desc)
  where accepted_at is null and revoked_at is null;
```

Token format: `inv_` + 32 hex chars (16 bytes), generated with
`crypto.randomBytes(16).toString('hex')`. Raw token is only ever
in the email URL and the success response of the invite action;
the DB stores `sha256(token)` hex.

### 2.4 `conversations.assigned_to` + assignment plumbing (migration 0023, prompt 4)

```sql
alter table conversations
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists assigned_at timestamptz,
  add column if not exists last_outbound_at timestamptz,        -- last reply by the assigned agent
  add column if not exists reassign_after timestamptz;          -- "if no agent reply by this time, surface in Unassigned"

create index conversations_assigned_idx
  on conversations(assigned_to, status_updated_at desc)
  where status not in ('done','transferred');

create index conversations_unassigned_idx
  on conversations(inbox_id, status_updated_at desc)
  where assigned_to is null and status in ('new','active','waiting_support');

alter table support_agents
  add column if not exists last_assigned_at timestamptz;        -- round-robin tie-break
```

`assign_conversation(uuid)` Postgres function + insert/update
triggers are specified in prompt 4.

### 2.5 Inbox webhook signing + events (migration 0024, prompt 5)

```sql
alter table inboxes
  add column if not exists webhook_secret              text,
  add column if not exists webhook_secret_previous     text,
  add column if not exists webhook_secret_rotated_at   timestamptz,
  add column if not exists webhook_events              text[] not null default
    array[
      'message_received',
      'conversation_status_changed',
      'conversation_assigned',
      'conversation_created'
    ];
```

`webhook_secret` is a 32-byte random base64url string (raw, not
hashed — we need it on both ends to sign). For inboxes that
exist before this migration, `webhook_secret` is generated by
the migration itself (`gen_random_bytes(32)` →
`encode(..., 'base64')`).

---

## 3. Role authorisation (prompts 2, 3, 4, 5)

Every page and server action picks one of these guards. The
prompts cite them by name.

| Guard | Allowed identities |
|-------|--------------------|
| `requireOwner(businessId)` | Only `businesses.owner_user_id = auth.uid()` |
| `requireLead(businessId)` | Owner, or `support_agents.role = 'lead'` for this business (accepted, not archived) |
| `requireAgent(businessId)` | Owner, lead, or `support_agents.role = 'agent'` for this business (accepted, not archived) |

Implementation lives in `src/lib/team.ts` — extend the existing
`requireRole` stub. The stub currently treats only the owner as
authorised; round 4 prompt 1 broadens it to query
`support_agents`.

`TeamRole` becomes `'owner' | 'lead' | 'agent'`. The
round-3 stub's `'admin'` rank is removed; nothing in main
references it (verify with `grep -rn "TeamRole" src/`).

### Middleware redirects (prompt 2)

`src/middleware.ts` reads the active business id from the
`active-context` cookie. For that business it resolves the
caller's role and applies these rules:

| Path prefix | Owner | Lead | Agent |
|-------------|-------|------|-------|
| `/workbench/**` | allow | allow | allow |
| `/dashboard` (root) | allow | allow | redirect → `/workbench` |
| `/dashboard/inbox/**` | allow | allow | allow (read + reply, no edit) |
| `/dashboard/settings/team` | allow | allow | redirect → `/workbench` |
| `/dashboard/settings/billing/**` | allow | redirect → `/workbench` | redirect → `/workbench` |
| `/dashboard/settings/business/**` | allow | redirect → `/workbench` | redirect → `/workbench` |
| `/dashboard/settings/mcp/**` | allow | redirect → `/workbench` | redirect → `/workbench` |
| `/dashboard/settings/account/**` | allow | allow (own account only) | allow (own account only) |
| `/dashboard/businesses/**`, `/dashboard/inboxes/**` (create/edit) | allow | redirect → `/workbench` | redirect → `/workbench` |
| `/dashboard/webhooks` | allow | redirect → `/workbench` | redirect → `/workbench` |

The middleware extends `active-context` cookie with a derived
`role` claim (recomputed on every request — the cookie is a
hint, the DB is source of truth).

---

## 4. Agent status (round 4 — no Realtime presence)

Round 4 does **not** ship Supabase Realtime presence. The
assignment trigger lives in Postgres and must be answerable
from SQL alone, so status is a column.

States: `online`, `away`, `offline`.

Transitions (implemented in prompt 3):

- Browser PATCHes `support_agents.status` when the agent flips
  the toggle in the Workbench header.
- A `tick()` server action called from a 60s client-side
  interval refreshes `status_changed_at` while the toggle says
  `online` — no other writes. If the user closes the tab, the
  interval stops, and the staleness check below flips them.
- On any read of `support_agents.status` for assignment
  purposes, callers must apply the staleness rule:

  ```ts
  // pseudocode shown in prompt 4
  effective_status =
    status = 'online' AND now() - status_changed_at < interval '5 minutes'
      ? 'online'
      : status = 'online' ? 'away' : status;
  ```

  This is materialised as a SQL view `agent_presence_view` in
  prompt 4 so the trigger can join on it without recomputing.

Round 5 will replace the heartbeat with a Realtime presence
channel. The column stays as the source of truth for the SQL
trigger; Realtime drives the live UI.

---

## 5. Auto-assignment algorithm (prompt 4)

`assign_conversation(conv_id uuid) returns uuid` — returns the
assigned agent's `auth.users.id`, or `null` if none online.

Selection:
1. Resolve `business_id` via `conversations → inboxes →
   projects → businesses`.
2. Candidate pool: `support_agents` rows where
   `business_id = $1 AND archived_at is null AND
   accepted_at is not null AND effective_status = 'online'`.
3. Order by:
   1. `count(open conversations assigned to this agent)` ASC
      — "open" = status in (`active`, `waiting_customer`,
      `waiting_support`).
   2. `last_assigned_at` ASC NULLS FIRST — fair rotation.
   3. `id` ASC — deterministic tiebreak.
4. Update `conversations.assigned_to = chosen.user_id`,
   `conversations.assigned_at = now()`,
   `support_agents.last_assigned_at = now()` for the chosen row.

Triggered:
- `BEFORE INSERT` on `conversations` when
  `assigned_to is null AND status in ('new','waiting_support')`.
- `BEFORE UPDATE` on `conversations` when
  `OLD.status is distinct from NEW.status` and
  `NEW.assigned_to is null` and
  `NEW.status in ('new','waiting_support')`.
- Manual server action `claimConversation(conversation_id)` from
  the Workbench "Claim" button — bypasses the algorithm and
  sets the caller as assignee.

If no agent is online the function returns null and leaves the
conversation unassigned. It will surface in the Workbench
"Unassigned" pane.

---

## 6. Re-pickup flag (prompt 4)

When a conversation is assigned and the assigned agent has not
sent an outbound message for **10 minutes**, the conversation
surfaces in the Unassigned pane alongside its (still-set)
assignee. Implementation:

- `conversations.last_outbound_at` updated by the existing
  message-insert trigger (or wherever messages are inserted —
  prompt 4 verifies which).
- `conversations.reassign_after` = `last_outbound_at + interval '10 minutes'`
  whenever an inbound message arrives without an outbound
  reply since.
- A SQL view `unassigned_or_stale_view` returns conversations
  where `assigned_to is null` OR (`reassign_after is not null
  AND reassign_after < now()`). The Workbench queries this view.

Round 5 may auto-unassign; round 4 keeps it advisory.

---

## 7. Visitor-facing agent identity (prompt 1)

When `conversations.assigned_to` is set, the embed widget's
ThreadPanel header shows:

- Avatar (24×24, circular) — `support_agents.avatar_url` if
  present, else a coloured initials chip derived from
  `display_name`.
- Agent's `display_name`.
- A muted "from <business.name>" suffix when the embed is
  hosted on a non-tenant domain. (Optional polish; defer if
  scope expands.)

Until assignment, the widget shows the existing generic
"Support" title (no change).

API surface: extend the `GET /api/embed/conversations/[id]` (or
the equivalent — verify path in prompt 1) response with:

```ts
agent: {
  display_name: string;
  avatar_url: string | null;
} | null
```

Joined via `conversations.assigned_to → support_agents
(business_id = conv.business_id, user_id = assigned_to)`. If no
matching `support_agents` row exists (e.g. the agent was
archived), return `null`.

---

## 8. Hard rules

1. **600-line cap.** Every prompt ends with `wc -l` on the files
   it touched. If anything is over 600, split it before
   declaring done.
2. **Next.js 16 quirks.** Read `AGENTS.md` at the repo root
   before writing route handlers, Server Actions, or
   `params`/`searchParams` access. The Next.js you know from
   training data has breaking changes.
3. **Migrations are forward-only.** Never edit a migration after
   it's pushed. If you need to fix one, add a new migration
   number.
4. **Active context cookie is the truth.** Server actions read
   the active business via `getActiveContext()` from
   `src/lib/active-context.ts` (don't accept business_id as a
   client argument when the active context already covers it).
5. **`pk_live_45f4942f494ae8a94da8aca3`** is the live test key
   on greenflagged.xyz. Don't rotate it. Use it as-is when
   asking the founder to verify in a browser.

---

## 9. Critical references

| Concern | File |
|---------|------|
| Active business cookie | `src/lib/active-context.ts` |
| Existing team stub (extend) | `src/lib/team.ts` |
| Conversation statuses | `src/lib/conversation-status.ts`, `conversation-status-server.ts` |
| Webhook firing | `src/lib/tenant-webhook.ts` (currently unsigned — prompt 5 adds HMAC) |
| Embed iframe auth | `src/lib/embed-auth.ts`, `src/lib/api-auth.ts` |
| Per-business allowlist (schema only) | migration `0020_business_allowed_origins.sql`, `src/app/dashboard/_actions/allowed-origins.ts` |
| Realtime client | `src/lib/realtime.ts` |
| Visual tokens | `src/app/globals.css` |
| Storage bucket template | `src/app/dashboard/_components/ui/BusinessLogoUploader.tsx` |
| Settings sub-nav | `src/app/dashboard/_components/settings-nav/SettingsNav.tsx` |
| Middleware | `src/middleware.ts` |
| Dashboard ThreadView (reuse) | `src/app/dashboard/inbox/[id]/ThreadView.tsx` |
| Widget ThreadPanel (refactor target) | `src/app/embed/widget/ThreadPanel.tsx` (635 lines) |

External docs:
- Supabase Auth admin invites & sign-up — `supabase.com/docs/guides/auth/auth-email-passwordless`
- Supabase Storage RLS — `supabase.com/docs/guides/storage/security/access-control`
- Resend Next.js — `resend.com/docs/send-with-nextjs`
- HMAC-SHA256 webhook signing (reference: Stripe) — `stripe.com/docs/webhooks/signatures`
