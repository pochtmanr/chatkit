# 1 — Server secrets (`sk_live_`) and widget user tokens

Read `AGENTS.md` and `0-shared.md` before starting. Independent of
prompts 2–6; only needs the 0-shared schema spec.

## Goal

Stand up the two new credential classes from `0-shared.md §2`:

- **`sk_live_…` server secrets**: created from the dashboard,
  hashed at rest, dual-key rotation, used only by host backends.
- **Widget JWTs**: short-lived HS256 tokens minted by a new
  `POST /api/v1/widget-tokens` endpoint and consumed by every
  `/api/embed/customer/*` handler.

After this prompt lands, a host backend with an `sk_live_` can
mint a token for any host user, and a `verifyWidgetToken()`
helper exists for prompt 2 to plug into customer endpoints.
**No customer endpoint is rewritten in this prompt** — that's
prompt 2's job. Land the foundation cleanly so prompt 2 can
import without inventing.

---

## Step 0 — Pre-flight

```bash
cat AGENTS.md
ls supabase/migrations/                # last is 0024
grep -n 'sk_live_\|widget_signing_secret' src/lib supabase/migrations  # expect no matches
grep -n '"jose"\|"jsonwebtoken"' package.json   # check which JWT lib is already present
```

Pick **`jose`** as the JWT library. It's edge-runtime safe (Web
Crypto under the hood), no Node `crypto` dependency, and we may
want to verify tokens in middleware later. Install if not
already present: `pnpm add jose`.

Read `node_modules/next/dist/docs/` for any route-handler /
runtime guidance before writing handlers.

---

## Step 1 — Migration `0025_round5_keys_and_widget.sql` (partial)

Apply via Supabase MCP — **never paste SQL into Studio**:

```
mcp__plugin_supabase_supabase__apply_migration name=0025_round5_keys_and_widget query=<sql>
```

This prompt is responsible for the `inboxes` parts of the
migration body. Prompts 3, 4, and 5 own their own table additions
but **must be folded into the same migration file** — coordinate
by writing the full migration in one go in this prompt. The full
spec is `0-shared.md §3`. Copy that verbatim:

- `inboxes` column additions (server_secret_hash,
  server_secret_previous_hash, server_secret_rotated_at,
  widget_signing_secret, widget_signing_secret_previous,
  auth_mode).
- `inboxes_auth_mode_check` constraint.
- `inbox_server_secret_distinct` constraint.
- Backfill `widget_signing_secret = gen_random_bytes(32)` for
  existing rows.
- `support_agents.skills text[]` + GIN index (prompt 3 will use
  this).
- `conversation_start_options` table (prompt 4 will use this).
- `widget_config` table (prompt 5 will use this).
- `conversations.start_option_id` column + index.
- RLS policies for the new tables (owner SELECT only;
  service-role bypass).

After applying, regenerate types:

```
mcp__plugin_supabase_supabase__generate_typescript_types
```

Write the result into `src/lib/supabase/database.types.ts`.
Verify the file still parses (`pnpm tsc --noEmit`).

---

## Step 2 — `sk_live_` helpers in `src/lib/server-secret.ts`

```ts
import "server-only";
import { randomBytes, createHash } from "node:crypto";

/** Format: `sk_live_<32 hex chars>` — 16 bytes of entropy. */
export function generateServerSecret(): { raw: string; prefix: string } {
  const bytes = randomBytes(16).toString("hex");
  const raw = `sk_live_${bytes}`;
  return { raw, prefix: raw.slice(0, 12) }; // sk_live_XXXX (4-char preview)
}

/** SHA-256 of the raw key, base64 encoded. Salt is unnecessary
 *  because `sk_live_` carries 128 bits of entropy and we never
 *  do dictionary attacks on hashes (we hash on the way in to
 *  look up the row, not for password checking). */
export function hashServerSecret(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("base64");
}

/** Resolve a raw sk_live_ key to its inbox. Returns null if no
 *  match. Honors dual-key rotation: matches `server_secret_hash`
 *  or `server_secret_previous_hash` (within 24h of rotation). */
export async function lookupServerSecret(raw: string): Promise<{
  inboxId: string;
  businessId: string;
} | null>;
```

