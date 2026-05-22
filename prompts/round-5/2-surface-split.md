# 2 — Customer vs agent surface split

Read `AGENTS.md` and `0-shared.md` before starting. Depends on
prompt 1 — `verifyWidgetToken()` and `signWidgetToken()` must
exist.

## Goal

Brief §"Phase 1: Safety Split". Cleanly separate the customer
widget from the (future) agent embed inbox, and rewrite every
customer-facing API to require a widget JWT. After this prompt,
a `pk_live_…` alone can no longer read a single byte of tenant
data.

Three sub-goals:

1. **Rename the customer surface.** `/embed/widget` →
   `/embed/customer`; `/api/embed/conversations/*` →
   `/api/embed/customer/conversations/*`. Legacy paths redirect
   or return 410.
2. **Reserve the agent namespace.** `/embed/inbox` and
   `/api/embed/agent/*` are stubbed with 501 Not Implemented.
   No real implementation in round 5 — the purpose is to make
   the boundary visible in code review and prevent customer code
   from accidentally landing under an agent path.
3. **Harden the postMessage bridge.** Add a nonce-based
   handshake, validate origins on every message, and add a
   `sign-out` command that destroys session state.

---

## Step 0 — Pre-flight

```bash
cat AGENTS.md
grep -rn 'embed/widget\|embed/conversations\|verifyEmbedKey' src/ \
  | wc -l                                   # rough scope
ls src/app/embed/                           # confirm 'widget' is the only folder
ls src/app/api/embed/                       # confirm 'conversations' is here
grep -n 'verifyWidgetToken' src/lib/widget-token.ts   # confirms prompt 1 landed
```

If `widget-token.ts` doesn't exist, prompt 1 has not run yet —
stop and run prompt 1 first.

Read `node_modules/next/dist/docs/` on route handlers, middleware,
and dynamic segments before touching routes.

---

## Step 1 — Rename `/embed/widget` → `/embed/customer`

Move the folder:

```
src/app/embed/widget/  →  src/app/embed/customer/
```

Files affected (all imports stay relative):

- `page.tsx`
- `layout.tsx`
- `WidgetShell.tsx`
- `ConversationList.tsx`
- `ThreadPanel.tsx`
- `ThreadPanelHeader.tsx`
- `ThreadMessages.tsx`
- `ThreadComposer.tsx`
- `useThreadConversation.ts` (and any other hooks)

Leave a redirect at the old path. Create
`src/app/embed/widget/page.tsx` containing only:

```tsx
import { permanentRedirect } from "next/navigation";
export default function LegacyWidgetRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Forward the query string so existing loaders keep working.
  // 308 = method-preserving permanent redirect.
  // Delete this file at the start of round 7.
  return permanentRedirect("/embed/customer" + buildQuery(searchParams));
}
async function buildQuery(p: Promise<Record<string, string | string[] | undefined>>) {
  const params = await p;
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string") usp.set(k, v);
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}
```

Verify the **AGENTS.md docs** on `permanentRedirect` vs
`redirect` — Next.js 16 may have changed behavior. Use whichever
the docs in `node_modules/next/dist/docs/` show.

If the existing `WidgetShell.tsx` imports
`/api/embed/conversations/...`, update those calls to
`/api/embed/customer/conversations/...` (full rewrite of fetches
happens in Step 4). For now, only update the **URL constants**
in client code — the API namespace move happens in Step 4.

---

## Step 2 — `/embed/inbox/` 501 stub

```
src/app/embed/inbox/
└── page.tsx
```

```tsx
// Round 5 reserves this surface so customer/agent boundaries
// are visible in code review. Full agent embed implementation
// lands in Round 6 with session-backed auth.
export const dynamic = "force-static";

export default function AgentInboxNotImplemented() {
  return (
    <html>
      <body style={{ fontFamily: "system-ui", padding: 24 }}>
        <h1 style={{ fontSize: 16, fontWeight: 600 }}>
          /embed/inbox is reserved for Round 6
        </h1>
        <p style={{ fontSize: 13, color: "#71717a", maxWidth: 480 }}>
          The agent embed inbox surface is intentionally not implemented in
          this build. See <code>prompts/round-5-authenticated-widget-brief.md</code>{" "}
          §"Phase 4: Agent Embed Security" for the planned scope.
        </p>
      </body>
    </html>
  );
}
```

Add a Next.js route segment config to force `Content-Security-Policy`
on this page:

```ts
export const headers = async () => ({
  "content-security-policy": "frame-ancestors 'none'",
});
```

(Confirm header export shape against `node_modules/next/dist/docs/` —
the canonical place for headers is middleware or `next.config`,
but a per-route override may be supported. If not, add a one-line
exception in `src/middleware.ts` to set the header on
`/embed/inbox/*`.)

---

## Step 3 — `/api/embed/agent/` 501 stubs

Create one route handler that any path under `/api/embed/agent/*`
falls through to. The cleanest Next.js 16 way is a catch-all
segment:

```
src/app/api/embed/agent/[...path]/route.ts
```

```ts
import { NextResponse } from "next/server";
const NOT_IMPLEMENTED = NextResponse.json(
  { error: "agent embed API is reserved for round 6" },
  { status: 501 },
);
export const GET = async () => NOT_IMPLEMENTED;
export const POST = async () => NOT_IMPLEMENTED;
export const PUT = async () => NOT_IMPLEMENTED;
export const PATCH = async () => NOT_IMPLEMENTED;
export const DELETE = async () => NOT_IMPLEMENTED;
```

This guarantees that even a typo'd path under `/api/embed/agent/`
returns 501 with a clear message instead of a generic 404. Code
review can grep for `/api/embed/agent` and find these routes
immediately.

---

## Step 4 — Move customer APIs to `/api/embed/customer/*`

Move the entire `src/app/api/embed/conversations/` tree:

```
src/app/api/embed/conversations/    →    src/app/api/embed/customer/conversations/
```

Within each handler, **rewrite the auth check**. Today every
handler calls a local `authSession(request)` that wraps
`verifyEmbedKey`. Replace with a shared helper that demands both
the pk AND the JWT:

Create `src/lib/customer-auth.ts`:

```ts
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { verifyWidgetToken, type WidgetClaims } from "@/lib/widget-token";

export type CustomerSession = {
  inboxId: string;
  businessId: string;
  claims: WidgetClaims;
};

export type CustomerAuthResult =
  | { ok: true; session: CustomerSession }
  | { ok: false; response: NextResponse };

export async function authCustomer(
  request: NextRequest,
): Promise<CustomerAuthResult> {
  const auth = request.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  const jwt = m?.[1];
  const pk = request.headers.get("x-holylabs-pk");
  if (!jwt || !pk) {
    return {
      ok: false,
      response: NextResponse.json({ error: "unauthenticated" }, { status: 401 }),
    };
  }
  try {
    const { claims, inboxId, businessId } = await verifyWidgetToken(jwt, pk);
    return { ok: true, session: { inboxId, businessId, claims } };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "unauthenticated" }, { status: 401 }),
    };
  }
}
```

Then rewrite each customer handler:

**`src/app/api/embed/customer/conversations/route.ts`** (the
list endpoint):

```ts
export async function GET(request: NextRequest) {
  const auth = await authCustomer(request);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const service = getServiceClient();

  // CRITICAL: this query MUST be scoped to the JWT subject.
  // The brief is explicit: "A customer may only list their own
  // conversations." Never return rows where the user isn't a
  // participant.
  const { data: conversations, error } = await service
    .from("conversations")
    .select("id, kind, external_ref, participants, last_message, last_at, start_option_id")
    .eq("inbox_id", session.inboxId)
    .or(
      `external_ref.eq.${session.claims.sub},participants.cs.{${session.claims.sub}}`,
    )
    .order("last_at", { ascending: false, nullsFirst: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: "list failed" }, { status: 500 });
  }

  return NextResponse.json({ conversations: conversations ?? [] });
}
```

**`src/app/api/embed/customer/conversations/[id]/messages/route.ts`**
and `reply/route.ts` and `upload/route.ts` and `typing/route.ts`:

- Replace `verifyEmbedKey` call with `authCustomer`.
- Before any DB read, **assert membership**: load the conversation
  once, check `external_ref === claims.sub || participants includes claims.sub`,
  return 403 otherwise.
- Pull out the assertion into a helper so every per-conversation
  endpoint uses it identically:

```ts
// src/lib/customer-auth.ts
export async function assertCustomerOwnsConversation(
  session: CustomerSession,
  conversationId: string,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const svc = getServiceClient();
  const { data } = await svc
    .from("conversations")
    .select("id, external_ref, participants, inbox_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!data || data.inbox_id !== session.inboxId) {
    return { ok: false, response: NextResponse.json({ error: "not found" }, { status: 404 }) };
  }
  const sub = session.claims.sub;
  const isOwner = data.external_ref === sub
    || (Array.isArray(data.participants) && data.participants.includes(sub));
  if (!isOwner) {
    return { ok: false, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { ok: true };
}
```

