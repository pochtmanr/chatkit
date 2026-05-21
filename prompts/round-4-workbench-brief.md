# Round 4 — Brief for the next team lead

**You are reading this because you've been asked to plan and write
the next set of self-contained Claude Code prompts in
`prompts/round-4-workbench/` (or `prompts/<topic>/`). This document
translates the founder's spoken requirements into structured tasks,
flags the decisions you must clarify with them before writing the
prompts, and points at the existing code so you don't have to
re-discover it.**

You don't write code yourself. Your output is a folder of prompts
that fresh sessions can execute, exactly like rounds 1, 2 and 3 did
(see `prompts/onboarding/`, `prompts/dashboard-redesign/`, and
`prompts/round-3-brief.md` for the established format).

---

## 0. Quick context the founder gave you

- **Test API key** for any flows you build: `pk_live_45f4942f494ae8a94da8aca3`.
  This is an existing key in chatkit's DB — use as-is, don't
  rotate or recreate. (When asking the founder to test in a
  browser, point at greenflagged.xyz — the FAB widget there is
  wired to this key.)
- **Webhook URL the founder wants to paste somewhere**: chatkit
  *emits* webhooks to tenant URLs. The customer-facing piece is
  the **outgoing webhook URL** stored per-inbox at
  `/dashboard/webhooks`. There is no `/api/v1/webhooks/<id>` inbound
  endpoint. The "more modern webhook settings" theme below is about
  the dashboard UI for that outgoing-webhook config.
- **Hard rule**: no source file may exceed 600 lines. `src/app/embed/widget/ThreadPanel.tsx`
  is currently **635 lines** — this round must split it.
- **The new repo** (`pochtmanr/chatkit`) is where work pushes. The
  old `AAAxis/holylabs-chat-admin` remote is kept as `aaaxis` but
  NEVER receives pushes.

---

## 1. Where we are

Three rounds shipped (verify with `git log` and by running
`supabase db diff`):

- **Round 1 (`prompts/onboarding/`)** — replaced silent tenant
  bootstrap with a 4-step onboarding wizard. Introduced the
  `businesses → projects → inboxes` hierarchy, moved `api_key` +
  `webhook_url` onto inboxes, capped accounts at 2 businesses via a
  DB trigger.
- **Round 2 (`prompts/dashboard-redesign/`)** — every dashboard tab
  is multi-inbox aware, sidebar has business + inbox switchers,
  ink/deep/mist palette + serif-italic accents. Added `archived_at`
  to projects + inboxes. Closed a webhook gap from round 1.
- **Round 3 (`prompts/round-3-*`)** — full-width dashboard, business
  profile fields (logo + address), conversation statuses
  (`new/active/waiting_*/done/transferred`), dedicated create/edit
  routes for businesses + inboxes, settings sub-nav (business /
  billing / mcp / account / statistics), Revolut billing
  scaffolding, MCP server workspace (`mcp-server/`), migrations
  0013–0019.

Re-read these before designing round 4:

- `prompts/round-3-brief.md` — format, decisions, and active
  schemas you will extend.
- `prompts/dashboard-redesign/0-shared.md` — sidebar protocol,
  active-context cookie, visual rules.
- `prompts/onboarding/0-shared.md` — data model, enums.

---

## 2. The mission of round 4 (in plain words)

The founder said this, verbatim:

> "In the next conversation, I will create an WORKBENCH — so, in
> case I'm a big company, I want to see all the support tickets in
> separate file. If I hired a few support engineers — I want to
> delegate the work, I want them to be online and receive inquiries,
> and so on the other side the client will see the support agent
> name when they talking. This way the webhooks/APIs and
> business/account settings will be safe.
>
> So for the support workbench I want to invite customer support
> agents, create the credentials to them, they will see queue with
> all support requests, some of them will be assigned to them
> automatically (kind of agent connect in Facebook that I used to
> use).
>
> Make sure we will brainstorm, next agent will ask me questions,
> and will create a set of prompts so we will quickly set up this
> ready. For the test — pk_live_45f4942f494ae8a94da8aca3, and I need
> the webhook for chatkit to paste. We will also then create a more
> modern chat integration/webhook settings. We also cannot have any
> code file exceed 600 rows, so separation in files, refactoring
> code is important."