Implementation notes:

- `lookupServerSecret` does **one** SELECT with
  `.or('server_secret_hash.eq.HASH,server_secret_previous_hash.eq.HASH')`.
- After matching, if the row matched on `previous_hash`, check
  `server_secret_rotated_at` and reject if older than 24h. (Set
  `previous_hash` to null in a fire-and-forget admin update —
  but do not block the request on it.)
- All callers use the service client. Never call this from
  browser code.

---

## Step 3 — JWT helpers in `src/lib/widget-token.ts`

```ts
import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { getServiceClient } from "@/lib/supabase/server";

const ALG = "HS256";
const ISS = "holylabs";

export type WidgetClaims = {
  iss: "holylabs";
  aud: string;            // inbox.id
  sub: string;
  name?: string;
  email?: string;
  avatar_url?: string;
  allowed_kinds: ("support"|"order"|"direct")[];
  external_refs?: Record<string, string[]>;
  iat: number;
  exp: number;
};

export type MintInput = {
  inboxId: string;
  businessId: string;
  sub: string;
  name?: string;
  email?: string;
  avatar_url?: string;
  allowed_kinds?: ("support"|"order"|"direct")[];
  external_refs?: Record<string, string[]>;
  ttl_seconds?: number;       // default 3600, clamped to [300, 3600]
};

export async function signWidgetToken(input: MintInput): Promise<{
  token: string;
  expires_at: string;
}>;

export async function verifyWidgetToken(
  rawJwt: string,
  publishableKey: string,
): Promise<{
  claims: WidgetClaims;
  inboxId: string;
  businessId: string;
}>;
```

Implementation requirements:

- `signWidgetToken`:
  - Load `inboxes.widget_signing_secret` for `inboxId`.
  - Reject if the inbox row is archived or the business is
    suspended.
  - `iat = now`, `exp = iat + clamp(ttl_seconds, 300, 3600)`.
  - Header includes `kid: inboxId` and `typ: 'JWT'`.
  - Default `allowed_kinds` is `['support']` if omitted by
    caller.
  - Sanity-cap claim sizes: `sub` ≤ 256, `name`/`email` ≤ 320,
    `external_refs` total JSON size ≤ 4 KB. Reject with
    a typed error if exceeded.
- `verifyWidgetToken`:
  - Resolve pk → inbox via existing `lookupInbox()` in
    `src/lib/embed-auth.ts` (export it from there if it's
    currently private; do not duplicate). Reject if business is
    not `active`.
  - Decode JWT header without verifying, read `kid`, reject if
    `kid !== inboxId`.
  - Verify signature against `widget_signing_secret`. On
    signature failure, retry with `widget_signing_secret_previous`
    if non-null. Both fail → 401.
  - Assert `aud === inboxId`, `iss === 'holylabs'`, `exp > now`,
    `iat <= now + 60s` (clock skew tolerance).
  - Return `{ claims, inboxId, businessId }`. **Never throw
    leaky errors out of this function** — the caller logs the
    internal reason but returns a generic 401 to the browser.

Use `jose`:

```ts
const secret = new Uint8Array(inbox.widget_signing_secret);
const jwt = await new SignJWT(payload)
  .setProtectedHeader({ alg: ALG, kid: inboxId, typ: "JWT" })
  .setIssuer(ISS)
  .setAudience(inboxId)
  .setSubject(sub)
  .setIssuedAt()
  .setExpirationTime(exp)
  .sign(secret);
```

For verify:

```ts
const { payload } = await jwtVerify(jwt, secret, {
  algorithms: [ALG],
  issuer: ISS,
  audience: inboxId,
  clockTolerance: 60,
});
```

Wrap both in try/catch and surface a typed result, not a thrown
`Error`, to the calling route. This keeps customer endpoints
small.

---

## Step 4 — `POST /api/v1/widget-tokens`