Use `assertCustomerOwnsConversation` in every per-id handler.

**`src/app/api/embed/customer/conversations/find/route.ts`**:

The find-or-create endpoint becomes the canonical "start
conversation" endpoint that prompt 4 will call. Rewrite to:

- Require `authCustomer`.
- Body now includes `start_option_id?: string` (UUID). When
  present, load the start option, assert it belongs to the
  caller's inbox + is active, and copy `kind` and
  `required_skills` from it (the trigger from prompt 3 reads
  these on insert).
- When `start_option_id` is absent, fall back to the existing
  `{ external_ref, kind, participants }` shape.
- The created conversation's `external_ref` is `claims.sub` for
  `kind = 'support'`, the request body's `external_ref` for
  other kinds (validated against `claims.external_refs`).
- The created conversation's `participants` always includes
  `claims.sub` for `kind = 'support'`.
- Reject if `kind ∉ claims.allowed_kinds`.

**Sender ID on customer messages:** The reply endpoint must set
`sender_id = claims.sub`. Today it accepts a body-provided
`sender_id` — remove that field; the JWT subject is the source
of truth. (Round 4's reply route already does this for agent
replies via `sender_id = 'agent-<uid>'`; mirror that discipline.)

---

## Step 5 — 410 Gone on legacy `/api/embed/conversations/*`

After moving the handlers under `/customer/`, leave a tombstone:

```
src/app/api/embed/conversations/[...path]/route.ts
```

```ts
import { NextResponse } from "next/server";
const GONE = NextResponse.json(
  {
    error:
      "endpoint moved to /api/embed/customer/conversations and now requires a widget JWT. see prompts/round-5/6-host-integration.md",
  },
  { status: 410 },
);
export const GET = async () => GONE;
export const POST = async () => GONE;
export const PUT = async () => GONE;
export const PATCH = async () => GONE;
export const DELETE = async () => GONE;
```

Delete the original route files. The catch-all replaces them.

---

## Step 6 — postMessage handshake (`WidgetShell.tsx`)

Today's bridge in `src/app/embed/customer/WidgetShell.tsx` is
loose: it accepts any `{ type: 'chat-admin:open', … }` message
from any origin, and it posts to `'*'`. Tighten per
`0-shared.md §6`.

Replace the existing bridge with the typed protocol below.
**Keep the file under 600 lines** — if WidgetShell is approaching
the cap, extract the bridge into `useHostBridge.ts`.

```ts
// useHostBridge.ts (new file)
"use client";
import { useEffect, useState, useRef } from "react";

type Inbound =
  | { v: 1; type: "init"; nonce: string; hostOrigin: string }
  | { v: 1; type: "open"; nonce: string; kind?: string;
      externalRef?: string; startOptionId?: string }
  | { v: 1; type: "close"; nonce: string }
  | { v: 1; type: "sign-out"; nonce: string };

type Outbound =
  | { v: 1; type: "ready"; nonce: string }
  | { v: 1; type: "open"; nonce: string; open: boolean }
  | { v: 1; type: "unread"; nonce: string; count: number };

export function useHostBridge(opts: {
  onOpen: (cmd: { kind?: string; externalRef?: string; startOptionId?: string }) => void;
  onClose: () => void;
  onSignOut: () => void;
}) {
  const [bridge, setBridge] = useState<{
    hostOrigin: string;
    nonce: string;
  } | null>(null);
  const bridgeRef = useRef(bridge);
  bridgeRef.current = bridge;

  // post helper — once handshake complete, target only the
  // verified host origin, never '*'.
  const post = (m: Outbound) => {
    const b = bridgeRef.current;
    if (!b) return;
    if (typeof window !== "undefined") {
      window.parent.postMessage(m, b.hostOrigin);
    }
  };

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const msg = e.data as Inbound | null;
      if (!msg || typeof msg !== "object" || msg.v !== 1) return;

      // Init: derive expected hostOrigin from document.referrer
      // if not yet set. Reject if referrer is empty.
      if (msg.type === "init") {
        if (typeof document === "undefined") return;
        const refOrigin = document.referrer
          ? new URL(document.referrer).origin
          : null;
        if (!refOrigin || refOrigin !== e.origin || refOrigin !== msg.hostOrigin) {
          return; // refuse handshake
        }
        setBridge({ hostOrigin: refOrigin, nonce: msg.nonce });
        window.parent.postMessage(
          { v: 1, type: "ready", nonce: msg.nonce } satisfies Outbound,
          refOrigin,
        );
        return;
      }

      const b = bridgeRef.current;
      if (!b) return;                                  // not handshook
      if (e.origin !== b.hostOrigin) return;           // wrong origin
      if (msg.nonce !== b.nonce) return;               // wrong nonce

      switch (msg.type) {
        case "open":
          opts.onOpen({
            kind: msg.kind,
            externalRef: msg.externalRef,
            startOptionId: msg.startOptionId,
          });
          break;
        case "close":
          opts.onClose();
          break;
        case "sign-out":
          opts.onSignOut();
          setBridge(null);  // tear down
          break;
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [opts]);

  return { bridge, post };
}
```

