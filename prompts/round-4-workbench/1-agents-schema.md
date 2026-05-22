# 1 — Agent identities: schema, storage, visitor-facing header

Read `AGENTS.md` and `0-shared.md` before starting.

## Why this prompt exists

Before invites (prompt 2) or queues (prompt 3) can exist, the
`support_agents` table and the visitor-facing surface for an
agent's identity must land. This prompt is the **foundation** for
everything else in round 4.

You will:
1. Create migration `0021_support_agents.sql` exactly as
   specified in `0-shared.md` §2.1.
2. Create the `avatars` storage bucket with the same RLS pattern
   as `logos` (round 3).
3. Extend `src/lib/team.ts` so `requireRole` and friends consult
   `support_agents` for non-owner identities.
4. Add `listAgents`, `getAgent`, `setAgentStatus` helpers in
   `src/lib/team.ts`. **DO NOT** add invite/revoke helpers here
   — those live in prompt 2.
5. Surface the assigned agent's name + avatar in the embed
   widget's ThreadPanel header when `conversations.assigned_to`
   is non-null.

You will **not** add the invite flow, the workbench, the
assignment trigger, or any UI for managing agents in the
dashboard. That's prompts 2 → 4.

---

## Step 1 — Migration `0021_support_agents.sql`

Create `supabase/migrations/0021_support_agents.sql` with the
exact schema, indexes, and RLS policies from `0-shared.md` §2.1.

Key requirements:

- Use `create table if not exists` / `create index if not exists`
  guards. Migrations in this repo are idempotent.
- The unique constraint is `unique (business_id, user_id)` — a
  human can be an agent for multiple businesses, but only one
  row per `(business, human)` pair.
- The two `select` RLS policies must use `(select auth.uid())`
  inside the predicate (Supabase performance rule — see
  `supabase-postgres-best-practices`). Cast comparisons through
  the same helper.