Create `src/app/api/v1/widget-tokens/route.ts`. (If `src/app/api/v1`
doesn't exist yet, create it — this is the first `/api/v1` route
in the repo. Read `node_modules/next/dist/docs/` on route
handlers first.)

```ts
// route.ts
export async function POST(request: NextRequest) {
  // 1. Bearer sk_live_… in Authorization header.
  // 2. JSON body matches the contract below.
  // 3. Mint a JWT via signWidgetToken().
  // 4. Return { token, expires_at, token_type: 'Bearer' }.
}
```

Request:

```http
POST /api/v1/widget-tokens
Authorization: Bearer sk_live_…
Content-Type: application/json

{
  "user_id": "host_user_uuid",      // → sub
  "name": "Roman Dr.",              // optional
  "email": "roman@example.com",     // optional
  "avatar_url": "https://…",        // optional
  "allowed_kinds": ["support"],     // optional, default ['support']
  "external_refs": { "order": ["ord_123"] }, // optional
  "ttl_seconds": 3600               // optional, default 3600, clamped [300, 3600]
}
```

Response (200):

```json
{
  "token": "eyJhbGc…",
  "token_type": "Bearer",
  "expires_at": "2026-05-22T18:00:00.000Z"
}
```

Failure modes:

- `401 invalid server secret` — missing/wrong/unknown sk_live_,
  or rotated previous secret past 24h grace.
- `400 invalid payload` — bad JSON, missing `user_id`, oversize
  claim, unknown `allowed_kinds` entry.
- `403 business suspended` — explicit, to help host backends
  debug. (This is the one informational error the endpoint
  emits because it's server-to-server — not browser-visible.)

Other notes:

- `user_id` must be a non-empty string up to 256 chars. Reject
  `user_id === ''`, `user_id` containing whitespace, or anything
  longer.
- Allowed kinds must be a subset of `['support','order','direct']`.
- `external_refs` keys must be in `allowed_kinds`. Values must
  be non-empty string arrays, ≤ 32 entries per kind, each entry
  ≤ 128 chars.
- Log the mint with `inboxId`, `sub`, and a sha256 of the
  generated token's last 16 chars (for correlation with later
  verification logs). Don't log raw token bodies or secret keys.

---

## Step 5 — Dashboard server actions in `src/app/dashboard/_actions/server-secrets.ts`

Mirror the pattern in `src/app/dashboard/_actions/mcp-keys.ts`
exactly — same return type union, same `requireRole`,
`activeBusinessId`, `revalidatePath` shape.

```ts
"use server";

export async function createServerSecret(input: {
  inboxId: string;
}): Promise<ActionResult<{ id: string; rawKey: string; prefix: string }>>;

export async function rotateServerSecret(input: {
  inboxId: string;
}): Promise<ActionResult<{ rawKey: string; prefix: string }>>;

export async function revokeServerSecret(input: {
  inboxId: string;
}): Promise<ActionResult>;
```

Behavior:

- `createServerSecret`: gated to `role >= owner`. Generates a
  fresh `sk_live_`, stores its hash in `server_secret_hash`. If
  the column is already non-null, refuse (use rotate instead).
  Returns the raw key once. UI must surface a "save this now,
  we don't show it again" warning.
- `rotateServerSecret`: gated to `role >= owner`. Generates a
  new key, moves the current hash into `server_secret_previous_hash`,
  sets `server_secret_rotated_at = now()`. Returns the new raw
  key once.
- `revokeServerSecret`: gated to `role >= owner`. Nulls all
  three columns. The host backend immediately loses minting
  ability; existing tokens keep verifying until their `exp`.

`revalidatePath("/dashboard/settings/api-keys")` after every
mutation.

---

## Step 6 — Dashboard UI

The repo already has `/dashboard/settings/mcp` for MCP keys.
Mirror that page's structure for `sk_live_` management.

If a generic `/dashboard/settings/api-keys` page does **not** exist
(check `src/app/dashboard/settings/api-keys/`), create one. It
hosts both the `pk_live_…` row (read-only display of the existing
inbox `api_key`) and the new `sk_live_…` section.

Components:

- `src/app/dashboard/settings/api-keys/page.tsx` —
  Server component. Loads the inbox row(s) for the active
  business. Renders:
  - **Publishable key** card per inbox: shows `pk_live_…`,
    copy button, "this is safe to embed in browsers" copy.
  - **Server secret** card per inbox: shows
    `sk_live_…` prefix (4 chars) + truncation if set, or
    "Create server secret" button if unset. Buttons for
    "Rotate" and "Revoke" if set. Last-rotated timestamp
    visible.
- `src/app/dashboard/_components/settings/ServerSecretCard.tsx` —
  client component with the create/rotate/revoke buttons.
  Implements the **show-once modal**: after a successful
  mutation, opens a modal with the raw key + a "Copy" button +
  a "I've saved it" confirmation. Closing the modal navigates
  away from the raw key forever.

Add the page to `NavMenu.tsx`:

```ts
// in the Settings children array, after "MCP":
{ href: "/dashboard/settings/api-keys", label: "API keys", icon: Key, roles: ["owner"] },
```

There's currently a top-level `/dashboard/api-keys` route — if
it duplicates this page, delete the top-level entry and replace
its `pk_live_` display with a link to the settings page. Pick
exactly one home for the publishable key.

---

## Step 7 — Tests / verification block

Add `src/lib/__tests__/widget-token.test.ts` if the repo has a
test runner configured; otherwise document the manual checks
inline at the bottom of the prompt. Round 4 didn't ship Jest, so
default to manual checks:

```bash
# 1. Mint a token end-to-end:
SK=$(pnpm dlx tsx -e 'import { generateServerSecret } from "./src/lib/server-secret"; console.log(generateServerSecret().raw)')
# (Set the hash in the DB via the dashboard for an inbox you own.)

curl -X POST https://chat-admin.local/api/v1/widget-tokens \
  -H "Authorization: Bearer $SK" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"u_test","allowed_kinds":["support"]}'
# → { token: "eyJ…", expires_at: "…", token_type: "Bearer" }

# 2. Verify shape:
pnpm dlx tsx -e '
  import { jwtVerify } from "jose";
  const t = process.env.TOKEN;
  const s = new Uint8Array(Buffer.from(process.env.SECRET_HEX, "hex"));
  console.log(await jwtVerify(t, s));
'

# 3. Negative: missing sk_live_ → 401.
curl -X POST https://chat-admin.local/api/v1/widget-tokens \
  -d '{"user_id":"u_test"}'
# → 401

# 4. Negative: pk_live_ in place of sk_live_ → 401.
curl -X POST https://chat-admin.local/api/v1/widget-tokens \
  -H "Authorization: Bearer pk_live_…" \
  -d '{"user_id":"u_test"}'
# → 401
```

Add the three negative cases as a comment block at the bottom of
`route.ts` so the next person sees them.

---

## Step 8 — Out of scope (do NOT do in this prompt)

- Do not modify any `/api/embed/conversations/*` handler. That's
  prompt 2.
- Do not rename `/embed/widget` → `/embed/customer`. Prompt 2.
- Do not write the topic picker UI. Prompt 4.
- Do not add `widget_config` fields to the dashboard. Prompt 5.

---

## Definition of done

- [ ] `0025_round5_keys_and_widget.sql` applied via Supabase MCP.
- [ ] `src/lib/supabase/database.types.ts` regenerated. `pnpm
      tsc --noEmit` clean.
- [ ] `src/lib/server-secret.ts` and `src/lib/widget-token.ts`
      exist and export the typed surface above.
- [ ] `POST /api/v1/widget-tokens` returns a valid HS256 JWT for
      a valid `sk_live_…`. Negative cases all return 401/400/403
      as specified.
- [ ] Dashboard has a card per inbox for creating, rotating,
      and revoking `sk_live_…`. Raw key is shown once in a modal
      and never persisted in client state past the modal close.
- [ ] `wc -l` on every touched/created file ≤ 600.

End the PR description with the migration name, the three
exported helper signatures, and a one-line note that the JWT
verifier is ready for prompt 2 to consume via
`verifyWidgetToken(rawJwt, publishableKey)`.