Wire this into `WidgetShell.tsx`. `onSignOut` must:

- Set view back to `closed`.
- Drop any in-memory JWT or session state.
- Unsubscribe from realtime channels (today this happens in
  `useThreadConversation` on unmount — the easiest hook is to
  set `openConvId = null` and `view = 'closed'` which already
  unmounts the thread).
- After sign-out, the widget refuses to re-render any thread
  until a fresh `init` handshake from a new host page load.

Document the handshake in a top comment on `useHostBridge.ts`
linking to `prompts/round-5/0-shared.md §6`.

---

## Step 7 — Widget-side fetches: send pk header + JWT

The widget needs both headers on every customer API call. Add a
small client helper at `src/app/embed/customer/_lib/client.ts`:

```ts
"use client";

/**
 * Build a fetch wrapper for /api/embed/customer/* calls.
 * Sends the publishable key in x-holylabs-pk and the widget JWT
 * in Authorization. Caller is responsible for refreshing the
 * JWT before it expires (server returns 401 → caller reloads
 * page to trigger a fresh init handshake from the host).
 */
export function customerFetch(opts: { pk: string; token: string }) {
  return (input: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${opts.token}`);
    headers.set("x-holylabs-pk", opts.pk);
    return fetch(input, { ...init, headers });
  };
}
```

Refactor `WidgetShell`, `ConversationList`, `useThreadConversation`,
the upload helper, and the typing helper to take the wrapped
`customerFetch` instead of constructing headers locally. Keep
the change mechanical — no behavior changes inside components
beyond which fetch they call.

**How does the widget get the JWT?** The host page provides it.
Two paths:

- **Query-string handoff (round 5 default).** The host loader
  appends `&token=<jwt>` to the iframe URL. The widget reads it
  from `window.location.search` on mount. Document in
  `0-shared.md §6` — but tokens in URL bars are visible in
  browser history; this is the trade-off until prompt 6's
  React SDK provides a postMessage handoff path.
- **postMessage handoff (round 6).** The host sends `init`
  followed by an `auth` message with the token. Round 5 leaves
  the `auth` message type **unimplemented** — only `init` /
  `open` / `close` / `sign-out`.

Pick query-string for round 5. Update `page.tsx`:

```tsx
// src/app/embed/customer/page.tsx
import { headers } from "next/headers";
import { verifyEmbedKey } from "@/lib/embed-auth";
import { verifyWidgetToken } from "@/lib/widget-token";
import { WidgetShell } from "./WidgetShell";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; token?: string }>;
}) {
  const sp = await searchParams;
  if (!sp.key || !sp.token) {
    return <NotAuthorized />;
  }
  try {
    await verifyEmbedKey(sp.key);                          // pk is valid for this origin
    const { claims } = await verifyWidgetToken(sp.token, sp.key); // JWT is valid for that pk
    return <WidgetShell pk={sp.key} token={sp.token} claims={claims} />;
  } catch {
    return <NotAuthorized />;
  }
}

