# Round 4 — Support Workbench

Six self-contained prompts that turn chat-admin from a single-owner
inbox into a multi-agent support operation: agent identities, email
invites, a dedicated `/workbench` queue, automatic round-robin
assignment, a redesigned webhooks + integrations surface, and a
mandatory split of the 635-line `ThreadPanel.tsx`.

Read `0-shared.md` before any prompt. Each prompt is runnable by a
fresh Claude Code session that has read only `AGENTS.md`,
`0-shared.md`, and the prompt itself — do not assume context from
other prompts or this README.

---

## Decision log (locked before prompts were written)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Email provider | **Resend** (`RESEND_API_KEY`) |
| 2 | Agent OAuth | **Password only** for v0.x |
| 3 | Multi-business agents | **Yes** — one auth user can be an agent for N businesses |
| 4 | Thread ownership | **Single assignee** per conversation |
| 5 | Assignment algorithm | **Least-loaded round-robin** among online agents |
| 6 | Off-hours behaviour | **Queue stays idle** until an agent comes online |
| 7 | Offline mid-conversation | **Stay assigned**, flag for re-pickup after 10 min of no agent reply |
| 8 | Presence transport | **Deferred to round 5.** Round 4 uses `support_agents.status` (manual toggle + 5-min staleness flip to `away`) |
| 9 | Webhook secret | **Dual-secret** (active + previous), Stripe-style |
| 10 | Allowlist scope | **Per-business** — schema already exists (migration 0020); round 4 ships the UI |
| 11 | Owner UX | **Owner uses `/workbench` as a manager view** with cross-agent visibility |
| 12 | Visitor-facing agent identity | **Display name + avatar**, fallback to initials chip |

---

## Migration numbering

`0020_business_allowed_origins.sql` is already on disk (per-business
allowlist schema, UI not yet built). Round 4 migrations start at
**0021** and run consecutively:

| Migration | Prompt | Adds |
|-----------|--------|------|
| `0021_support_agents.sql` | 1 | `support_agents` table, `avatars` storage bucket |
| `0022_invitations.sql` | 2 | `invitations` table with hashed tokens |
| `0023_assignment.sql` | 4 | `conversations.assigned_to`, `support_agents.last_assigned_at`, `assign_conversation()` function + triggers, re-pickup flag |
| `0024_inbox_webhook_signing.sql` | 5 | `inboxes.webhook_secret`, `inboxes.webhook_secret_previous`, `inboxes.webhook_secret_rotated_at`, `inboxes.webhook_events text[]` |

No migration in prompts 3 or 6.

---

## Prompt order & dependencies

```
0-shared.md   ← read first

1-agents-schema.md           (independent — establishes the table)
   ↓
2-invites.md                 (needs 1 — invites write support_agents rows)
   ↓
3-workbench-ui.md            (needs 2 — agents must exist to populate queue)
   ↓
4-auto-assignment.md         (needs 3 — claim/transfer wired via Workbench)

5-webhooks-redesign.md       (independent of 1–4; can run in parallel after 0-shared)
6-refactor-threadpanel.md    (independent; run LAST so widget header tweaks
                              from prompt 1 are merged in before splitting)
```

Prompts 1 → 2 → 3 → 4 are the **spine**. Prompt 5 is parallel work
on the webhooks/integration surface. Prompt 6 is cleanup — it
**must** run after every other prompt that touched
`src/app/embed/widget/ThreadPanel.tsx` (only prompt 1 does, for the
visitor-side agent identity header tweak).

---

## Hard rules every prompt repeats

1. **600-line cap.** No file added or modified may exceed 600 lines.
   Each prompt ends with `wc -l` on the files it touched.
2. **Next.js 16 / AGENTS.md.** Read `AGENTS.md` at the repo root
   before writing any code. The brief notes that this Next.js has
   breaking changes from training data.
3. **Test against greenflagged.xyz.** The FAB widget there is wired
   with `pk_live_45f4942f494ae8a94da8aca3`. After landing prompts
   1, 3, and 4, an end-to-end check on that page is the founder's
   acceptance test.
4. **Repo hygiene.** Push to `pochtmanr/chatkit` only. The
   `aaaxis` remote never receives a push.

---

## Deferred to round 5 (do NOT ship in round 4)

- **Realtime presence** — Supabase Realtime presence channel for
  agents. Round 4 assignment uses `support_agents.status` only
  (manual toggle in Workbench + 5-min staleness flip to `away`).
  The schema is forward-compatible: round 5 layers Realtime on
  top without altering the table.
- **Skill-based routing** — `support_agents.skills text[]` +
  `inboxes.required_skills text[]`. Round 4 is pure round-robin.
- **Multi-agent collaboration on one thread** — `conversation_participants`
  join table. Round 4 enforces single assignee.
- **OAuth (Google sign-in) for agents** — round 4 is password
  only.
- **Off-hours auto-reply / out-of-office mode** — round 4 lets
  the queue sit idle when no agents are online.

---

## What to verify before starting

Run these once after pulling main:

```bash
git log --oneline -10
ls supabase/migrations/                # last entry should be 0020
wc -l src/app/embed/widget/ThreadPanel.tsx   # expected 635
grep -n 'assigned_to' supabase/migrations/*.sql   # expect no matches
grep -n 'support_agents' supabase/migrations/*.sql src/lib/*.ts   # expect no matches
```

If any of those diverge from expectations, stop and re-read this
README — the round was designed against the state at commit
`dcee52f` ("Embed allowlist: drop stale isrshipping.com defaults").
