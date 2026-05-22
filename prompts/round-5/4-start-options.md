# 4 — Conversation start options (tenant config + topic picker UI)

Read `AGENTS.md` and `0-shared.md` before starting. Depends on
prompt 2 (the customer namespace must exist and the find-or-create
endpoint must accept `start_option_id`) and prompt 3 (the
`required_skills` field must drive assignment).

## Goal

Two things the tenant configures, then one new UI in the widget:

1. **Settings page at `/dashboard/settings/start-options`** —
   owners list, create, reorder, edit, and disable conversation
   start options. Each option has a label, optional description,
   icon, `kind` (`support`/`order`/`direct`), and `required_skills`.
2. **Topic picker in the widget** — when the customer has no
   conversations, the empty state shows the topic buttons.
   When they have conversations, a persistent
   `+ New conversation` button at the top of the list opens
   the same picker as an overlay. Clicking a topic creates a
   conversation via `/api/embed/customer/conversations/find` with
   `start_option_id` and opens the new thread.

After this prompt: greenflagged users see the configured topics
and can start a billing conversation that auto-assigns to an
agent with the `billing` skill.

---

## Step 0 — Pre-flight

```bash
cat AGENTS.md
ls src/app/dashboard/settings/                  # confirm conventions
ls src/app/dashboard/_actions/                  # confirm conventions
grep -n 'conversation_start_options' src/lib/supabase/database.types.ts
# expect: the table is typed (prompt 1 ran already)
ls src/app/embed/customer/                      # confirm prompt 2 ran
grep -n 'start_option_id' src/app/api/embed/customer/conversations/find/route.ts
# expect: prompt 2 added the field
```

If any of those checks fail, the upstream prompt has not yet
landed — stop and resolve it first.

Read `node_modules/next/dist/docs/` on server actions and form
patterns before writing the settings page.

---

## Step 1 — Settings page route

Create `src/app/dashboard/settings/start-options/page.tsx`. Server
component. Loads options for the active business + active inbox,
passes them into a client section component.

```tsx
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requireRole } from "@/lib/team";
import { getServiceClient } from "@/lib/supabase/server";
import { StartOptionsSection } from "@/app/dashboard/_components/settings/StartOptionsSection";
import { PageHeader } from "…";  // existing settings shell

export default async function Page() {
  const c = await cookies();
  const businessId = c.get("chatkit_active_biz")?.value;
  if (!businessId) redirect("/dashboard");
  const guard = await requireRole(businessId, "owner");
  if (!guard.ok) redirect("/dashboard");

  const svc = getServiceClient();

  // Inbox picker: most businesses have one. Order by created_at;
  // first inbox is the default. (Multi-inbox UI is a round-6
  // refinement; for now, options are scoped per-inbox but the UI
  // only exposes the first one. Document this in a tooltip.)
  const { data: inboxes } = await svc
    .from("inboxes")
    .select("id, name")
    .eq("business_id", businessId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  const defaultInbox = inboxes?.[0];
  if (!defaultInbox) {
    return <EmptyState message="Create an inbox first." />;
  }

  const { data: options } = await svc
    .from("conversation_start_options")
    .select("*")
    .eq("inbox_id", defaultInbox.id)
    .order("sort_order", { ascending: true });

  return (
    <StartOptionsSection
      businessId={businessId}
      inboxId={defaultInbox.id}
      options={options ?? []}
    />
  );
}
```

Add the entry to `src/app/dashboard/_components/sidebar/NavMenu.tsx`
inside the Settings children array, after "MCP":

```ts
{ href: "/dashboard/settings/start-options", label: "Start options", icon: ListChecks, roles: ["owner"] },
```

(Pick an appropriate `lucide-react` icon — `ListChecks` or
`MessageCirclePlus` both work.)

---

## Step 2 — Server actions

Create `src/app/dashboard/_actions/start-options.ts`. Mirror the
mcp-keys.ts pattern from `src/app/dashboard/_actions/mcp-keys.ts`:
same `ActionResult` union, same `activeBusinessId()`,
`requireRole(businessId, 'owner')`, `revalidatePath` shape.

