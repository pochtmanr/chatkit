# chatkit

Multi-tenant support inbox + embeddable chat widget. One Next.js app
serves three audiences:

- **Tenant admins** — sign in at `/dashboard`, run businesses,
  inboxes, agents, billing, and a real MCP server.
- **Authenticated end-users on customer sites** — an iframe at
  `/embed/customer` mounts after the host backend mints a widget
  JWT and renders the iframe with the token.
- **Partner admin panels** — `/embed/inbox` is the round-6 surface
  (currently a 501 stub) for embedding the agent inbox inside a
  customer's own admin tool.

Stack: Next.js 16.2.6 (App Router) · React 19 · Supabase
(auth + Postgres + Storage + Realtime) · argon2 for key hashing ·
Tailwind 4 · Revolut for billing.

## Round 5: Authenticated widget

Round 5 split the legacy `pk_live_`-only widget into two surfaces and
introduced a real end-user identity. The host backend now holds an
`sk_live_…` server secret, mints a short-lived HS256 JWT per user
via `POST /api/v1/widget-tokens`, and renders the iframe at
`/embed/customer?key=<pk_live>&token=<JWT>`. The bridge between
host page and iframe uses a per-page nonce on every postMessage so
foreign-origin messages are silently dropped. Full brief and
prompt-by-prompt log: [`prompts/round-5/README.md`](prompts/round-5/README.md).

> **Migration:** Legacy callers that passed only `pk_live_…` to
> `/embed/widget` must now mint a JWT and call `/embed/customer`.
> The old route 308-redirects for one minor version, then disappears
> in round 7. Step-by-step instructions for hosts:
> **`/dashboard/docs/install`** in any running dashboard, or
> [`prompts/round-5/examples/greenflagged-integration.md`](prompts/round-5/examples/greenflagged-integration.md)
> for a working end-to-end example.

## Architecture

```
host site ──iframe──▶ /embed/widget?key=pk_live_…
                          │
                          │  postMessage chat-admin:widget
                          ▼
                     WidgetShell ─────▶ /api/embed/*
                                              │
                                              ▼
                                       Supabase (RLS off:
                                       trust = api key +
                                       Origin allowlist)
```

Auth boundary for `/embed/customer/*` (round 5) is **`?key=pk_live_…`
+ `?token=<widget JWT>` + the host origin in the per-business
`allowed_origins` allowlist**. The publishable key only identifies
the inbox; reads and writes are scoped to the JWT's `sub`. Legacy
`/embed/widget` callers must migrate — see "Round 5" above.

Auth boundary for `/dashboard/*` is **Supabase session cookies**.
Auth boundary for `/api/v1/*` is **per-inbox Bearer token**.
Auth boundary for `/api/mcp/*` is **MCP key (argon2 hashed)**.

## Local dev

```bash
npm install
cp .env.example .env.local   # fill in real values
npm run dev                  # serves on :3000
```

The `mcp-server` workspace is built separately when needed
(`npm run -w mcp-server build`); the main app does not depend on it
at runtime.

### Required env

| Var | What it does |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. Public. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key. Public. |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS. **Never** ship to browser. |
| `NEXT_PUBLIC_SITE_URL` | Origin override for auth redirects. |
| `NEXT_PUBLIC_TINYCHAT_SUPPORT_KEY` | Embed key the marketing `/support` page uses to self-host the widget. |
| `POSTGRES_URL` / `POSTGRES_PRISMA_URL` | Direct DB connections for migrations + scripts. |
| `REVOLUT_SECRET_KEY` / `REVOLUT_WEBHOOK_SECRET` / `REVOLUT_ENVIRONMENT` | Revolut Merchant API + webhook verification. |
| `CRON_SECRET` | Auth for `/api/cron/*` handlers. Vercel injects in prod. |
| `SUPABASE_ACCESS_TOKEN` | Local-only Supabase MCP server token (in `.mcp.json`). |