Translated, the round delivers seven themes (each becomes 1–2
prompts):

| # | Theme                                  | One-line summary                                                                            |
|---|----------------------------------------|---------------------------------------------------------------------------------------------|
| A | **Agent identities**                   | New `support_agents` table; each agent has display name + avatar surfaced in visitor chat.  |
| B | **Agent auth + invites**               | Invite by email; credentials issued; agent login distinct from business owner.              |
| C | **Workbench UI**                       | Dedicated `/workbench` route — queue of unassigned + per-agent active conversations.        |
| D | **Auto-assignment**                    | Route new conversations to online agents (round-robin or least-loaded).                     |
| E | **Presence**                           | Online / away / offline; agent must be online to receive auto-assignments.                  |
| F | **Modern webhook + integration settings** | Redesign `/dashboard/webhooks` — signed secret rotation, per-event filters, test-fire button. (Per-business embed allowlist + test-connection already shipped in `/dashboard/settings/business`; that pattern is the template.) |
| G | **Refactor pass**                      | Split `ThreadPanel.tsx` (635 lines). Hunt any other file ≥ 600 the round touches.           |

Agent identities + auth + Workbench UI is the spine. Auto-assignment
+ presence are the "wow" feature. Webhook redesign is parallel work.
Refactor pass is cleanup at the end.

---

## 3. Detailed work items

### A. Agent identities

**What changes**: business owners aren't the only people working
the inbox anymore. Each business can have N support agents. End
users (visitors) see the agent's display name + avatar in the chat
header once an agent claims their conversation. Until then they see
a generic "Support" identity.

**Concrete spec to propose**:

```
support_agents
  id              uuid primary key default uuid_generate_v4()
  user_id         uuid not null references auth.users(id) on delete cascade
                                          -- one row per (business, auth user)
  business_id     uuid not null references businesses(id) on delete cascade
  display_name    text not null            -- shown to visitors
  avatar_url      text NULL                -- Supabase Storage url
  role            text not null default 'agent'
                  check (role in ('agent','lead'))  -- 'lead' can manage other agents
  status          text not null default 'offline'
                  check (status in ('online','away','offline'))
  status_changed_at timestamptz not null default now()
  invited_by      uuid NULL references auth.users(id)
  invited_at      timestamptz not null default now()
  accepted_at     timestamptz NULL          -- null = pending invite
  archived_at     timestamptz NULL
  created_at      timestamptz not null default now()
  unique (business_id, user_id)
```

Storage bucket: `avatars` (public read, RLS write scoped to
`auth.uid() = user_id`). Reuse the pattern from `logos` (round 3,
business profile).

Conversation surfacing: extend the visitor-side widget header so
that when `conversations.assigned_to` is set, the response carries
`{ agent_name, agent_avatar }` from a join. Today the widget shows
a generic title.

**Affected files** (paths only):
- New migration `0021_support_agents.sql`. (0020 is taken by
  `0020_business_allowed_origins.sql`, landed in the per-business
  embed allowlist work.)
- `src/lib/team.ts` — already exists (round 3 scaffold). Extend
  with `listAgents`, `getAgent`, presence helpers.
- `src/app/dashboard/_actions/team.ts` — new.
- Widget API responses in `src/app/api/embed/conversations/*` need
  to include agent identity when assigned.
- `src/app/embed/widget/ThreadPanel.tsx` — header tweak (and the
  required split, see theme G).

