# 6 — Host integration: docs + greenflagged.com example

Read `AGENTS.md` and `0-shared.md` before starting. Depends on
prompts 1 and 2 — `POST /api/v1/widget-tokens` and the new
customer surface must be live.

## Goal

The brief is explicit: "developer experience should be easy". The
existing `EmbedSnippets.tsx` page renders a one-line script tag
that is no longer sufficient — authenticated-only mode requires a
server-side token mint and a JWT in the iframe URL.

This prompt produces three things:

1. **Updated `EmbedSnippets.tsx`** showing the new install flow
   (script tag + iframe + token mint backend example).
2. **`/dashboard/docs` page set** (small, focused) with the
   long-form developer guide:
   `Install on a website (auth-only)`, `Mint a widget token from
   your backend`, `Sign-out destroy`, `Security model`.
3. **A real working integration example** in the
   `prompts/round-5/examples/greenflagged-integration.md` file —
   the exact code path greenflagged.com uses to mint tokens and
   render the iframe. This is the founder's reference for what
   "production-ready" looks like and what to give the
   greenflagged team.

After this prompt: a developer reading `EmbedSnippets.tsx` can
install Holylabs Chat in their own app without trial and error.

---

## Step 0 — Pre-flight

```bash
cat AGENTS.md
cat src/app/dashboard/settings/EmbedSnippets.tsx   # current install copy
ls src/app/dashboard/                              # confirm no /docs yet
curl -i https://chat-admin.local/api/v1/widget-tokens \
  -H "Authorization: Bearer sk_live_test_…" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"u_test"}'
# expect: 200 with a token (prompt 1 landed)
curl -i https://chat-admin.local/embed/customer?key=pk_live_…&token=<jwt>
# expect: 200 with the widget shell (prompt 2 landed)
```

If either curl fails, the upstream prompt has not landed.

---

## Step 1 — Update `EmbedSnippets.tsx`

Open `src/app/dashboard/settings/EmbedSnippets.tsx`. Today it
emits a one-line script tag with the pk. Replace with three
sections — pick the most readable one to surface as the
"recommended" tab and stash the others in collapsibles.

### Tab 1: HTML + vanilla JS (recommended for round 5)

```html
<!-- 1. Your backend mints a widget token after your user signs in. -->
<!-- 2. Inject the token + your publishable key into the iframe URL. -->
<iframe
  id="holylabs-chat"
  src="https://chat-admin.holylabs.io/embed/customer?key=<pk_live_…>&token=<JWT>"
  allow="clipboard-write"
  style="position:fixed; right:16px; bottom:16px; width:80px; height:80px; border:0; z-index:9999; background:transparent;"
></iframe>
<script>
(function () {
  const iframe = document.getElementById("holylabs-chat");
  const HOST_ORIGIN = window.location.origin;
  const NONCE = crypto.randomUUID();

  // Initial handshake: tell the iframe our origin + a nonce.
  iframe.addEventListener("load", () => {
    iframe.contentWindow.postMessage(
      { v: 1, type: "init", nonce: NONCE, hostOrigin: HOST_ORIGIN },
      "https://chat-admin.holylabs.io"
    );
  });

  // Resize based on widget open/close.
  window.addEventListener("message", (e) => {
    if (e.origin !== "https://chat-admin.holylabs.io") return;
    if (e.data?.v !== 1) return;
    if (e.data.nonce !== NONCE) return;
    if (e.data.type === "open") {
      iframe.style.width  = e.data.open ? "380px" : "80px";
      iframe.style.height = e.data.open ? "560px" : "80px";
    }
  });

  // When your user signs out, tear down the widget session.
  // window.holylabsSignOut() — call this from your own logout flow.
  window.holylabsSignOut = function () {
    iframe.contentWindow.postMessage(
      { v: 1, type: "sign-out", nonce: NONCE },
      "https://chat-admin.holylabs.io"
    );
  };
})();
</script>
```

### Tab 2: Token mint — Node.js / Next.js backend

```ts
// app/api/holylabs-token/route.ts (Next.js Route Handler)
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // 1. Authenticate your own user. Replace with your real auth.
  const session = await getMySession(req);  // → { userId, name, email }
  if (!session) return NextResponse.json({ error: "auth required" }, { status: 401 });

  // 2. Mint a widget token via Holylabs.
  const res = await fetch("https://chat-admin.holylabs.io/api/v1/widget-tokens", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${process.env.HOLYLABS_SK_LIVE}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      user_id: session.userId,
      name: session.name,
      email: session.email,
      allowed_kinds: ["support"],
      ttl_seconds: 3600,
    }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "token mint failed" }, { status: 502 });
  }
  const { token, expires_at } = await res.json();
  return NextResponse.json({ token, expires_at });
}
```

The frontend fetches this endpoint right before rendering the
iframe:

```ts
const { token } = await fetch("/api/holylabs-token", { method: "POST" })
  .then(r => r.json());
iframe.src = `https://chat-admin.holylabs.io/embed/customer`
           + `?key=${pkLive}&token=${encodeURIComponent(token)}`;