```ts
"use server";

type StartOptionInput = {
  inboxId: string;
  label: string;
  description: string | null;
  icon: string;                  // lucide icon name
  kind: "support" | "order" | "direct";
  required_skills: string[];
};

export async function createStartOption(input: StartOptionInput): Promise<ActionResult<{ id: string }>>;
export async function updateStartOption(input: { id: string } & Partial<StartOptionInput>): Promise<ActionResult>;
export async function reorderStartOptions(input: { ids: string[] }): Promise<ActionResult>;
export async function deleteStartOption(input: { id: string }): Promise<ActionResult>;
export async function toggleStartOptionActive(input: { id: string; is_active: boolean }): Promise<ActionResult>;
```

Behavior:

- All actions: `requireRole(businessId, 'owner')`. Reject if the
  inbox doesn't belong to the active business.
- `label`: trim, 1–60 chars.
- `description`: trim, ≤ 240 chars, nullable.
- `icon`: must match an allowlist of lucide icon names hard-coded
  in `src/app/dashboard/_components/settings/start-option-icons.ts`
  (export ~16 sensible icons: `message-circle`, `life-buoy`,
  `help-circle`, `package`, `receipt`, `credit-card`, `truck`,
  `calendar`, `user`, `shield`, `bug`, `book-open`, `briefcase`,
  `headphones`, `mail`, `bell`). Reject unknown values.
- `kind`: enum-checked.
- `required_skills`: same normalization rules as prompt 3 —
  each entry must match `/^[a-z0-9][a-z0-9-]{0,31}$/`. ≤ 8 entries.
- `reorderStartOptions`: accepts the full ordered ID list,
  updates `sort_order` 0..N. Reject if any ID doesn't belong to
  the active business's inbox.
- `revalidatePath('/dashboard/settings/start-options')` after
  every mutation.
