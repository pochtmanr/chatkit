# Round 3 — Brief for the next team lead

**You are reading this because you've been asked to plan and write
the next set of self-contained Claude Code prompts in
`prompts/round-3-*` (or `prompts/<topic>/`). This document
translates the founder's spoken requirements into structured tasks,
flags the decisions you must clarify with them before writing the
prompts, and points at the existing code so you don't have to
re-discover it.**

You don't write code yourself. Your output is a folder of prompts
that fresh sessions can execute, exactly like rounds 1 and 2 did
(see `prompts/onboarding/` and `prompts/dashboard-redesign/` for the
established format).

---

## 1. Where we are

Two rounds have shipped (assuming both have been applied — verify
with `git log` and by running `supabase db diff`):

- **Round 1 (`prompts/onboarding/`)** — replaced silent tenant
  bootstrap with a 4-step onboarding wizard. Introduced the
  `businesses → projects → inboxes` hierarchy, moved `api_key` +
  `webhook_url` onto inboxes, capped accounts at 2 businesses via a
  DB trigger.
- **Round 2 (`prompts/dashboard-redesign/`)** — every dashboard tab
  is now multi-inbox aware, the sidebar has business + inbox
  switchers, and the visual style follows the landing aesthetic
  (ink/deep/mist palette, serif-italic accents, nested cards). Added
  `archived_at` to projects + inboxes. Closed a webhook gap from
  round 1.

Re-read these before designing round 3:

- `prompts/prompt0-shared.md` — visual tokens, fonts, nested-card
  pattern.
- `prompts/onboarding/0-shared.md` — data model, enums, server-action
  contracts.
- `prompts/dashboard-redesign/0-shared.md` — active-context cookie
  protocol, dashboard visual rules.

---

## 2. The mission of round 3 (in plain words)

The founder said this, verbatim:

> "We need to update settings with the design and billing capacity,
> so users will be limited if they free, by 2 businesses and 2 chats.
> For the billing we will use Revolut checkout (as we don't have
> Stripe or any other option). We will update the webhooks page, we
> will be able to customise business pages, in order to include logo,
> address or other info. We need to create 'create inbox' and create
> business tabs. We will need to be able to edit existing ones. The
> pages should be full width, not centered like right now, so it will
> be more professional. In the settings tab user will be able to
> manage billing, the access key for the future MCP development, the
> billing, the business info, he will be able to ask for the data
> deletion and account deletion. He will see his invoices, billing
> history and overall statistics. Main `/dashboard` also please
> re-made for the full width. Then, each chat session will have a few
> statuses — new, active, waiting for reply from customer/support,
> done, or transferred. So the huge work with MCP is will be
> required."

Translated, the round delivers six themes (each becomes ~1–2 prompts):

| # | Theme                              | One-line summary                                                                |
|---|------------------------------------|---------------------------------------------------------------------------------|
| A | **Full-width layout**              | Drop `max-w-5xl`, restyle dashboard shell + Usage tab for full-width pro feel.  |
| B | **Business profile fields**        | Logo, address, contact email/phone, custom info; settings UI to edit.           |
| C | **Conversation statuses**          | `new / active / waiting_customer / waiting_support / done / transferred`.       |
| D | **Dedicated create + edit routes** | `/dashboard/businesses/new`, `/dashboard/inboxes/new`, plus edit equivalents.   |
| E | **Settings reorganisation + billing** | Multi-section settings with billing, MCP keys, account/data deletion, invoices. |
| F | **MCP server**                     | A real Model Context Protocol server exposing chat data to external AI tools.   |

The billing piece is the largest by surface area; the MCP server is
the largest by depth. Plan accordingly.

---

## 3. Detailed work items

### A. Full-width layout

**What changes**: `src/app/dashboard/layout.tsx` currently uses
`<div className="mx-auto max-w-5xl p-8 md:p-10">{children}</div>`.
The founder wants the content to span the viewport with generous
side padding — "more professional."

**Concrete spec to propose to the founder**:
- Replace `max-w-5xl mx-auto` with `w-full px-6 md:px-10 lg:px-14`.
- Keep the 260px sidebar fixed; content fills the rest.
- Per-page sections can still use `max-w-7xl` *internally* where a
  reading column is needed (e.g. long-form settings panels), but the
  page itself does not centre.

**Affected files**: `src/app/dashboard/layout.tsx`, every page under
`src/app/dashboard/*/page.tsx` (mostly the outer wrapper div).