**Open questions**:
- Does an agent get a public-facing handle (e.g. "Sarah from
  Acme") or just first name? Recommend: free-text `display_name`
  the agent chooses on accept.
- Is the avatar required, optional, or has a default initial-on-
  colour fallback? Recommend: optional, fallback to initials chip.

### B. Agent auth + invites

**What changes**: business owners invite agents by email; agents
click a link, set a password (or sign in with OAuth), and land
straight in `/workbench` for that business — never see Settings,
Billing, MCP, business profile.

**Concrete spec to propose**:

Invite flow:
1. Owner → `/dashboard/settings/team` (page exists, fill it out)
   → "Invite agent" → enters email + display name + role.
2. Server action creates a `support_agents` row with
   `accepted_at = null`, stores an `invitations` row with a
   single-use token.
3. Resend (already wired up in `lib/` for the marketing site if
   present — verify) emails the agent a link to
   `/invite/<token>`.
4. Agent visits the link → if no Supabase auth user exists,
   sign-up flow with email pre-filled + password; if exists,
   normal login. After auth, server action consumes the token,
   sets `support_agents.user_id` + `accepted_at = now()`, redirects
   to `/workbench`.
5. Invite expires after 7 days; resend supported.

```
invitations
  id                  uuid primary key default uuid_generate_v4()
  business_id         uuid not null references businesses(id) on delete cascade
  email               text not null
  display_name        text not null
  role                text not null default 'agent'
  token_hash          text not null unique     -- argon2id hash; raw token only in URL
  invited_by          uuid not null references auth.users(id)
  expires_at          timestamptz not null
  accepted_at         timestamptz NULL
  created_at          timestamptz not null default now()
```

Authorisation:
- Owner sees full dashboard.
- Agent's session has a different "role" claim (computed from
  `support_agents.role`) and middleware redirects them away from
  `/dashboard/settings/*`, `/dashboard/billing/*`, `/dashboard/mcp/*`,
  `/dashboard/businesses/*`, `/dashboard/inboxes/*/edit` — only
  `/workbench` and `/dashboard/inbox/[id]` (read+reply, no edit) are
  allowed.
- Update `src/middleware.ts` accordingly. There's already an
  `active-context` cookie; extend it with role.

**Open questions**:
- Email provider for invites — Resend, Postmark, SES, Supabase
  built-in? Pick one before writing prompt 2.
- Single sign-on for agents (Google) or password only?
- Can one human be an agent for multiple businesses? The
  `support_agents.unique (business_id, user_id)` allows it.
  Confirm.

**Affected files**:
- New migration `0022_invitations_and_agent_role.sql`.
- New route `/invite/[token]/page.tsx` + accept server action.
- `src/app/dashboard/settings/team/page.tsx` — already exists as
  a placeholder, fill in.
- `src/middleware.ts` — role-aware redirects.
- `src/lib/active-context.ts` — extend.
- `src/app/dashboard/_actions/team.ts` — invite, resend, revoke.

### C. Workbench UI

**What changes**: a dedicated landing for agents. Three panes:

```
┌────────────┬─────────────────────────────────────────────────┐
│ My Queue   │  Conversation #4923                              │
│  (active)  │  ─────────────────────────────────────────       │
│            │  Visitor: Alex                                   │
│  - #4923 ● │  Status: active                                  │
│  - #4901 ● │  Inbox: Acme Sales                                │
│            │                                                  │
│ Unassigned │  [messages]                                      │
│            │                                                  │
│  - #4951   │  ──────────────────────────                      │
│  - #4948   │  [reply box]   [end]  [transfer]                 │
└────────────┴─────────────────────────────────────────────────┘
```

Route: `/workbench` (top-level, not under `/dashboard`).
Left rail: "My queue" (everything assigned to me, sorted by last
inbound), then "Unassigned" (status = `new` or `waiting_support`
without `assigned_to`). Realtime updates via Supabase Realtime
channel keyed by `business_id`.

Centre: same `ThreadView` as the dashboard inbox, but with
"Claim", "Transfer", "End" action buttons.

Right pane (optional first pass): visitor metadata
(name/email/external_ref/business). Defer if scope explodes.

**Open questions**:
- Single-agent-per-conversation (one active assignee) or multiple
  agents collaborating on the same thread? Recommend single
  assignee for v0.x; collaboration later.
- Should owners also use Workbench, or stay in `/dashboard/inbox`?
  Recommend: owner uses Workbench as a "manager" mode where they
  see *all* queues, not just their own. Add a role filter at
  the top.

**Affected files**:
- New route group `src/app/workbench/`.
- Reuse `src/app/dashboard/inbox/[id]/ThreadView.tsx` (extract a
  shared component if needed).
