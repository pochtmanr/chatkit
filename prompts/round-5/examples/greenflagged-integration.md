# Greenflagged.com × Holylabs Chat — Round 5 integration

This is a self-contained handoff document for the greenflagged team.
Following it produces a production-ready, authenticated-only chat
widget for any user signed into greenflagged.

It assumes greenflagged runs on Next.js 16 (App Router) with
Supabase Auth — the same stack the rest of greenflagged uses. If
your stack differs, the shape of each step still applies; swap the
session helpers for your own.

Time to integrate: ~30 minutes.

---

## What you'll do

1. Add `HOLYLABS_SK_LIVE` to greenflagged's env vars.
2. Create a Next.js route handler that mints a token for the signed-in
   greenflagged user.
3. Render the iframe + handshake on every authenticated layout.
4. Wire `window.holylabsSignOut()` into your existing sign-out
   button.
5. Verify end-to-end.

---

## 1. Environment

Two values land in greenflagged's env:

```
# .env.local (greenflagged repo)

# Publishable — safe to expose to the browser. Identifies the inbox.
NEXT_PUBLIC_HOLYLABS_PK_LIVE=pk_live_45f4942f494ae8a94da8aca3

# Server secret — NEVER exposed to the browser. Mints widget JWTs.
HOLYLABS_SK_LIVE=sk_live_<paste-from-dashboard>
```

Mint the `sk_live_` once at:

```
https://chat-admin.holylabs.io/dashboard/settings/api-keys
```

The dashboard shows the raw key exactly once. Copy it straight into
your env (and Vercel project env vars). If you miss the window,
rotate from the same page; the previous secret stays valid for 24h.

While there, confirm under **Settings → Business → Embed allowlist**
that `https://greenflagged.com` is on the allowlist. Without it the
iframe will refuse to render with a `frame-ancestors` denial.

---

## 2. Token mint endpoint

Create `apps/web/src/app/api/holylabs-token/route.ts` (or wherever
greenflagged keeps its route handlers).

```ts
// apps/web/src/app/api/holylabs-token/route.ts
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function POST() {
  // 1. Authenticate the greenflagged user using your existing Supabase
  //    SSR helpers. If you have a shared `getServerClient()` already,
  //    swap it in here.
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {
          /* read-only in a route handler */
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "auth required" }, { status: 401 });
  }

  // 2. Mint a widget token via Holylabs.
  const res = await fetch(
    "https://chat-admin.holylabs.io/api/v1/widget-tokens",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.HOLYLABS_SK_LIVE}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        user_id: user.id,
        name: user.user_metadata?.full_name ?? user.email ?? "Anonymous",
        email: user.email,
        avatar_url: user.user_metadata?.avatar_url,
        allowed_kinds: ["support"],
        ttl_seconds: 3600,
      }),
      // Mints are short; we don't want Next.js caching the response.
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[holylabs-token] mint failed", res.status, detail);
    return NextResponse.json({ error: "token mint failed" }, { status: 502 });
  }

  const { token, expires_at } = await res.json();
  return NextResponse.json({ token, expires_at });
}
```

Smoke test from a logged-in browser session:

```
fetch("/api/holylabs-token", { method: "POST" })
  .then(r => r.json())
  .then(console.log)
// → { token: "eyJ…", expires_at: "2026-…" }
```

---

## 3. The iframe wrapper

Create `apps/web/src/components/HolylabsChat.tsx`. This component
fetches the token, mounts the iframe, posts the `init` handshake,
listens for resize events, and exposes a `signOut()` helper via
the `window` global so the existing sign-out button can call it
without prop-drilling.

```tsx
"use client";

import { useEffect, useRef } from "react";

const WIDGET_ORIGIN = "https://chat-admin.holylabs.io";

declare global {
  interface Window {
    holylabsSignOut?: () => void;
  }
}

export function HolylabsChat() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const nonceRef = useRef<string>("");

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    nonceRef.current = crypto.randomUUID();
    const NONCE = nonceRef.current;
    const HOST_ORIGIN = window.location.origin;

    // 1. Fetch the token from our own backend, then set the iframe src.
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/holylabs-token", { method: "POST" });
        if (!res.ok) {
          console.error("[holylabs-chat] token fetch failed", res.status);
          return;
        }
        const { token } = await res.json();
        if (cancelled || !iframeRef.current) return;
        const pk = process.env.NEXT_PUBLIC_HOLYLABS_PK_LIVE!;
        iframeRef.current.src =
          `${WIDGET_ORIGIN}/embed/customer` +
          `?key=${encodeURIComponent(pk)}` +
          `&token=${encodeURIComponent(token)}`;
      } catch (err) {
        console.error("[holylabs-chat] token fetch error", err);
      }
    })();

    // 2. After the iframe loads, send the handshake.
    const onLoad = () => {
      iframe.contentWindow?.postMessage(
        { v: 1, type: "init", nonce: NONCE, hostOrigin: HOST_ORIGIN },
        WIDGET_ORIGIN,
      );
    };
    iframe.addEventListener("load", onLoad);

    // 3. Listen for resize hints from the widget.
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== WIDGET_ORIGIN) return;
      if (e.data?.v !== 1) return;
      if (e.data.nonce !== NONCE) return;
      if (e.data.type === "open" && iframeRef.current) {
        iframeRef.current.style.width = e.data.open ? "380px" : "80px";
        iframeRef.current.style.height = e.data.open ? "560px" : "80px";
      }
    };
    window.addEventListener("message", onMessage);

    // 4. Expose a sign-out helper so the auth button can reach us.
    window.holylabsSignOut = () => {
      iframeRef.current?.contentWindow?.postMessage(
        { v: 1, type: "sign-out", nonce: NONCE },
        WIDGET_ORIGIN,
      );
    };

    return () => {
      cancelled = true;
      iframe.removeEventListener("load", onLoad);
      window.removeEventListener("message", onMessage);
      delete window.holylabsSignOut;
    };
  }, []);

  return (
    <iframe
      ref={iframeRef}
      title="Holylabs chat"
      allow="clipboard-write"
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        width: 80,
        height: 80,
        border: 0,
        zIndex: 9999,
        background: "transparent",
      }}
    />
  );
}
```

