# 3 — Workbench UI: queue, thread, status toggle

Read `AGENTS.md` and `0-shared.md` before starting. Depends on
prompts 1 + 2 — agents and invites must work.

## Goal

A dedicated `/workbench` surface where agents see two queues
(My Queue + Unassigned), open conversations from either, reply,
and toggle their own online status. Owners use the same surface
as a "manager view" with cross-agent visibility.

`conversations.assigned_to` does not yet exist as a column —
prompt 4 adds it. **In this prompt**, build the UI assuming the
column will exist, but use a feature-flag-style fallback so the
page works against current `main`:

```ts
// pseudocode — use this pattern in queue queries
const hasAssignedTo = await supabaseSchemaHasColumn(
  'conversations',
  'assigned_to',
);
const assignedExpr = hasAssignedTo ? 'assigned_to' : 'NULL::uuid as assigned_to';
```

Once prompt 4 lands, delete the fallback in your PR description's
follow-up checklist. (Don't gate behind an env var — schema
check is cheaper and self-healing.)

---

## Step 1 — Route layout

Create the route group `src/app/workbench/`:

```
src/app/workbench/
├── layout.tsx                  -- Workbench chrome (no dashboard sidebar)
├── page.tsx                    -- Two-pane queue + empty state on the right
├── [conversationId]/
│   └── page.tsx                -- Same chrome, right pane = ThreadView
├── _components/
│   ├── WorkbenchTopBar.tsx     -- Brand, status toggle, business switcher, "Manager view" filter
│   ├── QueueRail.tsx           -- Left rail with My Queue + Unassigned sections
│   ├── QueueRow.tsx            -- One conversation row
│   ├── ClaimButton.tsx         -- "Claim" / "Transfer" / "End" actions
│   ├── StatusToggle.tsx        -- Online/Away/Offline radio toggle (writes via server action)
│   └── ManagerViewToggle.tsx   -- Owner-only: "Show all queues" filter (default off → behaves like an agent)
└── _actions/
    ├── presence.ts             -- setStatus, tick (heartbeat)
    └── claim.ts                -- claimConversation, transferConversation
```

Guard every page with `requireRole(activeBusinessId, 'agent')`
— owner, lead, and agent all pass. The middleware redirect
from prompt 2 already routes plain agents away from
`/dashboard`, but `/workbench` itself accepts owner traffic.

---

## Step 2 — Top bar (`WorkbenchTopBar.tsx`)

A thin (48px) top bar replacing the dashboard sidebar:

```
┌────────────────────────────────────────────────────────────────┐
│ chatkit · Workbench  │  ⬤ Online ▾  │  Acme Sales ▾  │  Roman ▾ │
└────────────────────────────────────────────────────────────────┘
```

- Brand on the left (links to `/workbench`).
- Status toggle (component below) — only visible if the caller
  is an agent (i.e. has a `support_agents` row). Owners
  without an agent row see nothing here.
- Business switcher — reuses
  `src/app/dashboard/_components/sidebar/BusinessSwitcher.tsx`
  (extract or rerender). Only lists businesses where the user
  is owner OR has an accepted `support_agents` row.
- Account menu on the right — same as dashboard
  (`AccountMenu.tsx` likely exists; reuse).
- For owners: a "Manager view" pill toggle (next to the
  status). When on, the queue rail shows every agent's queue,
  not just the owner's. Default off.

Visual style: same ink/deep/mist palette, top bar background =
`bg-ink-950` (or whatever the deep ink token is — verify in
`globals.css`).

---

## Step 3 — Status toggle (`StatusToggle.tsx`)

Three states: `online` / `away` / `offline`. Visualised as a
filled dot + label, click opens a popover with the three
options.

Behaviour:
- On mount, read the current status from `support_agents` for
  (active business, current user) via a server action
  `getOwnStatus()`. Initialise to `'offline'` if no row.
- Selecting a state calls `setStatus(state)` server action,
  which updates `support_agents.status` +
  `status_changed_at`.
- While the selection is `online`, start a 60-second
  `setInterval` that calls `tick()` server action. `tick()`
  updates only `status_changed_at = now()` (cheap). Stop the
  interval when status flips off or the component unmounts.
- On `visibilitychange`: if the tab goes hidden for > 5
  minutes, optimistically flip the UI to `away`. Don't write
  to the server — the 5-minute staleness rule in
  `0-shared.md` §4 catches it.