- `src/lib/realtime.ts` — extend channel topics if needed.
- Sidebar adjustment for agents (no sidebar; just a thin top bar).

### D. Auto-assignment

**What changes**: when a new visitor conversation lands or
transitions to `waiting_support` and `assigned_to is null`, an
algorithm picks an online agent and assigns it.

**Concrete spec to propose**:

Algorithm v0: **least-loaded round-robin among `online` agents
within the inbox's business**.

- Online agent = `support_agents.status = 'online'` AND
  `support_agents.status_changed_at` within last 5 minutes (stale
  presence flips to away automatically).
- Load = count of conversations where `assigned_to = agent.id` AND
  `status in ('active','waiting_customer','waiting_support')`.
- Tie-break: oldest `last_assigned_at` first (keeps the rotation
  fair); add `last_assigned_at timestamptz` column to
  `support_agents`.

Triggered:
- On `conversations` insert if `status in ('new','waiting_support')`
  AND `assigned_to is null`.
- On status change to `waiting_support` if `assigned_to is null`.
- Manually via Workbench "Claim from queue" button.

Implementation: a Postgres function `assign_conversation(uuid)`
that picks the agent (or returns null if none online), updates
the row, and notifies via Realtime. Triggered by a `BEFORE INSERT`
+ `BEFORE UPDATE` trigger.

If no agent is online, the conversation stays unassigned and the
queue badge in Workbench surfaces it.

**Open questions**:
- Round-robin vs **skill-based**? Skills imply tagging agents
  (`languages`, `product_area`) — out of scope unless founder
  insists. Recommend round-robin first.
- Off-hours: if zero agents online, do we (a) leave queue idle,
  (b) auto-send a "we'll be back tomorrow" message, or (c) flip
  the inbox into `out_of_office` mode? Need founder decision.
- When an agent goes `offline`, do their active conversations
  reassign automatically or stay assigned? Recommend stay
  assigned but flag the conversation for re-pickup if no reply
  in N minutes.

**Affected files**:
- Migration `0023_auto_assignment.sql` (function + triggers).
- `src/app/dashboard/_actions/conversations.ts` — add manual
  claim/transfer actions.
- `src/lib/realtime.ts` — broadcast "assignment changed" event.

### E. Presence

**What changes**: agents have a status (online/away/offline) that
the assignment algorithm consults. The Workbench shows everyone's
status. The visitor widget header optionally shows "Sarah is
typing…" / "Agents online: 3" via the same channel.

**Concrete spec to propose**:

Two options to weigh:

1. **Supabase Realtime presence** — each agent's browser joins a
   business-scoped channel and reports presence. Real-time, no DB
   writes for heartbeats. Falls back to `support_agents.status`
   in DB only on explicit "set status" actions.
2. **DB heartbeat** — agent's browser PATCHes
   `support_agents.status_changed_at` every 60s; if older than
   5 min, considered away.

Recommend (1) for live presence + (2) as the source of truth used
by SQL (the assignment trigger lives in Postgres and can't query
Realtime).

Status transitions:
- `online` → manual toggle or "active" detection (mouse moved /
  tab focused in last 60s).
- `away` → manual toggle or 5 min idle.
- `offline` → tab closed (Realtime presence disconnect) or manual.

**Affected files**:
- `src/lib/realtime.ts` — agent presence channel.
- New `src/lib/presence.ts` — heartbeat helper.
- `src/app/workbench/_components/PresenceIndicator.tsx`.

### F. Modern webhook + integration settings

**What changes**: the existing `src/app/dashboard/webhooks/page.tsx`
is functional but flat. The founder wants a richer UX that signals
"this is a serious integration surface."

**Concrete spec to propose**:

Reorganise into a per-inbox webhook configuration card with:

- **URL field** (already exists).
- **Signing secret** (already exists in `tenant-webhook.ts`) —
  display first 6 + last 4, "Rotate" button with confirmation.
- **Events checklist** — explicit opt-in per event type:
  `conversation.created`, `conversation.status_changed`,
  `message.inbound`, `message.outbound`, `conversation.assigned`,
  `agent.invited`. Store in a new `inboxes.webhook_events text[]`
  column; default to all enabled (backward compat).
