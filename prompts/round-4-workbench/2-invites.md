# 2 — Agent invites, accept flow, and middleware role gates

Read `AGENTS.md` and `0-shared.md` before starting. This prompt
depends on prompt 1 — `support_agents` table and `src/lib/team.ts`
helpers must already exist.

## Goal

A business owner (or `lead` agent) can invite a colleague to be a
support agent by email. The invitee gets a single-use link, sets a
password, picks a display name + avatar, and lands in `/workbench`
for that business. Owners can resend or revoke pending invites.

Round 4 is **password only** — no OAuth. Round 5 may add Google.

---

## Step 1 — Migration `0022_invitations.sql`

Create `supabase/migrations/0022_invitations.sql` with the schema
in `0-shared.md` §2.3.

Add RLS:
- Service role bypass.
- `select` for the business owner only —
  `auth.uid() = (select owner_user_id from businesses where id = business_id)`.
- No other policies; all writes via server actions.

After applying: regenerate types.

---

## Step 2 — Resend setup

Add `resend` to dependencies:

```bash
pnpm add resend
```

Env vars (add to `.env.example` and document in the PR
description so the founder adds them in Vercel):
- `RESEND_API_KEY` — server-only.
- `RESEND_FROM_EMAIL` — e.g. `invites@chatkit.dev`. Verify the
  sending domain in Resend before going live.
- `APP_PUBLIC_URL` — already present? Grep to confirm. The
  invite emails need an absolute URL.

Create `src/lib/email/resend.ts`:

```ts
import "server-only";
import { Resend } from "resend";

let _client: Resend | null = null;
export function getResend(): Resend {
  if (_client) return _client;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not set");
  _client = new Resend(key);
  return _client;
}
```

Create `src/lib/email/templates/agent-invite.ts`:

```ts
export function agentInviteEmail(args: {
  businessName: string;
  inviterName: string;
  acceptUrl: string;        // absolute URL with token in path
  displayName: string;
  role: "agent" | "lead";
}): { subject: string; html: string; text: string };
```

Keep the template inline (no React Email package — extra dep
for marginal benefit). Plain HTML with the chatkit visual
palette (ink/deep/mist — see `prompts/round-3-brief.md` if
needed, or sample from a landing component). Include:
- Greeting using `displayName`.
- "{{inviterName}} invited you to join {{businessName}} as a
  support agent on Chatkit."
- A single primary CTA button → `acceptUrl`.
- Plain-text URL as a fallback paragraph below.
- Footer with "This invite expires in 7 days. If you didn't
  expect it, ignore this email."

---

## Step 3 — Server actions (`src/app/dashboard/_actions/team.ts`)

Create the file. All actions guard with `requireRole(businessId,
'lead')` — owner and `lead` agents can invite; plain `agent`
cannot.

```ts
"use server";

export async function inviteAgent(formData: FormData): Promise<
  { ok: true } | { ok: false; error: string }
>;
// fields: email, displayName, role ('agent' | 'lead')
// 1. Validate email shape, displayName length 1..80, role enum.
// 2. requireRole(activeBusinessId, 'lead').
// 3. Reject if a non-archived support_agents row already exists
//    for this email's auth.users.id in this business.
// 4. Reject if a pending invitation already exists (accepted_at
//    null AND revoked_at null AND expires_at > now()).
// 5. Generate raw token = 'inv_' + 32 hex chars.
//    token_hash = sha256(raw token), hex.
// 6. Insert invitations row, expires_at = now() + 7 days.
// 7. Email via Resend with acceptUrl = `${APP_PUBLIC_URL}/invite/${raw}`.
// 8. Append a billing_events row for audit
//    (kind='agent_invited', payload={email,role,invitation_id}).

export async function resendInvite(invitationId: string): Promise<...>;
// Same guard. Reject if accepted_at OR revoked_at is set.
// Reuse the existing token_hash — do NOT issue a new token on resend
// (so old links stay valid). Just bump expires_at to now()+7d and
// re-send the email. If founder later wants per-resend token rotation,
// flip that in a follow-up.

export async function revokeInvite(invitationId: string): Promise<...>;
// Same guard. Set revoked_at = now(). Don't delete — keep for audit.

export async function archiveAgent(agentId: string): Promise<...>;
// requireRole('lead'). Sets support_agents.archived_at = now().
// Cascades nothing automatically; leave existing assigned_to
// conversations alone — they'll surface in Unassigned via the
// stale-reassign flag once an inbound message arrives.

export async function setOwnDisplayName(displayName: string): Promise<...>;
export async function setOwnAvatarUrl(avatarUrl: string | null): Promise<...>;
// agent-self mutations. requireRole('agent'). Operate on the
// support_agents row for (active business, auth.uid()).
```

