# Round 5 — Authenticated Widget, Topic Picker & Branding

Six self-contained prompts that close the loop on the customer
widget: an authenticated user opens the panel, picks a topic from
a tenant-defined list, and lands in a thread routed to a real
human in `/workbench` by skill tag. Along the way the round
introduces `sk_live_` server secrets, a signed-JWT user-token
model, a clean customer-vs-agent surface split, and the first
real widget branding controls (color, icon, roundness, button
style, bubble style, greeting copy).

Read `AGENTS.md` and `0-shared.md` before any prompt. Each prompt
is runnable by a fresh Claude Code session that has read only
`AGENTS.md`, `0-shared.md`, and the prompt itself — do not assume
context from other prompts or this README.

---

## Decision log (locked before prompts were written)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Round 5 scope | New ask + brief Phases 1–2 (Safety Split + Authenticated Widget Token). React/script SDK wrapper, agent embed hardening, webhook v2, rate limits, audit log, private attachments, observability → **Round 6** |
| 2 | Conversation routing | **Skill-tag routing.** `support_agents.skills text[]`, `conversation_start_options.required_skills text[]`. `assign_conversation()` filters candidates by required skills; falls back to unfiltered pool when an option declares no required skills |
| 3 | Auth mode | **Authenticated only.** No anonymous fallback flag this round. Greenflagged already gates the launcher behind its own auth, so this works in production today |
| 4 | Appearance scope | Launcher icon (upload + preset library), primary color (hex), corner roundness (`sharp`/`rounded`/`pill`), button style (`solid`/`outline`/`ghost`), bubble style (`rounded`/`square`/`tail`), greeting/welcome copy. No dark mode, no font choice, no position toggle |
| 5 | Demo on greenflagged | Greenflagged's backend mints widget tokens by calling `/api/v1/widget-tokens` with its `sk_live_` and the authenticated user's identity. No special "anonymous" code path on our side |
| 6 | Token issuance | **Holylabs mints.** Host backend → `POST /api/v1/widget-tokens` with `Authorization: Bearer sk_live_...` and identity claims → we return a signed HS256 JWT. Hosts never touch our signing key |
| 7 | Topic picker UX | Empty state shows the topic buttons directly. List view shows a persistent `+ New conversation` button at the top that opens the same picker as an overlay |
| 8 | JWT lifetime | 60 minutes default, 5 minutes minimum, 60 minutes maximum. Signed by `inboxes.widget_signing_secret` (binary, dual-key like the round-4 webhook secret) |
| 9 | Surface naming | Customer widget lives at `/embed/customer/*` and calls `/api/embed/customer/*`. The legacy `/embed/widget` path 308-redirects to `/embed/customer` for one minor version. Agent embed inbox is `/embed/inbox/*` + `/api/embed/agent/*` (round 5 only stubs this with a 501 to make the boundary visible — full implementation is round 6) |
| 10 | sk_live_ storage | Hashed at rest (sha256 + per-key salt), shown once at creation, never retrievable. Dual-key rotation (`server_secret_hash` + `server_secret_previous_hash`) mirrors the round-4 webhook-secret pattern in migration 0024 |

---

## Migration numbering

Round 4 ended at `0024_inbox_webhook_signing.sql`. Round 5 lands
one migration — additions are tightly coupled and a single file
keeps the rollback story simple.

| Migration | Prompt | Adds |
|-----------|--------|------|
| `0025_round5_keys_and_widget.sql` | **0-shared** spec; **1**, **3**, **5** apply it via Supabase MCP | `inboxes.server_secret_hash`, `inboxes.server_secret_previous_hash`, `inboxes.server_secret_rotated_at`, `inboxes.widget_signing_secret`, `inboxes.widget_signing_secret_previous`, `inboxes.auth_mode`, `support_agents.skills text[]`, new tables `conversation_start_options` and `widget_config`, `conversations.start_option_id` |

The migration body itself is specified in §3 of `0-shared.md`.
Apply via the Supabase MCP (`mcp__plugin_supabase_supabase__apply_migration`)
— **never paste SQL into Supabase Studio**.

---

## Prompt order & dependencies

```
0-shared.md   ← read first

1-keys-and-tokens.md          (independent of 3; needs 0-shared)
   ↓
2-surface-split.md            (needs 1 — JWT verify helper lives there)
   ↓
4-start-options.md            (needs 2 + 3 — uses customer namespace, needs skill column)
   ↓
6-host-integration.md         (needs 1 + 2 — docs how host mints tokens
                              and what surface to point the iframe at)

3-skill-routing.md            (independent of 1, 2; needs 0-shared)
   ↓
4-start-options.md (shared)

5-widget-appearance.md        (needs 2 — themes the renamed /embed/customer)
```

Prompts 1 and 3 can run **in parallel** after 0-shared is locked.
Prompt 4 has two upstream dependencies (2 and 3). Prompt 6 runs
last because it documents the surfaces 1 and 2 create.

---

## Hard rules every prompt repeats