- The find-or-create endpoint reads the option to copy
  `required_skills` onto the conversation insert — so a topic
  with no required skills routes to the unfiltered pool (prompt
  3's fallback).

Default seed: if a business has zero start options, the **first
page load** of the settings page seeds three sensible defaults
via the same server action (not migration — settings page-side):

```ts
[
  { label: "Support", icon: "life-buoy", kind: "support", required_skills: [] },
  { label: "Billing", icon: "credit-card", kind: "support", required_skills: ["billing"] },
  { label: "Order issue", icon: "package", kind: "support", required_skills: ["orders"] },
]
```

Do the seed inside a `seedDefaultStartOptions(businessId, inboxId)`
helper that the page calls only when `options.length === 0`. Skip
this if any options exist (even disabled ones).

---

## Step 3 — Settings UI

Create `src/app/dashboard/_components/settings/StartOptionsSection.tsx`.
Client component. Mirrors the structure of
`src/app/dashboard/_components/settings/McpKeysSection.tsx`.

Layout:

```
Start options · /dashboard/settings/start-options

These appear in your widget's "+ New conversation" picker.
Each option creates a new conversation routed by skill.

[ + Add option ]

┌──────────────────────────────────────────────────────────────┐
│ ⊞ Billing          credit-card   support  [billing]   ●     │
│   "Questions about charges or invoices"                      │
│   [Edit] [Disable] [Delete]                                  │
├──────────────────────────────────────────────────────────────┤
│ ⊞ Order issue      package       support  [orders]    ●     │
│   "Problems with a delivery or product"                      │
│   [Edit] [Disable] [Delete]                                  │
├──────────────────────────────────────────────────────────────┤
│ ⊞ Support          life-buoy     support  []          ●     │
│   "General questions or feedback"                            │
│   [Edit] [Disable] [Delete]                                  │
└──────────────────────────────────────────────────────────────┘
```

Interactions:

- "Add option": opens an in-place form (no modal needed for v0).
  Fields: label, description, icon picker, kind dropdown, required
  skills (chip editor matching the team-skills editor from prompt
  3). Save calls `createStartOption`. Cancel hides the form.
- "Edit" toggles the same form inline on that row.
- "Disable" toggles `is_active`; disabled rows render dimmed.
- "Delete" prompts a `confirm()` before calling
  `deleteStartOption`. Server action handles the
  `on delete set null` on `conversations.start_option_id`.
- Drag handle (`⊞`) reorders. Use the existing repo's drag
  library if one is already in `package.json`; otherwise keep
  it simple with up/down arrow buttons.

Components:

- `StartOptionRow.tsx` — single row, view + edit modes.
- `IconPicker.tsx` — small grid of the 16 allowed icons.
- `SkillChipsEditor.tsx` — reuse from prompt 3's team page if
  factored out; otherwise duplicate the inline implementation
  and leave a TODO comment for prompt-3 author to factor it
  out in round 6.

---

## Step 4 — Topic picker UI in the widget

Edit `src/app/embed/customer/ConversationList.tsx`.

Two new behaviors:

### 4.a — Fetch start options on mount

Add a fetch alongside the conversations list. Endpoint:
`GET /api/embed/customer/start-options`. Create the handler at
`src/app/api/embed/customer/start-options/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { authCustomer } from "@/lib/customer-auth";
import { getServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const auth = await authCustomer(request);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const svc = getServiceClient();
  const { data } = await svc
    .from("conversation_start_options")
    .select("id, label, description, icon, kind, required_skills, sort_order")
    .eq("inbox_id", session.inboxId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  // Filter to options whose kind is in the JWT's allowed_kinds.
  // Returning more would invite UX where a user picks something
  // they can't actually create.
  const allowed = new Set(session.claims.allowed_kinds);
  const options = (data ?? []).filter((o) => allowed.has(o.kind));

  return NextResponse.json({ options });
}
```

### 4.b — Render the picker

Restructure `ConversationList.tsx`:

- Top of the panel: a `+ New conversation` button (full width,
  primary color from `widget_config` — comes online in prompt 5,
  but accept a CSS variable hook now). Clicking it opens an
  overlay with the topic buttons.
- If `rows.length === 0`, the empty state is replaced with the
  topic buttons directly (no overlay needed — the panel body is
  the picker itself).
- Each topic button: icon + label + description; full-width tap
  target; rounded per `widget_config.roundness` (prompt 5
  hooks).
- Clicking a topic POSTs to
  `/api/embed/customer/conversations/find` with:

  ```json
  {
    "start_option_id": "<uuid>",
    "kind": "support",
    "external_ref": "<claims.sub>"
  }
  ```

  …then opens the returned conversation via `onOpen(id)`.

Keep `ConversationList.tsx` ≤ 600 lines. If it grows, extract:

- `TopicPicker.tsx` — the topic grid (reused in empty state and
  overlay).
- `NewConversationButton.tsx` — the `+ New conversation` button
  + overlay shell.

The overlay should:

- Use a small modal-in-iframe pattern (no portal needed, the
  iframe is the world). Backdrop click closes it. Escape closes.
- Focus trap: tab cycles within the overlay buttons. Keyboard
  navigation: arrow up/down to focus, Enter to pick.
- Aria: `role="dialog"`, `aria-labelledby` pointing at the
  greeting heading.

Greeting message: read it from a `widget_config` prop passed
down from `page.tsx` (prompt 5 wires this; for now, accept an
optional prop and render it above the topic buttons if present).

---

## Step 5 — `find` endpoint behavior (prompt 2 hook)

The handler at
`src/app/api/embed/customer/conversations/find/route.ts` (created
in prompt 2) should already accept `start_option_id`. Verify its
behavior matches:

1. Resolve the start option by id, scoped to `session.inboxId`,
   `is_active = true`.
2. Look up an existing conversation by `(inbox_id, external_ref,
   kind, start_option_id)`. If found, return it (don't create
   duplicates of the same topic for the same user).
3. Otherwise insert:

```sql
insert into conversations
  (tenant_id, inbox_id, kind, external_ref, participants, start_option_id, status)
values
  ($business_id, $inbox_id, $option.kind, $claims.sub,
   array[$claims.sub], $option.id, 'new');
```

The trigger from round 4 + the updated `assign_conversation()`
from prompt 3 do the routing automatically.

4. Return `{ conversation, created }`.

If prompt 2 didn't fully implement this contract, fix it here.
This prompt is the consumer; the contract is shared.

---

## Step 6 — Visual polish

- Topic buttons stack vertically when ≤ 3 options; switch to a
  2-column grid at 4+ options.
- Each topic icon is 20px lucide; label is 14px semibold; description
  is 12px regular (when shown).
- Hover/focus state: subtle background tint of primary color
  (computed from the hex — use `rgba(<r>,<g>,<b>,0.08)` from a
  small helper in `_lib/color.ts`).
- Disabled state: when the topic's `kind` is in `claims.allowed_kinds`
  but no matching skilled agents are online, the topic still
  renders enabled — we don't expose that information to the
  customer (deliberate; matches the brief's "operational confidence"
  goal). The conversation is created and surfaces in the
  Workbench Unassigned rail per prompt 3.

---

## Step 7 — Verification

```bash
# 1. Settings page round-trip
# Visit /dashboard/settings/start-options as an owner.
# - Confirm three default options seeded on first visit.
# - Add a "Refund request" option with required_skills=['refunds'].
# - Reorder it to the top. Reload — order persists.
# - Disable it — UI dims; widget no longer shows it.
# - Delete it — confirm prompt, then row gone.

# 2. Widget topic picker (empty state)
# Sign in to greenflagged.com as a brand-new user (so no prior
# conversations). Open widget — confirm topic buttons render
# with the configured labels and icons.

# 3. Start a conversation
# Click "Billing". The widget should switch to the thread view.
# Confirm in Supabase:
#   select kind, external_ref, participants, start_option_id, assigned_to
#     from conversations
#    where external_ref = '<your_user_id>'
#    order by created_at desc limit 1;
# expect: kind='support', external_ref=<sub>, start_option_id=<billing-uuid>,
#         assigned_to=<billing-skilled agent user_id>.

# 4. + New conversation overlay
# Reopen the widget with at least one existing thread. Confirm
# the "+ New conversation" button is at the top of the list.
# Click it → topic picker opens as overlay. Pick a different
# topic → new thread created (not a duplicate of the existing
# one, because start_option_id differs).

# 5. Same topic twice → reuses thread
# Pick "Billing" twice in a row. Second pick reuses the existing
# Billing conversation; no duplicate row.

# 6. Disabled topic
# Disable a topic in dashboard. Reload widget. Topic should
# disappear from the picker.

# 7. JWT scope
# Mint a JWT with allowed_kinds=['order'] only. Confirm only
# 'order'-kind topics appear in the picker.

# 8. Skill mismatch
# Configure a topic with required_skills=['unicorn'], and ensure
# no agent has that skill. Pick the topic. Conversation should
# create with assigned_to=null; verify it surfaces in Workbench
# Unassigned.
```

---

## Step 8 — Out of scope

- **Widget theming (color, icon, roundness).** Prompt 5 supplies
  the values via CSS variables; this prompt only adds the hooks
  (CSS variable names) where appropriate.
- **Multi-inbox UI.** This prompt scopes start options to the
  business's first inbox. Round 6 will add inbox switching.
- **Per-option custom welcome message.** The greeting is a
  single field on `widget_config` (prompt 5), shared across all
  topics. Per-option welcome copy is round 6 if customers ask.
- **Analytics rollup** (most-picked topics, etc.). Round 6.

---

## Definition of done

- [ ] `/dashboard/settings/start-options` exists, owners-only,
      lists/creates/edits/reorders/disables/deletes options.
- [ ] On first visit with zero options, the page seeds three
      sensible defaults via the server action.
- [ ] `/api/embed/customer/start-options` (GET) returns only
      active options for the inbox, filtered to
      `claims.allowed_kinds`.
- [ ] Widget empty state shows the topic buttons.
- [ ] Widget list view shows `+ New conversation` at top; click
      opens the same picker as overlay.
- [ ] Topic click creates a conversation via
      `/find` with `start_option_id`, opens the thread. Same
      topic twice = single thread.
- [ ] Routing by skill works end-to-end against greenflagged.com:
      Billing topic → agent with `billing` skill receives it.
- [ ] `wc -l` ≤ 600 on every touched/created file.
- [ ] All 8 verification steps documented in PR description.

End the PR description with: the file list, the seeded default
options, and a screenshot of the topic picker on greenflagged.