See `.env.example` for the full annotated list.

## Embedding the FAB widget on a host site

The widget is **just an iframe**. No script tag, no NPM package
needed. The host page renders:

```html
<iframe
  src="https://<chatkit-host>/embed/widget?key=pk_live_…"
  style="position:fixed; right:16px; bottom:16px; width:80px;
         height:80px; border:0; z-index:9999;
         background:transparent;"
  allow="clipboard-write"
  title="Support chat"
></iframe>
```

When the user clicks the FAB, the iframe posts
`{ type: "chat-admin:widget", open: true }` to its parent. The host
should listen and resize the iframe to ~`380×600` to show the panel,
then back to `80×80` when `open: false` is received. Sample listener:

```ts
window.addEventListener("message", (e) => {
  if (e.data?.type !== "chat-admin:widget") return;
  const f = document.querySelector("iframe[data-chatkit]") as HTMLIFrameElement;
  Object.assign(f.style, e.data.open
    ? { width: "380px", height: "600px" }
    : { width: "80px",  height: "80px"  });
});
```

To deep-link into a specific conversation (e.g. an order page), the
host posts `{ type: "chat-admin:open", externalRef, kind: "order" }`
into the iframe. The widget resolves the ref and opens that thread.

The widget enforces:
- the `?key=` value is a known tenant API key (Supabase lookup);
- the host origin is in the parent business's `allowed_origins`
  allowlist (managed under **Settings → Business**).

Both must pass or the iframe returns an auth error. Round 5 adds a
third check: a widget JWT in `?token=…` that identifies the end
user (see "Round 5" at the top of this README).

## Embedding the inbox iframe in a partner admin

Generate the snippet from `/dashboard/settings` → the **Embed**
panel. It renders the snippet, copies the key, and warns about the
allowlist requirement. Source: `src/app/dashboard/settings/EmbedSnippets.tsx`.

## Project rules

From `AGENTS.md`:

> This version has breaking changes — APIs, conventions, and file
> structure may all differ from your training data. Read the
> relevant guide in `node_modules/next/dist/docs/` before writing
> any code. Heed deprecation notices.

Other house rules:

- **600-line cap** per source file. Split components or extract
  helpers before crossing it.
- **`prompts/` folder is the project log.** Each round (`onboarding`,
  `dashboard-redesign`, `round-3-*`, `round-4-workbench-*`) records
  the founder's intent, the decisions, and the prompts a fresh
  Claude Code session can execute. Read the latest brief before
  starting work.
- **Don't bypass `embed-auth.ts`** — it is the only trust boundary
  for `/embed/*`.

## Folder map (`src/app/`)

| Path | Purpose |
| --- | --- |
| `(auth)/` | Sign in / sign out / callback. |
| `(marketing)/` | Public marketing pages — landing, SDK docs, API ref, support. |
| `dashboard/` | Tenant admin UI: businesses, inboxes, conversations, settings, billing, MCP. |
| `embed/widget/` | FAB visitor widget, iframe-embedded by host sites. |
| `embed/inbox/` | Inbox view, iframe-embedded by partner admin tools. |
| `api/v1/` | Public REST API for tenants — Bearer auth. |
| `api/embed/` | Server endpoints the widget hits — API-key + Origin auth. |
| `api/dashboard/` | Server endpoints the dashboard hits — session auth. |
| `api/billing/revolut/webhook/` | Revolut webhook receiver. |
| `api/cron/` | Vercel Cron jobs (e.g. scheduled deletion executor). |
| `api/mcp/[tool]/` | MCP HTTP transport. |

Workspaces:

- `mcp-server/` — standalone Node MCP server publishable to npm.

## Database

Migrations live in `supabase/migrations/`. The current schema is
captured in `src/lib/supabase/database.types.ts` (auto-generated).
Don't edit that file by hand — regenerate via the Supabase CLI.

## License

Private. © Holylabs.