Mount it in the authenticated layout — anywhere a signed-in user
visits. For greenflagged, that's `apps/web/src/app/(app)/layout.tsx`:

```tsx
import { HolylabsChat } from "@/components/HolylabsChat";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <HolylabsChat />
    </>
  );
}
```

Do *not* mount it on the marketing layout or the sign-in page. If
the user isn't logged in, the token fetch will 401 and the widget
will fail silently — better not to render it at all.

---

## 4. Sign-out hook

Greenflagged's existing sign-out button lives in
`apps/web/src/components/UserMenu.tsx`. Patch the handler:

```ts
// Before:
async function handleSignOut() {
  await supabase.auth.signOut();
  router.push("/");
}

// After:
async function handleSignOut() {
  await supabase.auth.signOut();
  window.holylabsSignOut?.();   // ← add this line
  router.push("/");
}
```

Optional chaining covers the case where the widget hasn't mounted
(e.g., the user signed out on the marketing page).

---

## 5. Verification

Run through each of the following on the staging deploy before
shipping to production.

**a. Token mint round-trip**

- Sign into greenflagged.
- Open DevTools → Network → filter `holylabs-token`.
- Confirm one `POST /api/holylabs-token` returns 200 with
  `{ token, expires_at }`.
- Decode the token at `jwt.io`. Confirm `sub` = your Supabase user
  id, `aud` = the Holylabs inbox id, `exp` ≤ 60 min from `iat`,
  `allowed_kinds` includes `support`.

**b. Iframe loads**

- Confirm the iframe at `chat-admin.holylabs.io/embed/customer?…`
  loads (200).
- Confirm both `key` and `token` are in the URL.
- Confirm no `frame-ancestors` violation in the console (this would
  mean `https://greenflagged.com` is missing from the embed
  allowlist on the Holylabs dashboard).

**c. Handshake**

- Open the panel. Confirm the launcher expands from 80×80 to
  380×560.
- Close it. Confirm it shrinks back.
- Confirm only messages with the captured nonce update the iframe
  size — paste a foreign-origin message in DevTools and confirm
  it's ignored.

**d. Conversation creation**

- Pick a start option (e.g. `Billing`). Send a message.
- In the Holylabs dashboard, open the inbox. Confirm the new
  conversation appears with:
  - `external_ref` = your Supabase user id.
  - Sender display name + avatar from your Supabase profile.

**e. Sign-out destroy**

- Click sign out. Confirm:
  - The widget panel closes.
  - No further `/api/embed/customer/*` requests fire in the Network
    tab.
  - Reloading the page (still signed out) does *not* mount the
    widget (because the auth layout no longer renders).

**f. Re-sign-in**

- Sign back in. Confirm a fresh `/api/holylabs-token` mint, a fresh
  iframe load with a new token, a fresh nonce.

If any step fails, re-read the relevant section. Most failures are:

- `HOLYLABS_SK_LIVE` missing or pasted with a leading/trailing space.
- `greenflagged.com` not on the embed allowlist.
- Sign-out button not patched.
- `NEXT_PUBLIC_HOLYLABS_PK_LIVE` not exposed to the browser bundle
  (must have the `NEXT_PUBLIC_` prefix).

---

## What's not in this round

- **Drop-in React provider.** Round 6 will ship a
  `@holylabs/chat-sdk-web` package that wraps everything above into
  a single `<HolylabsChat />` component you import. Until then,
  the wrapper in §3 *is* the SDK.
- **Token refresh without reload.** Round 6 adds an inbound `auth`
  postMessage. Round 5 reloads the iframe when the JWT expires.
- **Anonymous visitors.** Auth-only this round; anonymous lands in
  round 6 behind a per-inbox flag.

---

## Reference

- Long-form developer docs (lives on the Holylabs dashboard):
  - `https://chat-admin.holylabs.io/dashboard/docs/install`
  - `https://chat-admin.holylabs.io/dashboard/docs/tokens`
  - `https://chat-admin.holylabs.io/dashboard/docs/sign-out`
  - `https://chat-admin.holylabs.io/dashboard/docs/security`
- Bridge protocol contract: `prompts/round-5/0-shared.md §6` in the
  chat-admin repo.
- Round-5 brief: `prompts/round-5-authenticated-widget-brief.md`.