1. **600-line cap.** No file added or modified may exceed 600
   lines. Each prompt ends with `wc -l` on the files it touched.
2. **AGENTS.md and Next.js 16.** Read `AGENTS.md` at the repo
   root before writing any code. The brief notes that this
   Next.js version has breaking changes from training data —
   consult `node_modules/next/dist/docs/` before writing routes,
   handlers, middleware, or server actions.
3. **Test against greenflagged.com.** The widget there is wired
   with `pk_live_45f4942f494ae8a94da8aca3`. After landing prompts
   2, 4, 5, and 6, an end-to-end check on greenflagged is the
   founder's acceptance test.
4. **Migrations via Supabase MCP.** Apply `0025_round5_keys_and_widget.sql`
   with `mcp__plugin_supabase_supabase__apply_migration`. Regenerate
   types with `mcp__plugin_supabase_supabase__generate_typescript_types`
   into `src/lib/supabase/database.types.ts`. Never paste SQL into
   Studio. (Per saved user preference.)
5. **Repo hygiene.** Push to `pochtmanr/chatkit` only. The
   `aaaxis` remote never receives a push.
6. **No new mock/anon flow.** The widget is authenticated-only
   this round. Do not add an "anonymous" code path even as a
   feature flag — it lands in round 6 with its own RLS audit.

---

## Deferred to round 6 (do NOT ship in round 5)

- **React/script SDK wrapper.** Round 5 keeps the existing
  iframe + postMessage handshake but hardens it (nonce + origin
  validation). The convenience wrappers — `<HolylabsChatProvider>`
  hook, `holylabs.init()` script — are round 6.
- **Agent embed inbox.** `/embed/inbox` and `/api/embed/agent/*`
  return 501 in round 5, just enough to draw the boundary so a
  customer widget bug can't accidentally call an agent endpoint.
  Full agent-session-backed implementation is round 6.
- **Webhook v2.** Round 4 already shipped HMAC + retries; round 6
  adds explicit `event_id`, `idempotency_key`, version header,
  replay button, and per-failure detail. Round 5 doesn't touch
  webhooks.
- **Rate limits.** Round 6.
- **Anonymous visitor mode** (lead-capture without a host
  account). Will be opt-in per inbox via `inboxes.auth_mode =
  'anonymous'`. The column is added in round 5 but only
  `'authenticated'` is allowed by the check constraint.
- **Audit log table** (`conversation_events`, `message_events`).
- **Private attachments / signed read URLs.**
- **Observability (structured logs + metrics).**
- **Skill-tag agent self-service.** Round 5 lets owners assign
  skills to agents from `/dashboard/settings/team`. Letting an
  agent edit their own skills is a round 6 polish item.

---

## What to verify before starting

Run these once after pulling main:

```bash
git log --oneline -10
ls supabase/migrations/                          # last entry should be 0024
grep -n 'sk_live_' src/lib supabase/migrations   # expect no matches
grep -n 'widget_signing_secret' src/lib supabase/migrations  # expect no matches
grep -n 'start_options\|widget_config' supabase/migrations   # expect no matches
wc -l src/app/embed/widget/WidgetShell.tsx       # expected ~167
```

If any of those diverge, stop and re-read this README — the
round was designed against the state at commit `cdf42be`
("Per-business embed allowlist (replaces EMBED_ALLOWED_ORIGINS)").

---

## Acceptance criteria (the whole round)

The round is shippable when **all** of these are true on
greenflagged.com with the real `pk_live_45f4942f494ae8a94da8aca3`:

1. A logged-in greenflagged user opens the widget; if no
   conversations exist, the empty state shows the tenant's
   configured topic buttons (Billing / Order issue / …) plus the
   greeting copy.
2. Picking a topic creates a conversation with the right
   `kind`, `start_option_id`, and `external_ref = token.sub`.
3. A workbench agent with the matching `skills[]` receives the
   conversation; an agent without the skill does not.
4. The list view shows a persistent `+ New conversation` button
   at the top that re-opens the same topic picker.
5. Owners can edit launcher color / icon / roundness / button
   style / bubble style / greeting at
   `/dashboard/settings/widget-appearance` and the change appears
   on greenflagged after one full reload.
6. A request to `/api/embed/customer/conversations` without a
   valid widget JWT returns 401 — even with a valid
   `pk_live_`. The publishable key alone can no longer list
   conversations.
7. A widget user with a valid JWT cannot see another user's
   conversations (`sub` mismatch → 403 from list/read endpoints).
8. `POST /api/v1/widget-tokens` with `Bearer sk_live_…` returns a
   signed JWT. With a `pk_live_…` it returns 401.
9. `sk_live_…` is shown once at creation in the dashboard and
   never again. Rotation issues a new key; the previous key still
   verifies tokens until `server_secret_rotated_at + 24h`.
10. `/embed/inbox` and `/api/embed/agent/*` return 501 (the
    explicit Round 6 stub), not 200, ensuring nothing accidentally
    routes a customer surface through an agent path.