function NotAuthorized() {
  return (
    <div style={{ padding: 24, font: "13px system-ui", color: "#71717a" }}>
      Authentication required. The host app must mint a widget token via{" "}
      <code>POST /api/v1/widget-tokens</code> and include it as{" "}
      <code>&amp;token=…</code> in the iframe URL.
    </div>
  );
}
```

`WidgetShell` now takes `{ pk, token, claims }` instead of
`{ apiKey }`. The composer / list / thread receive a
`customerFetch` instance built from those.

---

## Step 8 — Middleware / CSP touchups

Open `src/middleware.ts`. Verify:

- `/embed/customer/*` continues to receive the
  `frame-ancestors` header derived from
  `frameAncestorsForKey(pk)`.
- `/embed/inbox/*` gets `frame-ancestors 'none'`.
- `/embed/widget/*` returns 308 to `/embed/customer/*`. (The
  redirect happens in the page itself per Step 1, but
  middleware should also forward unknown methods.)

Do not change unrelated middleware behavior.

---

## Step 9 — Verification block

```bash
# 1. /api/embed/customer/conversations without auth headers
curl -i https://chat-admin.local/api/embed/customer/conversations
# expect: 401 unauthenticated

# 2. With pk only (no JWT)
curl -i -H "x-holylabs-pk: pk_live_…" \
  https://chat-admin.local/api/embed/customer/conversations
# expect: 401

# 3. With JWT only (no pk)
curl -i -H "Authorization: Bearer <jwt>" \
  https://chat-admin.local/api/embed/customer/conversations
# expect: 401

# 4. With both, but a JWT for a different inbox
curl -i -H "Authorization: Bearer <jwt-for-other-inbox>" \
       -H "x-holylabs-pk: pk_live_…" \
  https://chat-admin.local/api/embed/customer/conversations
# expect: 401 (aud mismatch)

# 5. Happy path
curl -i -H "Authorization: Bearer <valid-jwt>" \
       -H "x-holylabs-pk: pk_live_…" \
  https://chat-admin.local/api/embed/customer/conversations
# expect: 200, conversations array filtered to JWT.sub

# 6. Per-id read with a JWT for a user who is NOT a participant
curl -i -H "Authorization: Bearer <valid-jwt-for-other-user>" \
       -H "x-holylabs-pk: pk_live_…" \
  https://chat-admin.local/api/embed/customer/conversations/<conv-of-user-A>/messages
# expect: 403 forbidden

# 7. Legacy redirect
curl -i https://chat-admin.local/embed/widget?key=pk_live_…
# expect: 308 → /embed/customer?key=…

# 8. Legacy gone
curl -i https://chat-admin.local/api/embed/conversations
# expect: 410

# 9. Agent stubs
curl -i https://chat-admin.local/embed/inbox
# expect: 200 with the round-6-reserved page (CSP frame-ancestors 'none')
curl -i https://chat-admin.local/api/embed/agent/anything
# expect: 501

# 10. End-to-end on greenflagged.com
# Open greenflagged signed in as a real user, confirm the iframe
# URL contains both `key` and `token`, confirm the conversation
# list loads, confirm a stranger's user_id (visible in dev tools)
# cannot be used to fetch their conversations.
```

Document any deviation from the expected status codes in the PR.

---

## Step 10 — Out of scope

- **Topic picker UI.** Prompt 4. This prompt only ensures
  `/find` accepts `start_option_id` as a valid (optional) field.
- **Theming / CSS variables / `widget_config`.** Prompt 5.
- **Skill-based routing.** Prompt 3.
- **React SDK wrapper.** Round 6.

---

## Definition of done

- [ ] `src/app/embed/widget/` folder gone (or contains only the
      legacy redirect page). New folder at
      `src/app/embed/customer/`.
- [ ] All references to `/embed/widget` and
      `/api/embed/conversations` in code are either redirects
      or 410 tombstones. `grep -rn '/embed/widget\|/api/embed/conversations' src/`
      shows only those redirect/tombstone files.
- [ ] `/api/embed/customer/conversations/*` handlers all use
      `authCustomer()` + `assertCustomerOwnsConversation()` and
      pass the verification block.
- [ ] `/embed/inbox` and `/api/embed/agent/*` return their
      expected stubs.
- [ ] `WidgetShell` uses `useHostBridge` with nonce + origin
      validation; `sign-out` tears down session state.
- [ ] The widget reads the JWT from `?token=` query param and
      `verifyWidgetToken()` succeeds in `page.tsx`.
- [ ] `wc -l` on every touched/created file ≤ 600 (split into
      sub-modules if needed; `WidgetShell.tsx` may need to drop
      its bridge code into `useHostBridge.ts`).
- [ ] Greenflagged end-to-end: logged-in user opens the widget;
      conversation list loads (may be empty); typing/uploading
      works; signing out via a host `sign-out` message visibly
      tears down the panel.

End the PR description with: the file move list, the helper
exports, the 10 verification results, and a note that prompt 4
should call `POST /api/embed/customer/conversations/find` with
`{ start_option_id }` to create a conversation.