```

### Tab 3: cURL (for debugging)

```bash
curl -X POST https://chat-admin.holylabs.io/api/v1/widget-tokens \
  -H "Authorization: Bearer $HOLYLABS_SK_LIVE" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "u_test",
    "name": "Test User",
    "email": "test@example.com",
    "allowed_kinds": ["support"]
  }'
```

### Implementation notes for the page

- Three tabs (HTML / Backend / cURL) — use the existing tab
  component if the repo has one, otherwise build a minimal one
  in 20 lines.
- Each snippet has a copy button.
- The pk and an example sk prefix (e.g. `sk_live_•••••••••f4a3`)
  are interpolated into the snippet from the current
  business/inbox.
- Below the snippets, a callout: **"Never put `sk_live_…` in
  browser code. Mint tokens server-side only. See `/dashboard/docs/security`."**

Drop the old single-line `loader.js` reference (the loader script
doesn't yet exist in the repo and round 6 will ship the SDK
wrapper). Replace its mention with a "Coming in v0.6: drop-in
React provider" note.

---

## Step 2 — `/dashboard/docs/*` pages

Create a small docs section in the dashboard. Four pages:

```
src/app/dashboard/docs/
├── layout.tsx                 -- sidebar with the four entries
├── page.tsx                   -- redirect to /install
├── install/page.tsx           -- the install guide
├── tokens/page.tsx            -- token minting deep dive
├── sign-out/page.tsx          -- sign-out destroy semantics
└── security/page.tsx          -- security model
```

All four are static MDX or plain TSX pages — pick whichever the
repo already uses (the marketing `/api-reference` page lives under
`(marketing)` and uses plain TSX; mirror that). Keep each page
≤ 400 lines.

Add a top-level nav entry on the sidebar:

```ts
{ href: "/dashboard/docs", label: "Docs", icon: BookOpen },
```

### `install/page.tsx`

Walks a developer through:

1. **Get your publishable and server keys** —
   link to `/dashboard/settings/api-keys`.
2. **Add your allowed origin** —
   link to `/dashboard/settings/business` (where the
   `allowed_origins` list lives).
3. **Configure conversation start options** —
   link to `/dashboard/settings/start-options`.
4. **Mint a widget token from your backend** —
   show the Node.js snippet from §1 Tab 2 inline.
5. **Embed the iframe + handshake** —
   show the HTML snippet from §1 Tab 1 inline.
6. **Wire your sign-out flow** —
   one-line `window.holylabsSignOut()` example. Link to the
   `sign-out` deep dive.
7. **What you should see** — screenshot from greenflagged.

### `tokens/page.tsx`

- JWT shape (mirror `0-shared.md §2.3`).
- `ttl_seconds` clamping (300–3600).
- `allowed_kinds` and `external_refs` semantics with examples.
- How to refresh: re-mint and post the new token via a future
  `auth` message (round 6); for round 5, reload the iframe.
- Failure modes and what each 401 means.

### `sign-out/page.tsx`

- Why: when the host user signs out, the widget must stop
  fetching, drop its in-memory token, unsubscribe from realtime.
- The `sign-out` postMessage payload.
- A code snippet showing where to call it (host auth provider's
  sign-out callback).
- The widget's behavior after sign-out: panel closes, no
  refetches, requires a fresh `init` to re-render.

### `security/page.tsx`

Four hard rules, large and bold:

> **DO NOT put `sk_live_…` in browser code.**
> **DO NOT skip the `allowed_origins` allowlist.**
> **DO NOT pass user identity from query strings — mint a JWT.**
> **DO rotate `sk_live_…` if you suspect a leak.**

Then the security model in prose:

- Three credential classes (mirror `0-shared.md §1`).
- Origin allowlist as defense-in-depth.
- JWT signing with HS256 + dual-key rotation.
- Postmessage handshake.
- Sender identity (`sender_id = claims.sub`).
- What the publishable key cannot do anymore (list
  conversations).

Cross-link to `/dashboard/settings/api-keys` for rotation, and
to the brief PDF (if exported) for the long-form security
positioning.

---

## Step 3 — Greenflagged integration example

Create `prompts/round-5/examples/greenflagged-integration.md`. A
focused, copy-paste guide for the greenflagged team. The file
should be self-contained and not depend on round-5 prompt
context — it's a handoff document.

Outline:

```
# Greenflagged.com × Holylabs Chat (Round 5 integration)

## What you'll do
1. Add HOLYLABS_SK_LIVE to greenflagged's env vars.
2. Create a Next.js route handler that mints a token for the
   signed-in greenflagged user.
3. Render the iframe + handshake on every authenticated layout.
4. Wire `window.holylabsSignOut()` into your existing sign-out
   button.

## 1. Environment

GREENFLAGGED_HOLYLABS_PK_LIVE = pk_live_45f4942f494ae8a94da8aca3
GREENFLAGGED_HOLYLABS_SK_LIVE = sk_live_…   ← create at https://chat-admin.holylabs.io/dashboard/settings/api-keys

## 2. Token mint endpoint
   (full code, ~30 lines, same as §1 Tab 2 of EmbedSnippets but
   tailored to greenflagged's existing auth helpers — assumes
   greenflagged uses Supabase Auth, so the snippet calls
   `supabase.auth.getUser()`.)

## 3. The iframe wrapper
   A React component at `apps/web/src/components/HolylabsChat.tsx`
   that:
   - Fetches `/api/holylabs-token` on mount.
   - Renders the iframe with `?key=…&token=…`.
   - Posts `init` once the iframe loads.
   - Listens for resize messages and updates iframe size.
   - Exposes `signOut()` via a ref or context.

## 4. Sign-out hook
   In greenflagged's existing sign-out button:
   ```ts
   await supabase.auth.signOut();
   window.holylabsSignOut?.();
   ```

## 5. Verification
   - Sign in to greenflagged. Open browser dev tools → Network.
   - Confirm a POST to /api/holylabs-token returns a JWT.
   - Confirm the iframe loads with both query params.
   - Open a Billing topic. Confirm in Holylabs' dashboard that
     the conversation has external_ref = your supabase user id.
   - Sign out. Confirm the iframe panel closes and no further
     fetches go to /api/embed/customer/*.
```

Include the actual code, not pseudocode. Test the snippets by
following them on a fresh checkout of greenflagged before
calling this prompt done.

---

## Step 4 — Repo `README.md` updates

Open the repo's `README.md`. Add a "Round 5: Authenticated widget"
section near the top (above the existing rounds) with:

- A one-paragraph summary of what round 5 changed.
- A link to `prompts/round-5/README.md`.
- A "Migration" callout: legacy `pk_live_…`-only widget callers
  must now mint a JWT; see `/dashboard/docs/install`.

Don't restructure the README beyond that — keep edits minimal.

---

## Step 5 — Verification

```bash
# 1. EmbedSnippets renders the new three-tab layout with copy
#    buttons. Each snippet uses the correct pk for the active
#    inbox. Copy-paste each into a clean Next.js project and
#    confirm it works.

# 2. Docs pages all load. Internal links resolve. No 404s.
#    /dashboard/docs           → /dashboard/docs/install
#    /dashboard/docs/install   → 200, includes screenshots
#    /dashboard/docs/tokens    → 200
#    /dashboard/docs/sign-out  → 200
#    /dashboard/docs/security  → 200

# 3. Greenflagged integration example end-to-end:
#    Follow the example file line-by-line on greenflagged repo.
#    Confirm token mint + iframe + sign-out all work.

# 4. README.md round-5 section visible at repo root.

# 5. Search the repo for stale "EMBED_ALLOWED_ORIGINS" references.
#    grep -rn 'EMBED_ALLOWED_ORIGINS' . --include='*.md' --include='*.ts' --include='*.tsx'
#    Document any survivors in the PR; delete or update them.

# 6. Spot-check: the README and docs all reference the new
#    /api/embed/customer surface, not the legacy
#    /api/embed/conversations.

# 7. No mention of an unbuilt SDK wrapper as if it's available.
#    grep -rn 'HolylabsChatProvider\|holylabs\.init' src/ prompts/
#    Expected: only the "Coming in v0.6" callout.
```

---

## Step 6 — Out of scope

- **React/script SDK wrapper.** Round 6. Round 5 docs explicitly
  describe the manual iframe + postMessage path and label the SDK
  as "Coming in v0.6".
- **MCP docs.** Existing MCP page stays put; this prompt doesn't
  touch it.
- **API reference page rewrite.** The marketing
  `/api-reference` page is separate and unrelated to dashboard
  docs.
- **Auto-generated OpenAPI / TypeScript SDK.** Round 6+.

---

## Definition of done

- [ ] `EmbedSnippets.tsx` shows three labeled tabs (HTML /
      Backend / cURL) with copy buttons and the correct pk.
- [ ] `/dashboard/docs/{install,tokens,sign-out,security}` all
      load with the expected content.
- [ ] Nav has a "Docs" entry.
- [ ] `prompts/round-5/examples/greenflagged-integration.md`
      exists, is self-contained, and was successfully followed
      end-to-end on the greenflagged repo before the prompt was
      marked done.
- [ ] README.md has a "Round 5" section linking to
      `prompts/round-5/README.md`.
- [ ] No stale references to `EMBED_ALLOWED_ORIGINS`,
      `/api/embed/conversations`, or `pk_live_`-only auth in
      docs.
- [ ] `wc -l` ≤ 600 on every touched/created file. Each docs
      page ≤ 400 lines.

End the PR description with: a screenshot of the new
`EmbedSnippets.tsx`, the four docs page URLs, and a note that
the greenflagged example was successfully executed (with a
commit hash on the greenflagged repo where it landed).
