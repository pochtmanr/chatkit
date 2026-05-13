# Embedding chat-admin inbox in another admin panel

This doc shows how to iframe chat-admin's inbox inside another web app
(e.g. the GoDelivery admin at isrshipping.com) using a signed token
so users don't need a separate chat-admin login.

## Architecture

```
[Your admin panel UI]
       │
       │  signs a short-lived JWT with shared secret
       ▼
[iframe src="https://chat-admin/embed/inbox?token=<jwt>"]
       │
       │  chat-admin verifies the JWT and renders the inbox
       │  scoped to the tenant claimed in the token
       ▼
[Inbox UI inside your admin]
```

## 1. Configure the shared secret

On **chat-admin Vercel** project, add an env var:

```
EMBED_JWT_SECRET=<random 32+ character string>
```

On your **isrshipping admin** server, set the same value (any env var
name you want — referenced as `EMBED_JWT_SECRET` in the snippets below).

Generate a strong secret:

```sh
openssl rand -hex 32
```

## 2. Allow your domain to iframe chat-admin

`next.config.ts` already allows `https://www.isrshipping.com` and
`https://isrshipping.com` by default. For additional origins (staging,
local dev), set on Vercel:

```
EMBED_ALLOWED_ORIGINS=https://staging.isrshipping.com,http://localhost:3000
```

The CSP `frame-ancestors` directive enforces this — any origin not on
the allowlist gets blocked by the browser before the iframe loads.

## 3. Sign a JWT on the GoDelivery admin side

When rendering the page that hosts the iframe, sign a short-lived
token. Node.js example with `jsonwebtoken`:

```js
import jwt from "jsonwebtoken";

const token = jwt.sign(
  {
    iss: "isrshipping",                         // identifies the host
    tid: "9cb99e94-828e-41ec-ab47-46a0064c6a82", // chat-admin tenant id
    uid: req.session.adminId,                   // your admin's user id
    name: req.session.adminName ?? "Admin",     // optional, shown in UI
  },
  process.env.EMBED_JWT_SECRET,
  {
    algorithm: "HS256",
    expiresIn: "1h",                           // chat-admin rejects > 24h
  }
);
```

Or without a library, using Node's built-in crypto:

```js
import { createHmac } from "node:crypto";

function b64url(s) {
  return Buffer.from(s).toString("base64")
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
const payload = b64url(JSON.stringify({
  iss: "isrshipping",
  tid: TENANT_ID,
  uid: adminId,
  name: adminName,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
}));
const sig = createHmac("sha256", process.env.EMBED_JWT_SECRET)
  .update(`${header}.${payload}`)
  .digest("base64")
  .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
const token = `${header}.${payload}.${sig}`;
```

### Tenant id

The `tid` claim is the chat-admin tenant UUID. Get it from your
chat-admin dashboard or the `tenants.id` column. You probably hardcode
this in your isrshipping admin (one tenant per integration). Currently:

```
9cb99e94-828e-41ec-ab47-46a0064c6a82
```

### Token lifetime

Keep `exp` short — 1 hour is a good default. chat-admin rejects tokens
with `exp` more than 24h in the future as a guardrail against
accidentally signing long-lived tokens. The iframe reload silently if
the token expires mid-session is fine; the host can re-sign on each
page render.

## 4. Render the iframe

```html
<iframe
  src="https://chat-admin-theta.vercel.app/embed/inbox?token=<token>"
  style="width: 100%; height: 600px; border: 0"
  title="Inbox"
></iframe>
```

`token` must be URL-encoded (most templating engines do this for you).

## 5. URLs available

| Path | Use |
| --- | --- |
| `/embed/inbox?token=…` | Conversation list |
| `/embed/inbox/<conv-id>?token=…` | Thread + reply |
| `/api/embed/conversations/<conv-id>/reply` | POST endpoint (used internally by the embed UI) |

## What it does NOT include

Per design, the embed routes do **not** show:
- The chat-admin top sidebar (Usage, API keys, Webhooks, FAQ, etc.)
- The chat-admin login screen — if the JWT is invalid, you see an
  error message instead of a login prompt

Anything outside `/embed/*` still requires a chat-admin Supabase login
and won't be iframable (CSP `frame-ancestors 'none'`).

## Sender identity in messages

Messages sent via the embed endpoint land in Supabase with
`sender_id = "agent-<uid-from-jwt>"` where `<uid-from-jwt>` is the
`uid` claim. The mobile SDK treats any `agent-*` sender as an incoming
support reply.

## Push notifications

The embed reply endpoint fires the same push notification webhook as
the dashboard reply endpoint (see `lib/realtime.ts` and the POST
helper in the route), so customers get an FCM notification regardless
of which side replied.

## Troubleshooting

- **"Authentication failed: expired"** — token's `exp` is in the past.
  Re-sign with a fresh `exp`.
- **"Authentication failed: bad sig"** — `EMBED_JWT_SECRET` doesn't
  match between the signer and chat-admin, or the secret has a stray
  whitespace.
- **"Conversation not found"** — the conversation belongs to a
  different tenant than the JWT claims. Double-check the `tid` claim.
- **iframe doesn't load (no content)** — CSP is blocking it. Check the
  browser console for a `frame-ancestors` violation, and add your
  origin to `EMBED_ALLOWED_ORIGINS`.
- **Replies fail with 401** — the iframe's URL probably dropped the
  `token` query param. The thread page's reply form re-uses the same
  token for the Authorization header.