- **Test fire** button that posts a sample of the selected event
  type to the URL and shows the response inline.
- **Recent deliveries table** (last 50) — status code, timestamp,
  retry count, "View payload" drawer.
- **Webhook delivery log** already exists in
  `webhook_deliveries` table (round 1 prompt 5 or round 2 fix —
  verify); query that.

The "more modern chat integration" piece likely also wants:

- A **copy-paste integration recipe** per inbox: "iframe HTML
  snippet", "React component", "API curl example". These already
  exist in `EmbedSnippets.tsx` for inbox iframe; extend to cover
  the FAB widget.
- An **embed allowlist editor** UI that writes a per-business
  override of `EMBED_ALLOWED_ORIGINS` (the env var becomes a
  fallback). Today there's no way to edit the allowlist without
  redeploying.

**Open questions**:
- Should the allowlist be per-business or per-inbox? Recommend
  per-business (lower friction for tenants who run many inboxes
  on the same site).
- Webhook secret format — keep current or expose multiple secrets
  (active + previous, like Stripe) for zero-downtime rotation?
  Recommend dual secrets for v0.x.
- HMAC algorithm — confirm what `tenant-webhook.ts` uses today and
  whether v0.x should be HMAC-SHA256 standard.

**Affected files**:
- Migration `0024_inbox_webhook_events.sql`. (Per-business allowlist
  is already shipped in 0020; the webhook redesign just needs the
  per-event opt-in column on inboxes.)
- `src/lib/tenant-webhook.ts` — filter by `webhook_events`.
- `src/app/dashboard/webhooks/page.tsx` — full UI rebuild.
- New `src/app/dashboard/_components/webhooks/*` for delivery
  log + test-fire drawer.
- `src/lib/embed-auth.ts` — consult per-business allowlist
  before falling back to env.

### G. Refactor pass

**What changes**: split files that exceed 600 lines.

Today's hard offender:
- `src/app/embed/widget/ThreadPanel.tsx` — **635 lines**.

Plausible split:
- `ThreadPanel.tsx` (controller / hooks orchestration, < 250 lines)
- `ThreadMessages.tsx` (rendering of message list, < 200 lines)
- `ThreadComposer.tsx` (input area + attachments, < 150 lines)
- `useThreadConversation.ts` (data fetching + realtime
  subscription hook, < 200 lines)

Any file the round 4 work pushes near 600 lines (e.g. new
Workbench page, webhook redesign page) must be split BEFORE the
prompt is marked complete. Each prompt should end with `wc -l` on
the files it touched as a verification step.

**Affected files**:
- `src/app/embed/widget/ThreadPanel.tsx` — split.
- New sibling files listed above.

---

## 4. Suggested prompt breakdown (refine before writing)

```
prompts/round-4-workbench/
├── README.md
├── 0-shared.md                    — round contracts: agent role enum,
│                                     presence states, assignment algo,
│                                     middleware redirect rules, 600-cap.
├── 1-agents-schema.md             — migration 0021, support_agents +
│                                     avatars bucket, listAgents helpers.
├── 2-invites.md                   — migration 0022, invitations table,
│                                     /invite/[token] route, Resend
│                                     email, middleware role gates.
├── 3-workbench-ui.md              — /workbench route group, queue panes,
│                                     thread view reuse, presence indicator.
├── 4-auto-assignment.md           — migration 0023, assign_conversation
│                                     function + triggers, manual claim
│                                     server actions.
├── 5-presence.md                  — Realtime presence channel + DB
│                                     heartbeat, agent status UI toggle.
├── 6-webhooks-redesign.md         — migration 0024, webhook_events column,
│                                     allowlist editor, redesigned page,
│                                     delivery log + test-fire UI.
└── 7-refactor-threadpanel.md      — split ThreadPanel into 4 files;
                                      add wc -l verification per round-4
                                      prompt.
```

Eight files. Prompt 1 is a hard dependency for everything else
(except 6 and 7, which can run in parallel after 0-shared). Prompt
2 needs 1 in place. Prompts 3, 4, 5 chain through 2 (they all
assume agents exist + can sign in).