**Sub-decision**: the Usage tab (`/dashboard`) — should the stat
tiles span 4 columns at wide widths now that there's more horizontal
room, or stay at 3? Recommend 4 with the existing three stats + a
new "Active conversations now" tile (counts conversations in
`new`/`active`/`waiting_*` states once theme C lands).

### B. Business profile fields

**What changes**: extend the `businesses` table with profile fields
the founder mentioned ("logo, address, other info"). Surface them
in the new Settings business section.

**Concrete spec to propose**:

```
businesses
  + logo_url            text NULL         -- public URL of uploaded logo (Supabase Storage)
  + address_line1       text NULL
  + address_line2       text NULL
  + city                text NULL
  + region              text NULL         -- state/province
  + postal_code         text NULL
  + country             text NULL         -- ISO-3166-1 alpha-2
  + contact_email       text NULL
  + contact_phone       text NULL
  + website_url         text NULL
  + about               text NULL         -- "other info" — short markdown blurb, max 1000 chars
```

Logo upload uses Supabase Storage (`logos` bucket, public read,
authenticated write scoped to the user's business via RLS).

**Open question for the founder**:
- Are these fields used internally only, or surfaced to end-users
  (e.g. shown in the chat widget header)? That affects what fields
  matter and what privacy posture they need.

**Affected files**:
- New migration `0015_business_profile.sql`.
- Storage bucket `logos` (created via Supabase Studio or a
  `storage.policies` migration block).
- Settings UI section (Theme E).
- Possibly the embed widget metadata response — out of scope this
  round unless the founder says otherwise.

### C. Conversation statuses

**What changes**: every conversation gets a status, surfaced in the
inbox list and the thread page; agents transition it manually
(automatic heuristics for v0.x are a footgun — leave them for later).

**Concrete spec to propose**:

```
conversations
  + status              text NOT NULL DEFAULT 'new'
                        CHECK (status IN ('new','active','waiting_customer',
                                          'waiting_support','done','transferred'))
  + status_updated_at   timestamptz NOT NULL DEFAULT now()
  + assigned_to         uuid NULL REFERENCES auth.users(id)   -- which agent owns it
```

Backfill existing rows: `status = 'active'` if `last_at` is in the
last 7 days, else `'done'`. Trigger keeps `status_updated_at`
fresh.

**UI surfaces**:
- **Inbox list** — pill on each row showing the status, plus a
  filter chip-row at the top (All / New / Active / Waiting customer
  / Waiting support / Done / Transferred). Default filter: "Open"
  (everything except `done`).
- **Thread page header** — status dropdown next to the inbox chip.
- **Status-change events** — should fire a webhook
  (`event: "conversation_status_changed"`) so customer systems can
  react. New payload shape sits beside `message_received`.

**Open questions for the founder**:
- Should a new inbound message automatically flip status to
  `waiting_support`? Or always require manual transition?
  (Recommend: auto-set `waiting_support` on inbound, `waiting_customer`
  on outbound, but expose a manual override. Document the rules
  prominently.)
- `transferred` — transferred to whom? Another agent (so we need
  agent identities), another inbox, or external (Salesforce, etc.)?
  Recommend: another inbox in the same business for v0.x; "external"
  is a free-text note.
- `assigned_to` — is this round shipping agent assignment, or just
  the column for future use? Recommend column now, UI later.

**Affected files**:
- New migration `0016_conversation_statuses.sql`.
- Webhook payload type in `src/lib/tenant-webhook.ts` (after round 2
  prompt 5 has landed).
- Inbox list page (`src/app/dashboard/inbox/page.tsx`) — add filter
  + status pills.
- Thread page (`src/app/dashboard/inbox/[id]/page.tsx`) — add status
  dropdown.
- Server actions for status changes
  (`src/app/dashboard/_actions/conversations.ts`).

### D. Dedicated create + edit routes

**What changes**: round 2 implemented "create inbox" / "create
business" as in-page dialogs in Settings. The founder wants
dedicated *routes* for them — a more pro feel, shareable URLs,
deeper forms.

**Concrete spec to propose**:

```
/dashboard/businesses/new           — create-business form (full step-flow)
/dashboard/businesses/[id]/edit     — edit business
/dashboard/inboxes/new              — create-inbox (project selector + form)
/dashboard/inboxes/[id]/edit        — edit inbox
```

The existing inline editors in Settings can stay as a quick path or
be removed in favour of "→ Edit" links to the new routes. Recommend
keeping inline editors for renames (cheap path) and linking to the
full edit page for richer changes (purpose/audience/webhook/embed).

The dialogs from round 2 (`AddInboxDialog.tsx`, `AddBusinessDialog.tsx`)
are demoted to "Quick add" optional UI — or removed if the founder
prefers one clear path.

**Affected files**:
- Four new pages under `src/app/dashboard/businesses/` and
  `src/app/dashboard/inboxes/`.
- Update sidebar's "+ Create inbox" and "+ Add another business"
  links to point at the new routes.

**Open question for the founder**:
- Add a top-level nav entry for these, or keep them reachable only
  from sidebar + settings links? Recommend: no new top-level tab
  (keeps the sidebar clean), reachable from the switcher footers and
  Settings.

### E. Settings reorganisation + billing

**The biggest theme**. The Settings tab today (after round 2) is a
single long page with business info, projects, inboxes, danger zone.
The founder wants it broken into sections covering:

1. **Business info** — name, plan, profile fields from Theme B,
   logo upload.
2. **Billing** — current plan, change plan, invoices, billing history,
   payment method.
3. **MCP access** — generate/rotate the MCP access key for the
   business (theme F uses this).
4. **Account & data** — request data export, request account
   deletion, request data deletion (GDPR-style).
5. **Statistics** — overall metrics (conversations, messages,
   inboxes, etc.) with time-range filter.

**Concrete spec to propose**:

Settings becomes a tabbed page (or a router-based sub-nav):

```
/dashboard/settings              → redirect to /dashboard/settings/business
/dashboard/settings/business     → business info + profile
/dashboard/settings/billing      → plan, invoices, history
/dashboard/settings/mcp          → MCP access keys
/dashboard/settings/account      → data + account deletion
/dashboard/settings/statistics   → overall stats
```

Each is a Server Component with its own data fetch. Shared
left-aligned sub-nav rail (12rem wide) inside the Settings page,
matching the landing aesthetic.

#### E.1 Billing data model

```
plans                           -- catalog (seed data, not user-editable)
  id text primary key            -- 'free' | 'starter' | 'growth' | 'scale'
  name text not null
  monthly_price_cents int not null   -- 0 for free
  max_businesses int not null         -- 2 for free
  max_inboxes_per_business int not null   -- 2 for free
  max_conversations_per_month int not null
  features jsonb not null default '{}'::jsonb

businesses
  + current_plan_id text not null default 'free' references plans(id)
  + plan_renews_at timestamptz NULL     -- next renewal; null on free
  + revolut_customer_id text NULL
  + revolut_subscription_id text NULL

invoices
  id uuid primary key
  business_id uuid not null references businesses(id)
  plan_id text not null references plans(id)
  amount_cents int not null
  currency text not null default 'GBP'
  status text not null check (status in ('draft','open','paid','failed','refunded'))
  revolut_payment_id text NULL
  paid_at timestamptz NULL
  period_start date not null
  period_end date not null
  invoice_url text NULL                 -- hosted PDF link
  created_at timestamptz not null default now()

billing_events
  -- append-only log of every Revolut webhook + every plan change
  id uuid primary key
  business_id uuid references businesses(id)
  kind text not null
  payload jsonb not null
  created_at timestamptz not null default now()
```

Free-tier limits enforced at insert time (DB triggers + server
actions):

- Round 1 already enforces ≤ 2 businesses per owner.
- **New**: per-business inbox cap = `plans.max_inboxes_per_business`
  for the business's current plan. Trigger on `inboxes` BEFORE INSERT.
- **New**: monthly conversation cap → write to `chat_billing.status`
  when exceeded. Conversations beyond the cap still land (we don't
  drop messages) but the business goes into `overage` status and the
  dashboard nags to upgrade.

#### E.2 Revolut checkout integration

The founder confirmed Revolut (not Stripe). Use **Revolut Merchant
API** (server-side) with the **Hosted Payment Page** redirect flow
— simplest path, no PCI scope.

Flow:
1. User clicks "Upgrade to Starter" in Settings → billing.
2. Server action creates a Revolut order via the Merchant API and
   returns the `checkout_url`.
3. Browser redirects to Revolut's hosted page; user pays.
4. Revolut webhooks `chat-admin/api/billing/revolut/webhook`.
5. Webhook handler verifies signature, updates `invoices.status`,
   updates `businesses.current_plan_id`, appends a `billing_events`
   row.
6. Revolut redirects user to `/dashboard/settings/billing?paid=1`.

Env vars needed:
- `REVOLUT_API_KEY` (server-only)
- `REVOLUT_WEBHOOK_SECRET` (server-only)
- `REVOLUT_ENVIRONMENT` (`sandbox` | `production`)

**Open questions for the founder**:
- What plans exist and what do they cost? Need the price list to
  seed the `plans` table.
- Currency — GBP only (Revolut's home), or also EUR / USD?
- Billing cycle — monthly only, or annual with discount?
- Trial period — free tier IS the trial, or paid plans get a 14-day
  trial?
- Tax handling — Revolut handles VAT for EU/UK; confirm we don't need
  custom tax logic.
- Refund policy — automatic on cancellation, or support-mediated?

#### E.3 MCP access keys

A separate key from the inbox `pk_live_…` keys. Lives at the
business level (one or more keys per business, since the user might
want to revoke a key without disrupting other integrations).

```
mcp_access_keys
  id uuid primary key default uuid_generate_v4()
  business_id uuid not null references businesses(id) on delete cascade
  name text not null                          -- "My laptop", "CI bot", …
  key_hash text not null unique               -- argon2id hash of the raw key
  key_prefix text not null                    -- "mcp_live_abcd" — for UI display
  last_used_at timestamptz NULL
  created_at timestamptz not null default now()
  revoked_at timestamptz NULL
```

Raw key format: `mcp_live_<32 hex>`. Shown **once** on creation; never
retrievable after. UI follows the GitHub-token pattern (show + copy
once, then a hash + last 4 chars).

**Open questions**:
- Is one MCP key per business enough, or do we need per-inbox MCP
  keys too? Recommend: business-level only — the MCP server can
  scope by `inbox_id` parameter, no need for per-inbox auth.
- Should the key give read-only or read-write access? Recommend:
  one key, full read-write — simpler. Permissions can come later.

#### E.4 Account + data deletion

GDPR-aligned. Two distinct flows:

- **Data deletion request** — the user asks to delete all data
  belonging to a specific *business* (or all their businesses). 30-day
  grace period (soft-delete first), then a scheduled hard-delete.
  Cancellable during the grace period.
- **Account deletion** — delete the `auth.users` row + everything that
  cascades. Also a 30-day grace period.

Both flows record a request in a new `deletion_requests` table:

```
deletion_requests
  id uuid primary key default uuid_generate_v4()
  user_id uuid not null references auth.users(id) on delete cascade
  kind text not null check (kind in ('business_data','account'))
  business_id uuid NULL references businesses(id)   -- only for business_data
  requested_at timestamptz not null default now()
  scheduled_at timestamptz not null                  -- requested_at + 30 days
  cancelled_at timestamptz NULL
  executed_at timestamptz NULL
```

A scheduled job (Vercel Cron, daily) runs `executeDueDeletions()`.

**Open questions**:
- Is 30 days the right grace period? Some products use 14 or 7.
- Does data deletion include the historic message bodies, or just
  PII (names, emails)? Recommend: full delete (the message bodies
  may contain PII anyway).
- What email notifications go out? Recommend: confirmation on
  request, reminder at T-7 days, execution receipt.

#### E.5 Statistics

Overall stats panel. Time-range selector (7d / 30d / 90d / all-time).
Metrics:
- Conversations created
- Messages sent (inbound vs outbound)
- Average first-response time
- Conversations resolved (status → `done`)
- Median resolution time
- Active inboxes count
- Per-inbox breakdown table (already in Usage; reuse the component)

Implementation: SQL aggregates per range, cached in
`unstable_cache` with 5-minute TTL.

### F. MCP server

The biggest single deliverable. A real **Model Context Protocol**
server that external AI tools (Claude Code, Claude Desktop, Cursor)
can connect to so the founder + customers can ask their AI to look
at conversations, send replies, summarise statuses, etc.

**Architecture options to evaluate** (this is the team lead's first
decision):

1. **Local stdio MCP server** — a separate Node process distributed
   as `@holylabs/chatkit-mcp` on npm. User installs locally, configures
   their MCP-aware client with `mcp_live_…` key. Lowest infra cost;
   limited to local-machine use.
2. **Remote HTTP/SSE MCP server** — hosted at
   `https://mcp.chatkit.dev` (or `chat-admin.holylabs.dev/mcp/v1/`)
   using MCP's HTTP transport. Auth via `Authorization: Bearer
   mcp_live_…` header. Cleaner for hosted customers; needs server
   capacity.
3. **Both** — local for dev/power users, remote for managed customers.

Recommend evaluating #1 first because it's much smaller; #2 can come
in a follow-up round when there's demand.

**Tools the MCP server should expose** (minimum viable surface):

| Tool                       | Purpose                                                     |
|----------------------------|-------------------------------------------------------------|
| `list_businesses`          | All businesses the key authorises (always 1 for now).       |
| `list_inboxes`             | Inboxes in a business (filtered by `archived_at is null`).  |
| `list_conversations`       | Conversations in an inbox, with status filter + paging.     |
| `get_conversation`         | Full conversation metadata + recent messages.               |
| `list_messages`            | Paginated message history for a conversation.               |
| `send_reply`               | Post a reply as the agent. Returns the new message id.      |
| `change_status`            | Transition a conversation to a new status.                  |
| `list_chat_users`          | End-users in a business (PII — gate by scope).              |
| `get_stats`                | Aggregate stats (conversations, messages, response times).  |
| `search_messages`          | Postgres FTS across message bodies in a business.           |

Authentication: each request carries `mcp_live_…`. Server verifies
via argon2 hash lookup in `mcp_access_keys`, records `last_used_at`,
attaches `business_id` to the request scope. All DB reads go through
the service client filtered by that `business_id` (RLS isn't usable
here — no `auth.uid()`).

Reference docs the team lead must read before designing:
- The MCP TypeScript SDK README on npm
  (`@modelcontextprotocol/sdk`).
- Anthropic's MCP docs (`docs.anthropic.com/en/docs/agents-and-tools/mcp/overview`)
  for the protocol shape, tool/resource/prompt conventions, and the
  recommended security posture.
- Look at an existing first-party MCP server (e.g. the Supabase MCP
  server's source on GitHub) for layout.

**Open questions for the founder**:
- Local-only or hosted? See architecture options above.
- Should the MCP server expose **resources** (URI-addressable
  read-only data like `chatkit://business/<id>/inbox/<id>`) in
  addition to tools? Recommend yes, eventually — start with tools.
- Should the MCP server expose **prompts** (templated prompts the
  user can pick in their MCP client, e.g. "summarise this
  conversation")? Recommend later — tools first.
- Where does the MCP server live in this repo? Recommend a new
  workspace folder `mcp-server/` at the repo root, with its own
  `package.json` and an npm-publishable name, sharing types with
  `chat-admin` via a relative import or a `@holylabs/types` package.

---

## 4. Suggested prompt breakdown (refine before writing)

A first cut. You'll iterate after the founder answers the open
questions.

```
prompts/round-3-billing-mcp-statuses/
├── README.md
├── 0-shared.md                 — round contracts: full-width rules,
│                                  status enum, plan limits, MCP-key
│                                  format, settings sub-nav structure.
├── 1-layout-full-width.md      — drop max-w-5xl, restyle Usage with
│                                  full-width grid, page-internal max-widths.
├── 2-business-profile.md       — migration 0015 + logo upload + settings
│                                  business section.
├── 3-conversation-statuses.md  — migration 0016 + inbox list filters +
│                                  thread status dropdown + webhook payload.
├── 4-create-edit-routes.md     — /businesses/new + /businesses/[id]/edit
│                                  + /inboxes/new + /inboxes/[id]/edit.
├── 5-settings-restructure.md   — sub-nav routes + business + stats sections.
├── 6-billing-data-model.md     — migrations 0017 plans/invoices/etc, plan
│                                  limits enforcement, seed data.
├── 7-billing-revolut.md        — Revolut Merchant API client, checkout
│                                  action, webhook route, billing settings UI.
├── 8-mcp-keys-and-account.md   — migration for mcp_access_keys +
│                                  deletion_requests, settings UI for both,
│                                  cron route for executing deletions.
└── 9-mcp-server.md             — the MCP server itself: new workspace,
                                   tools, auth, README for end users.
```

Ten prompts. Prompts 1–4 can run in parallel after 0-shared is
written. Prompts 5–8 chain a bit (settings sub-nav structure is set
in 5; billing depends on the data model in 6; MCP keys UI in 8 wants
the structure from 5). Prompt 9 is independent of everything except
0-shared.

If the founder wants a smaller first cut, defer MCP (#9) and
deletion executor cron (the cron half of #8) to round 4. That
collapses to 8 prompts.

---

## 5. Decisions to clarify with the founder BEFORE writing prompts

Use `AskUserQuestion` to gather these in a single batch (or two
batches if you prefer to scope by theme):

1. **"2 chats" meaning** — does the free-tier "2 chats" limit mean
   2 inboxes total (recommended interpretation) or 2 simultaneous
   conversations? The phrase is ambiguous; the existing terminology
   in the product calls inboxes "inboxes" and `conversations`
   "conversations." Confirm.
2. **Revolut plan catalogue** — full price list with currency,
   billing cycle, included limits per plan. Need this to seed the
   `plans` table.
3. **Free-tier inbox cap default** — confirm 2 inboxes per business
   on free, and what the cap is for each paid plan.
4. **Customer-facing logo** — does the business logo appear in the
   end-user widget, or only in the admin dashboard?
5. **Status automation** — auto-flip status on inbound/outbound
   messages, or always manual?
6. **`transferred` status semantics** — between inboxes only, to
   external systems, or both?
7. **Agent assignment now or later** — ship `assigned_to` column +
   UI this round, or column-only and UI later?
8. **MCP server target** — local stdio (npm package), hosted HTTP
   (SaaS endpoint), or both?
9. **MCP key permissions** — single full-access key per business, or
   role-scoped (read-only vs read-write)?
10. **Deletion grace period** — 30 days (industry norm), or shorter?
11. **Data deletion scope** — wipe message bodies too, or just PII
    (names/emails)?
12. **Edit page vs inline editor** — keep the round-2 inline editors
    in Settings as a "quick rename" shortcut, or remove them now that
    dedicated edit pages exist?

---

## 6. Critical references (don't skip)

Read these before designing:

| Concern                | File / section                                                  |
|------------------------|-----------------------------------------------------------------|
| Data model             | `supabase/migrations/0001_init.sql` + 0013–0014                 |
| Active context         | `src/lib/active-context.ts` (round 2 prompt 1)                  |
| Server-action style    | `src/app/dashboard/_actions/*` (round 2 prompts 4–6)            |
| Webhook payload + log  | `src/lib/tenant-webhook.ts`, `webhook_deliveries` table         |
| Existing settings page | `src/app/dashboard/settings/page.tsx` (after round 2 prompt 6)  |
| Embed key auth         | `src/lib/embed-auth.ts`, `src/lib/api-auth.ts`                  |
| Visual tokens          | `src/app/globals.css`, `prompts/prompt0-shared.md`              |
| Onboarding shell       | `src/app/dashboard/_components/onboarding/OnboardingModal.tsx`  |
| Form primitives        | `src/app/dashboard/_components/ui/primitives.tsx` (round 2)     |

External docs to bookmark:
- Revolut Merchant API: `developer.revolut.com/docs/accept-payments`.
- MCP SDK: `github.com/modelcontextprotocol/typescript-sdk`.
- MCP overview: `docs.anthropic.com/en/docs/agents-and-tools/mcp/overview`.
- Supabase Storage RLS: `supabase.com/docs/guides/storage/security/access-control`.

---

## 7. Process reminders

The founder's preferred workflow (proven across rounds 1 and 2):

1. **Explore first** — launch parallel `Explore` agents to verify
   the codebase state, especially anything rounds 1–2 promised but
   you can't 100% confirm has landed (e.g. that 0014 migration is
   pushed, that the round-2 webhook fix is in `tenant-webhook.ts`).
2. **Ask questions** — use `AskUserQuestion` with multi-select where
   it makes sense. The founder defaults to picking "Recommended"
   options when they're labelled, so phrase your recommendations
   clearly.
3. **Plan, don't code** — your deliverable is the prompts folder.
   No application code changes from you. (Each prompt itself
   instructs a future session to write code.)
4. **Self-contained prompts** — each prompt must be runnable by a
   fresh Claude Code session that has read only `prompts/prompt0-shared.md`,
   the round's `0-shared.md`, and the prompt itself. Don't assume
   the next session remembers anything from this conversation.
5. **Flag round-N gaps** — round 2 caught a webhook gap left by
   round 1. Be similarly paranoid: when a migration drops a column,
   grep the codebase for the old column name and tell the implementing
   session what to fix.

Good luck.