`activeBusinessId` comes from `src/lib/active-context.ts` —
follow the pattern in the existing `_actions/businesses.ts` or
`inboxes.ts`.

---

## Step 4 — Accept route `/invite/[token]`

Create `src/app/invite/[token]/page.tsx` (Server Component) and
`src/app/invite/[token]/AcceptForm.tsx` (Client Component for
the form).

### `page.tsx` responsibilities

1. Compute `token_hash = sha256(params.token)`.
2. Look up invitation by `token_hash`. If absent → 404 page.
3. If `revoked_at` or `accepted_at` set, or `expires_at < now()`
   → render an "invite no longer valid" state with a link to
   `mailto:` the inviter (whose email we have via
   `auth.users` lookup).
4. Render `<AcceptForm>` with invitation details
   (business name, display name suggestion, role).

### `AcceptForm.tsx` responsibilities

Two flows, selected on the server based on whether
`auth.users` has a row for the invitation's `email`:

**Case A — no existing auth user** (most common):
- Fields: email (read-only, pre-filled), password (min 8 chars,
  required), display name (pre-filled from invitation), avatar
  (uses `AgentAvatarUploader` from prompt 1, optional).
- Submit calls a server action `acceptInviteNewUser(token, …)`:
  1. Service-client `auth.admin.createUser({ email, password,
     email_confirm: true })`.
  2. Insert `support_agents` row with the new user's id,
     `accepted_at = now()`, display_name + avatar_url from form.
  3. Mark invitation `accepted_at = now()`.
  4. Sign the user in (set the session cookie).
  5. Set the active-context cookie to this business.
  6. Redirect to `/workbench`.

**Case B — auth user already exists**:
- Fields: email (read-only), password (required, used to verify
  the existing identity), display name (pre-filled), avatar
  (optional).
- Submit calls `acceptInviteExistingUser(token, password, …)`:
  1. Verify the password by attempting
     `signInWithPassword({ email, password })`. If it fails,
     return error.
  2. Insert `support_agents` row with the verified user's id.
  3. Mark invitation accepted.
  4. The sign-in already set a session — redirect to `/workbench`.

Both actions live in `src/app/dashboard/_actions/team.ts` (or a
new `src/app/invite/_actions/accept.ts` — choose by where
`server-only` is already established). Whichever you pick, keep
all token-handling on the server.

Token comparison must be **constant-time** —
`crypto.timingSafeEqual(Buffer.from(stored), Buffer.from(input))`.
Never `===` on hashes.

---

## Step 5 — `/dashboard/settings/team` page

The folder exists at `src/app/dashboard/settings/team/page.tsx`
as a stub. Replace it with:

- A heading "Support agents".
- An "Invite agent" button → opens a dialog with email +
  display name + role select. On submit calls `inviteAgent`.
- A list section "Pending invites" — rows show email, role,
  invited at, expires at. Each row has "Resend" and "Revoke"
  actions.
- A list section "Active agents" — rows show avatar +
  display_name + email (from auth.users join) + role +
  effective status + last accepted. Each row (other than the
  caller themselves) has "Archive" action. Status is
  read-only display — agents toggle it from the Workbench, not
  here.
- A muted note at the bottom: "Need to set up multiple
  inboxes? Visit Settings → Inboxes."

Visual style: follow `src/app/dashboard/settings/business/page.tsx`
for layout — nested cards, the round-3 sub-nav stays as the
parent shell. Settings sub-nav already includes a "Team" entry
(verify `SettingsNav.tsx`).

Guard the page with `requireRole(activeBusinessId, 'lead')`.
Plain agents shouldn't reach it — the middleware in step 6
redirects them — but defence in depth.

---

## Step 6 — Middleware role gates

Update `src/middleware.ts` per `0-shared.md` §3.

The current middleware (132 lines) probably already reads the
active business cookie and runs auth checks. Add a role resolver:

```ts
// Pseudocode — adapt to existing structure
const role = await resolveRole(supabase, activeBusinessId, user.id);
// 'owner' | 'lead' | 'agent' | null

const path = req.nextUrl.pathname;
if (path.startsWith('/workbench')) {
  // allow if role != null
}
if (path.startsWith('/dashboard/settings/billing')
 || path.startsWith('/dashboard/settings/business')
 || path.startsWith('/dashboard/settings/mcp')
 || path.startsWith('/dashboard/webhooks')
 || path.startsWith('/dashboard/businesses')
 || path.startsWith('/dashboard/inboxes')) {
  if (role !== 'owner') return NextResponse.redirect('/workbench');
}
if (path === '/dashboard' && role === 'agent') {
  return NextResponse.redirect('/workbench');
}
// /dashboard/settings/team allowed for owner + lead
if (path.startsWith('/dashboard/settings/team') && role === 'agent') {
  return NextResponse.redirect('/workbench');
}
// /dashboard/inbox/** allowed for all (read+reply guarded at page level)
```

Role resolution must be cheap. Two queries (one for ownership,
one for `support_agents`) is acceptable; cache nothing —
revocations should take effect on the next request.

The active-context cookie format already exists in
`src/lib/active-context.ts`. Extend it (or compute on every
request — that's simpler given there's no presence channel
yet) with the role. Keep the cookie shape backward-compatible:
if the existing shape is `{ businessId, projectId, inboxId }`,
optionally add `role` but don't make consumers depend on its
freshness — always reverify server-side.

If the middleware exceeds 200 lines after this change, extract
`resolveRole()` to `src/lib/team.ts` (it's already a team
concern) and import it.

---

## Step 7 — Sidebar adjustments

Agents and leads land in `/workbench` — they shouldn't see the
owner-only sidebar entries. Prompt 3 builds the workbench
chrome (which has a different sidebar / topbar). For
`/dashboard` paths that leads still visit (settings/team,
settings/account, inbox), the existing sidebar shows but should
hide Billing, MCP, Business, Webhooks links.

In whichever component renders the sidebar
(`src/app/dashboard/_components/sidebar/`), read the active
role from the active-context cookie and filter the nav list.
Owners see everything; leads see Team + Inbox + Account; plain
agents are redirected away by middleware before they ever
render the sidebar.

---

## Step 8 — Acceptance

1. `pnpm typecheck` clean.
2. `pnpm lint` clean.
3. Migration applied; `select * from invitations` returns 0 rows.
4. Invite flow happy path (test with two browser profiles):
   1. As owner of business X, visit
      `/dashboard/settings/team`, invite `agent@example.com`.
   2. Email arrives in Resend dashboard (or check
      `https://resend.com/emails` for a delivery row).
   3. Click link → accept form renders → set password →
      submitted → land in `/workbench`.
   4. Sign out, sign in as the same user → land in
      `/workbench` (active-context cookie picks the only
      business they're agent for).
5. Invite expiry: insert a row directly via SQL with
   `expires_at = now() - interval '1 day'`, hit `/invite/<token>`
   → "invite no longer valid".
6. Middleware redirects:
   - Owner can reach `/dashboard/settings/billing` ✓
   - Agent hitting `/dashboard/settings/billing` →
     `/workbench` redirect ✓
   - Agent hitting `/dashboard/inbox/<id>` → allowed ✓
7. `grep -rn "from \"resend\"" src/` shows the import only in
   `src/lib/email/resend.ts`. No leaks elsewhere.

`wc -l`:

```bash
wc -l \
  supabase/migrations/0022_invitations.sql \
  src/lib/email/resend.ts \
  src/lib/email/templates/agent-invite.ts \
  src/app/dashboard/_actions/team.ts \
  src/app/invite/[token]/page.tsx \
  src/app/invite/[token]/AcceptForm.tsx \
  src/app/dashboard/settings/team/page.tsx \
  src/middleware.ts \
  src/lib/team.ts
```

Every count must be ≤ 600. If `team.ts` is approaching the cap
after the role resolver addition, split it: keep
`requireRole`/`getRoleForBusiness`/`resolveRole` in
`src/lib/team.ts` and move the `SupportAgent` CRUD helpers
(`listAgents`, `getAgent`, etc.) to `src/lib/agents.ts`.

---

## Out of scope

- Workbench queue UI — prompt 3.
- Auto-assignment trigger — prompt 4.
- Webhook events for `agent.invited` — covered by prompt 5
  (and the brief mentions the event name; you've already
  written a `billing_events` audit log row, that's enough for
  now).
- Realtime presence — round 5.

Hand off to prompt 3.