- No Realtime presence in round 4. The status visible to
  *other agents* in the queue rail won't update live; it
  refreshes when they navigate or when the rail revalidates
  (use Next's `revalidatePath` on assignment changes — prompt
  4 ties this together).

Server actions in `src/app/workbench/_actions/presence.ts`:

```ts
export async function getOwnStatus(): Promise<
  { status: 'online' | 'away' | 'offline'; agentId: string | null }
>;
export async function setStatus(
  status: 'online' | 'away' | 'offline',
): Promise<void>;
export async function tick(): Promise<void>;
```

All three: `requireRole(activeBusinessId, 'agent')`. `tick`
must be idempotent — if there's no `support_agents` row (e.g.
the owner toggled status without being an agent — disallow on
the UI side first), it returns silently.

---

## Step 4 — Queue rail (`QueueRail.tsx` + `QueueRow.tsx`)

Left pane, 320px wide, two sections:

```
┌─────────────────────────────────┐
│ My Queue                    (3) │
│ ─────────────────────────────── │
│ 🟢  Alex · #4923                │
│      "is the export ready..."   │
│      Acme Sales · 2m            │
│ ─────────────────────────────── │
│ ...                             │
│                                 │
│ Unassigned                  (8) │
│ ─────────────────────────────── │
│ 🟡  Sam · #4951                 │
│      "where do I download..."   │
│      Acme Sales · 12s           │
└─────────────────────────────────┘
```

### Data fetching

Server Component. Uses the service client and the agent's user
id (resolved via `getServerClient().auth.getUser()`).

**My Queue query**:
- Select conversations for the active business where
  `assigned_to = current user.id` AND `status not in ('done',
  'transferred')`. Order by `status_updated_at DESC`.
- Limit 50.
- Resolve each conversation's "last inbound preview" via the
  existing inbox-list query pattern (see
  `src/app/dashboard/inbox/page.tsx`). Reuse the helper if one
  exists.

**Unassigned query**:
- Select conversations for the active business where
  `assigned_to is null AND status in ('new','active','waiting_support')`
  OR (after prompt 4 ships) `reassign_after < now()`.
- Order by `status_updated_at ASC` (oldest first — they need
  help).
- Limit 50.

**Manager view (owner toggle on)**:
- "My Queue" becomes "All assigned" (every agent's threads,
  grouped by agent display_name).
- "Unassigned" same as before.

Status pill colours follow `src/lib/conversation-status.ts`'s
existing palette (if one exists — check the file from round
3). Don't introduce new colours.

### Realtime updates

Use the existing `src/lib/realtime.ts` channel for the business
to subscribe to `conversations` changes. On any change, call
`router.refresh()` (or revalidate the rail's Server Component).
That's all — no diffing.

If `realtime.ts` doesn't already expose a `business:<id>`
channel, this prompt does NOT add one. Fall back to a 10-second
polling refresh of the rail. Note in the PR description what
the polling cadence is and the upgrade path.

---

## Step 5 — Right pane (Thread)

The right pane has two states:

### 5a — `/workbench` (no conversation selected)

Empty state. Single centred message: "Pick a conversation from
the left. Or {claim a new one}." The "claim a new one"
inline-link triggers `claimConversation(nextUnassigned)` — a
server action that picks the oldest unassigned conversation
and calls the assignment path (see prompt 4 for the underlying
function, but the action exists in this prompt too — see
below).

### 5b — `/workbench/[conversationId]`

Render the existing `ThreadView` from
`src/app/dashboard/inbox/[id]/ThreadView.tsx`. Extract it to a
shared location if it currently lives only under the dashboard
route:

```
src/app/_shared/ThreadView/
├── index.tsx           — composition root
├── ThreadHeader.tsx
├── ThreadMessages.tsx
└── ThreadComposer.tsx
```

(Don't split files just to split files — extract only if
necessary to reuse without coupling the workbench to dashboard
internals.)

Add three action buttons in the header for the workbench
context:

| Button | Action | Visible when |
|--------|--------|--------------|
| **Claim** | `claimConversation(id)` | `assigned_to is null` OR `assigned_to != current user` AND caller is owner/lead (transfer-style) |
| **Transfer** | Opens a popover listing other agents → `transferConversation(id, toUserId)` | `assigned_to = current user` |
| **End** | Sets `status = 'done'` via existing `_actions/conversations.ts` setStatus | Always when assigned |

`Transfer` popover lists every active agent in the business
(via `listAgents`) sorted by effective status (`online` first).

### Action implementations

`src/app/workbench/_actions/claim.ts`:

```ts
export async function claimConversation(conversationId: string): Promise<void>;
// requireRole('agent'). Update conversations.assigned_to = caller user id,
// assigned_at = now(). Update support_agents.last_assigned_at = now() for
// the caller's row. revalidatePath('/workbench').

export async function transferConversation(
  conversationId: string,
  toUserId: string,
): Promise<void>;
// requireRole('agent'). Verify `toUserId` is an accepted, non-archived
// support_agents row in the active business. Update assigned_to + assigned_at.
// revalidatePath('/workbench').

export async function claimNextUnassigned(): Promise<string | null>;
// requireRole('agent'). Pick the oldest 'new'/'waiting_support' conversation
// with assigned_to is null in this business. Claim it. Return its id (so the
// UI can navigate). Return null if queue empty.
```

These run **without** going through prompt 4's
`assign_conversation()` trigger function — manual claim is a
direct UPDATE.

If `conversations.assigned_to` doesn't exist yet (prompt 4
hasn't landed), the actions detect that and return a friendly
error without writing. Surface "Assignment isn't enabled yet
— complete migration 0023." in the UI. The whole Workbench
queue still functions (read-only) without prompt 4 — only
claim/transfer is gated on the column.

---

## Step 6 — Owner manager view

When the active user is the business owner and the
`ManagerViewToggle` is on:
- "My Queue" header becomes "All assigned"; rows grouped by
  the assigned agent's display_name (each agent gets a
  collapsible sub-section).