If the founder wants a smaller first cut, defer presence (#5) —
the assignment trigger can just use `support_agents.status` until
real presence lands. That collapses round 4 to 7 prompts.

---

## 5. Decisions to clarify with the founder BEFORE writing prompts

Use `AskUserQuestion` to gather these in one or two batches:

1. **Email provider for invites** — Resend, Postmark, SES,
   Supabase built-in? (Resend is the conventional pick; confirm.)
2. **OAuth for agent sign-up** — Google sign-in or password only
   for v0.x?
3. **Agent across multiple businesses** — one human can agent for
   N businesses, or strictly 1:1?
4. **Single vs collaborative thread ownership** — one assignee
   per conversation, or multiple agents can chime in?
5. **Auto-assignment scope** — round-robin only, or skill-based
   ("agent X handles English, Y handles billing")?
6. **Off-hours behaviour** — idle queue / auto-reply / inbox flag?
7. **Re-assign on offline** — auto-reclaim if an agent goes
   offline mid-conversation, or stay assigned?
8. **Presence transport** — Supabase Realtime + DB fallback
   (recommended) or DB heartbeat only?
9. **Webhook signing** — dual-secret rotation (Stripe-style) or
   single secret?
10. **Allowlist scope** — per-business (recommended) or per-inbox?
11. **Owner in Workbench** — does the owner use `/workbench` too
    (as a manager view) or stay in `/dashboard/inbox`?
12. **Visitor-facing agent identity** — full name + avatar, or
    first name only? Default avatar policy?

---

## 6. Critical references (don't skip)

| Concern                | File / section                                                  |
|------------------------|-----------------------------------------------------------------|
| Active context cookie  | `src/lib/active-context.ts`                                     |
| Existing team scaffold | `src/lib/team.ts`, `src/app/dashboard/settings/team/page.tsx`   |
| Conversation statuses  | `src/lib/conversation-status*.ts` (round 3 prompt 3)            |
| Webhook plumbing       | `src/lib/tenant-webhook.ts`, `webhook_deliveries` table         |
| Embed auth boundary    | `src/lib/embed-auth.ts`, `src/lib/api-auth.ts`                  |
| Widget header source   | `src/app/embed/widget/ThreadPanel.tsx` (also the refactor target) |
| Realtime channels      | `src/lib/realtime.ts`                                           |
| Visual tokens          | `src/app/globals.css`, `prompts/prompt0-shared.md`              |
| Settings sub-nav       | `src/app/dashboard/_components/settings-nav/SettingsNav.tsx`    |
| Storage bucket pattern | `src/app/dashboard/_components/ui/BusinessLogoUploader.tsx`     |
| Middleware auth        | `src/middleware.ts`                                             |

External docs to bookmark:
- Supabase Realtime presence: `supabase.com/docs/guides/realtime/presence`.
- Supabase Auth invites (built-in): `supabase.com/docs/guides/auth/auth-email-invite`.
- Resend Next.js quickstart (if chosen): `resend.com/docs/send-with-nextjs`.
- AGENTS.md at repo root — **read this first**, Next.js 16 has
  breaking changes from training data.

---

## 7. Process reminders

1. **Explore first.** Launch parallel `Explore` agents to verify
   the codebase state — especially that round 3 migrations 0013–
   0019 are pushed and that `support_agents` doesn't already exist
   in a stub form.
2. **Ask questions.** Section 5 above. Use `AskUserQuestion` with
   "Recommended" labels.
3. **Plan, don't code.** Your deliverable is `prompts/round-4-workbench/`.
   No application code from you.
4. **Self-contained prompts.** Each prompt must be runnable by a
   fresh Claude Code session that has read only `prompts/prompt0-shared.md`,
   `prompts/round-4-workbench/0-shared.md`, and the prompt itself.
5. **Flag the 600-line cap explicitly in every prompt.** Each
   prompt ends with a `wc -l` check on files it touched.
6. **Test against greenflagged.xyz.** The FAB widget is wired
   there with `pk_live_45f4942f494ae8a94da8aca3`. Once round 4
   lands, the founder can verify the agent identity / queue / etc.
   live by opening that page.

Good luck.
