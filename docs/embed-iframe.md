# Embed iframe — superseded

> **This document is obsolete as of round 5.** The flow it described
> (a shared `EMBED_JWT_SECRET` signing tokens for `/embed/inbox`,
> with `EMBED_ALLOWED_ORIGINS` as a process-wide allowlist) no longer
> matches the architecture.

Round 5 replaced this with:

- **Per-business embed allowlist** — origins live on the business
  record at `businesses.allowed_origins`. Manage them at
  **Settings → Business → Embed allowlist** in the dashboard. The
  `EMBED_ALLOWED_ORIGINS` env var has been removed.
- **Per-inbox `sk_live_…` server secrets** — each inbox mints its
  own widget JWTs via `POST /api/v1/widget-tokens`. No more
  process-wide shared secret.
- **Authenticated customer surface** — the iframe at
  `/embed/customer?key=<pk_live>&token=<JWT>` carries a short-lived
  HS256 JWT identifying one end user inside one inbox. Bridge
  messages are gated by a per-page nonce.
- **`/embed/inbox` is a 501 stub.** Round 6 will ship a redesigned
  agent-embed flow; the round-5 surface deliberately reserves the
  namespace but rejects all traffic.

## Where to read instead

- Step-by-step install (auth-only widget):
  **`/dashboard/docs/install`** in any running dashboard.
- JWT shape, TTL clamping, allowed_kinds, external_refs deep dive:
  **`/dashboard/docs/tokens`**.
- Sign-out destroy semantics:
  **`/dashboard/docs/sign-out`**.
- Three-credential security model:
  **`/dashboard/docs/security`**.
- End-to-end working example for the greenflagged.com host:
  [`prompts/round-5/examples/greenflagged-integration.md`](../prompts/round-5/examples/greenflagged-integration.md).
- Round-5 architecture and shared contracts:
  [`prompts/round-5/0-shared.md`](../prompts/round-5/0-shared.md).

This file is kept as a tombstone so existing links resolve; it
should not be linked from new docs.