- Owner can hover a row to see "Reassign" → opens the same
  Transfer popover.
- Status toggle in the topbar is hidden (owners aren't agents
  unless they also have a `support_agents` row for the
  business — rare but possible; in that case the toggle
  appears).

Persist the toggle state in localStorage (`workbench:manager`).

---

## Step 7 — Sign-in landing logic

After login, where does the user go?

- If owner of ≥ 1 business → `/dashboard` (no change from
  today).
- If agent of ≥ 1 business AND not an owner of any → `/workbench`.
- If both → `/dashboard` (owner default; they can flip to
  workbench via topbar entry).

Add a sidebar entry under `/dashboard` linking to `/workbench`
labelled "Workbench" with a subtle "queue" badge counter (count
of conversations assigned to them OR unassigned in the active
business). Refresh count every 30s via a tiny client
component.

The middleware redirect from prompt 2 handles plain agents
trying to hit `/dashboard`. The sign-in landing logic lives in
either the `/auth/callback` route or wherever post-login
redirects are picked — grep `src/app/auth/` to find.

---

## Step 8 — Acceptance

1. `pnpm typecheck` clean.
2. `pnpm lint` clean.
3. With prompt 4 NOT yet applied: Workbench loads, shows
   queues (Unassigned will have everything because no
   `assigned_to` exists), Claim button surfaces a friendly
   error.
4. With prompt 4 applied (test by jumping ahead in a branch
   if you must, or revisit acceptance after prompt 4 lands):
   - Sign in as agent A in browser 1.
   - Sign in as owner in browser 2.
   - Owner sends a test FAB message on greenflagged.xyz
     (`pk_live_45f4942f494ae8a94da8aca3`).
   - Agent A's "Unassigned" pane shows the new conversation.
   - Agent A clicks "Claim" → conversation moves to "My
     Queue".
   - Owner (manager view on) sees the row under agent A's
     section.
   - Agent A replies → message lands; the visitor on
     greenflagged.xyz sees agent A's display name + avatar
     in the widget header (this part is wired by prompt 1).
5. Status toggle: agent A flips to "Away" → server updates
   row → page reload reflects it.

`wc -l`:

```bash
wc -l \
  src/app/workbench/layout.tsx \
  src/app/workbench/page.tsx \
  src/app/workbench/[conversationId]/page.tsx \
  src/app/workbench/_components/*.tsx \
  src/app/workbench/_actions/*.ts \
  src/app/_shared/ThreadView/*.tsx
```

≤ 600 each. If `QueueRail.tsx` exceeds the cap after data +
markup, extract the data loader (`loadQueues.ts`) to a sibling
server file.

---

## Out of scope

- The `assigned_to` column / `assign_conversation()` trigger —
  prompt 4.
- Re-pickup-after-10-minutes flag — prompt 4 (the rail will
  surface it once that column exists).
- Realtime presence — round 5.
- Notes / @mentions / multi-agent collab — round 5+.

Hand off to prompt 4.