- Add a `comment on table support_agents is '…';` documenting
  the role meaning ("agent = works queue; lead = also invites
  others; owner is implicit via businesses.owner_user_id").
- Do **not** add any backfill — there are no agents yet.

After writing the migration, apply it locally:

```bash
supabase db push --linked   # or `supabase db reset` if that's your habit
```

Verify the table exists with `\d support_agents` in psql and run
`pnpm run db:types` (or whatever this repo uses — check
`package.json`) to regenerate `src/lib/supabase/database.types.ts`.

---

## Step 2 — `avatars` storage bucket

Create the bucket and its RLS policies. There is no migration
file for storage policies in this repo style; check how the
`logos` bucket was created in round 3 (probably via the Supabase
dashboard or a `storage.policies` migration block — grep the
migrations for "logos" and follow whichever pattern is in use).

Bucket config:
- `id = 'avatars'`
- `public = true` (avatars are public — they're shown to chat
  visitors)
- `file_size_limit = 2_000_000` (2 MB)
- `allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp']`

RLS policies on `storage.objects`:
- `select`: `bucket_id = 'avatars'` (public read).
- `insert` / `update` / `delete`: only when
  `(storage.foldername(name))[1] = (select auth.uid())::text`.
  Files live at `avatars/<user_id>/<random>.png`.

Mirror the `BusinessLogoUploader.tsx` component into a new
`src/app/dashboard/_components/ui/AgentAvatarUploader.tsx`:
- Drop-area + image preview + remove button.
- POSTs to a server action that uploads via the service client
  (path `<user_id>/<crypto.randomUUID()>.png`) and updates
  `support_agents.avatar_url` for the matching row(s).
- 256×256 crop client-side before upload (use the same library
  the logo uploader uses; don't introduce new deps).

The uploader will be wired into the invite-accept page in
prompt 2 and into a "My profile" panel in the Workbench (prompt
3). Just build the component in this prompt; no consumers yet.

---

## Step 3 — Extend `src/lib/team.ts`

The current 67-line stub treats only the business owner as
authorised and exports a `TeamRole` of `'owner' | 'admin' |
'agent'`. Round 4 changes the rank to `'owner' | 'lead' |
'agent'` and resolves agents via `support_agents`.

Required exports after this prompt:

```ts
export type TeamRole = "owner" | "lead" | "agent";

export type RoleGuardResult =
  | { ok: true; userId: string; role: TeamRole; agentId: string | null }
  | { ok: false; error: string };

export async function requireRole(
  businessId: string,
  minRole: TeamRole,
): Promise<RoleGuardResult>;

export async function getRoleForBusiness(
  businessId: string,
): Promise<TeamRole | null>;

// New in this prompt:
export interface SupportAgent {
  id: string;
  user_id: string;
  business_id: string;
  display_name: string;
  avatar_url: string | null;
  role: "agent" | "lead";
  status: "online" | "away" | "offline";
  status_changed_at: string;
  invited_at: string;
  accepted_at: string | null;
  archived_at: string | null;
}

export async function listAgents(businessId: string): Promise<SupportAgent[]>;
export async function getAgent(agentId: string): Promise<SupportAgent | null>;
export async function getAgentForUser(
  businessId: string,
  userId: string,
): Promise<SupportAgent | null>;
export async function setAgentStatus(
  agentId: string,
  status: "online" | "away" | "offline",
): Promise<void>;
```

Implementation rules:

- `requireRole` resolves role in this order: owner of business
  → lookup `support_agents` row where `business_id = $1 AND
  user_id = auth.uid() AND accepted_at is not null AND
  archived_at is null`. Use that row's `role` if found.
- `agentId` in `RoleGuardResult` is the `support_agents.id` if
  the role came from `support_agents`, else `null` (owner).
- All reads go through `getServiceClient()` — RLS gates are
  enforced manually by these helpers because most callers are
  Server Actions.
- `setAgentStatus` also writes `status_changed_at = now()`. It
  does **not** broadcast Realtime — that's round 5.
- Search the repo for any `TeamRole === 'admin'` references and
  remove them. The round-3 stub anticipated `admin` but nothing
  shipped with it.

After updating, run `pnpm typecheck` (or `npx tsc --noEmit`).
Anywhere that breaks must be fixed in this prompt.

---

## Step 4 — Visitor-facing identity in the embed widget

Goal: when a visitor's conversation has been assigned to an
agent, the chat widget's header swaps from a generic "Support"
title to the agent's avatar + display name.

### 4a — API: include agent identity

Find the widget's "load conversation" endpoint. Likely paths
(grep to confirm):
- `src/app/api/embed/conversations/[id]/route.ts`
- `src/app/api/embed/conversations/route.ts`
- `src/app/api/embed/messages/route.ts`

In whichever endpoint returns the conversation envelope to the
widget, include an `agent` field:

```ts
agent: conv.assigned_to
  ? await getAssignedAgentSummary(conv.business_id, conv.assigned_to)
  : null
```

Add `getAssignedAgentSummary(businessId, userId)` to
`src/lib/team.ts`:

```ts
export async function getAssignedAgentSummary(
  businessId: string,
  userId: string,
): Promise<{ display_name: string; avatar_url: string | null } | null> {
  // service client, SELECT display_name, avatar_url
  // WHERE business_id = $1 AND user_id = $2 AND archived_at IS NULL
}
```

Cache key the existing fetch already uses (if any) needs the
agent's user_id added. Audit `unstable_cache` usage in the route
— if there's a TTL, mention it in the PR description.

`conversations.assigned_to` does **not** exist in the DB until
prompt 4's migration. For this prompt, the API field exists but
is always `null` because the column is missing. That is
intentional — prompts 2/3 build on top of "agent always null"
and prompt 4 wires the column.

Write the code so it compiles without the column by selecting
`assigned_to` only inside a `try`/`catch` or with a feature-flag
check (`if ('assigned_to' in conv)`). The cleanest approach:
return `agent: null` unconditionally in this prompt with a TODO
comment referencing prompt 4. Prompt 4 will swap the TODO for
the real lookup.

### 4b — Widget header

`src/app/embed/widget/ThreadPanel.tsx` is the file that renders
the visitor-side header. It's 635 lines — over the cap — but
prompt 6 owns the split. **In this prompt**, make only the
minimum edit necessary to render the agent's identity.

Add to the header (inside whatever element currently shows the
"Support" title):

```tsx
{conversation.agent ? (
  <div className="flex items-center gap-2">
    {conversation.agent.avatar_url ? (
      <img
        src={conversation.agent.avatar_url}
        alt=""
        className="h-6 w-6 rounded-full object-cover"
      />
    ) : (
      <InitialsChip name={conversation.agent.display_name} size="sm" />
    )}
    <span>{conversation.agent.display_name}</span>
  </div>
) : (
  <span>Support</span>
)}
```

`InitialsChip` already exists somewhere (grep — likely
`src/app/dashboard/_components/ui/`). If not, write a tiny inline
inline implementation (8 lines max) — initials derived from
first letters of the first two whitespace-split tokens, with a
deterministic colour from a hash of the name.

Note: prompt 6 will move the header into a new
`ThreadPanelHeader.tsx`. Don't pre-emptively split here — let
prompt 6 handle it. Your job is the minimum diff.

---

## Step 5 — Avatar uploader without a page

You've built `AgentAvatarUploader.tsx` in step 2. It has no
consumer yet. That's fine — prompt 2 mounts it on the
invite-accept page and prompt 3 mounts it in the Workbench
profile drawer. Verify it compiles and the storage bucket
accepts an upload by running a one-off:

```bash
pnpm dev
# In another shell:
curl -X POST 'http://localhost:54321/storage/v1/object/avatars/<uuid>/test.png' \
  -H "Authorization: Bearer <a logged-in user JWT>" \
  --data-binary @some.png
```

(Local Supabase only; do not hit production.)

---

## Step 6 — Acceptance

Before declaring done:

1. `pnpm typecheck` — clean.
2. `pnpm lint` — clean.
3. Migration applied locally (`supabase db diff` shows no
   pending changes).
4. `select count(*) from support_agents;` returns 0.
5. The avatars bucket exists and is publicly readable; uploads
   succeed only for the user's own folder.
6. `grep -rn "TeamRole" src/` shows no `'admin'` references.
7. The widget's `ThreadPanel.tsx` still loads on
   greenflagged.xyz (`pk_live_45f4942f494ae8a94da8aca3`) and
   shows "Support" in the header because no conversations have
   `assigned_to` set yet.

`wc -l` audit on every file you created or modified:

```bash
wc -l \
  supabase/migrations/0021_support_agents.sql \
  src/lib/team.ts \
  src/app/dashboard/_components/ui/AgentAvatarUploader.tsx \
  src/app/embed/widget/ThreadPanel.tsx \
  src/app/api/embed/conversations/*/route.ts
```

Every count must be ≤ 600. If `ThreadPanel.tsx` is still 635
after your edits, that's expected — prompt 6 splits it. Mention
in the PR description that the line cap is knowingly held over
for prompt 6.

If any *other* file you touched crossed 600, split it before
declaring done.

---

## Out of scope (do NOT do in this prompt)

- Invite emails / `invitations` table — prompt 2.
- Workbench UI — prompt 3.
- `assigned_to` column or assignment trigger — prompt 4.
- Webhook redesign / events list — prompt 5.
- Splitting `ThreadPanel.tsx` — prompt 6.
- Realtime presence — round 5.

Hand off to prompt 2.
