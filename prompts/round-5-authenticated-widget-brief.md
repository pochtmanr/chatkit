# Round 5 Brief: Authenticated Web Widget and Enterprise-Ready Chat Platform

## Executive Goal

Build the next version of Holylabs Chat as an enterprise-grade support and messaging infrastructure layer for modern web apps, marketplaces, delivery platforms, SaaS dashboards, and mobile products.

The product should not feel like "another website chat bubble." It should feel like a serious developer platform that gives companies Intercom-level polish, Zendesk-level operational confidence, and app-native conversation workflows that generic competitors do not handle well.

The immediate focus is the browser/web integration:

- The customer chat popup should be available only to authenticated users when the host app requires it.
- The widget must be secure enough for large projects where the embedding website may contain sensitive customer, order, booking, or account data.
- The customer-facing widget must be clearly separated from the embedded agent/admin inbox.
- The integration should be easy for developers: a script or React SDK should hide iframe sizing, postMessage details, identity handling, and API calls.

## Current Product Context

The current app is a Next.js 16 / React 19 / Supabase platform with:

- Tenant dashboard at `/dashboard`.
- Embeddable visitor/agent surfaces under `/embed`.
- Public REST APIs under `/api/v1`.
- Embed APIs under `/api/embed`.
- Supabase Postgres, Storage, Auth, and Realtime.
- Per-inbox API keys.
- Webhooks per inbox.
- Early multi-agent support via `support_agents`.
- Conversation status workflow.
- MCP-related infrastructure.

Current browser embed auth is mostly:

- `pk_live_...` or `pk_test_...` inbox API key.
- Origin/Referer allowlist from `businesses.allowed_origins`.
- CSP `frame-ancestors` for `/embed/*`.

This is a useful prototype foundation, but not sufficient for enterprise customers. A publishable key plus origin allowlist must not be the final authorization model for user-specific data.

## Main Problem To Solve

Today, the codebase has conceptual overlap between:

- A visitor/customer chat widget.
- An embedded agent/admin inbox.
- Public SDK APIs.
- Internal dashboard APIs.

For big customers, these must be cleanly separated.

The customer-facing popup should only let a user read and write conversations that belong to that user or to a signed context granted by the host app. It must never expose "list all tenant conversations" behavior to a customer widget.

The agent-facing inbox should require human agent authentication or a strong signed embedded-agent session, not just a publishable key.

## Product Positioning

Holylabs Chat should compete by being app-native, not just website-native.

Competitors usually optimize for generic live chat:

- Intercom: excellent website messenger and support workflows.
- Zendesk: enterprise ticketing and operations.
- Crisp: simple website chat and SDKs.
- Freshchat: multichannel messaging.
- Help Scout Beacon: lightweight support/contact widget.
- Chatwoot: open-source live chat.

Holylabs should lean into:

- Authenticated app users.
- Conversation kinds such as `support`, `order`, `direct`, `booking`, `account`, or future custom types.
- External references owned by the host app, such as order id, delivery id, booking id, workspace id, seller id, or subscription id.
- Embedded support inboxes inside partner/admin tools.
- Webhooks and server APIs as first-class features.
- Multi-agent routing and assignment.
- Realtime app messaging, not only website lead capture.
- Strong developer experience: script tag, React SDK, React Native SDK later, REST API, webhooks, and MCP.

## Required Architecture Direction

### 1. Separate Surfaces

Create a strict distinction between customer widget and agent/admin inbox.

Recommended route model:

- `/embed/customer` or `/widget/customer`
  Customer-facing chat popup. Can be embedded on customer web apps and websites.

- `/embed/inbox`
  Embedded agent/admin inbox for partner admin panels.

- `/dashboard` and future `/workbench`
  Native Holylabs admin and multi-agent support operations.

Recommended API model:

- `/api/embed/customer/*`
  Browser APIs for authenticated or anonymous end users.

- `/api/embed/agent/*`
  Browser APIs for embedded agent/admin inboxes. Must require agent session or signed embedded-agent token.

- `/api/v1/*`
  Server/API/SDK surface. Split public publishable-key endpoints from server-secret endpoints.

- `/api/dashboard/*`
  Session-authenticated Holylabs dashboard APIs.

The customer widget must not call endpoints that return all conversations for an inbox or tenant.

### 2. Introduce Key and Token Classes

The current `pk_live_...` key does too much. Split responsibilities.

Recommended key/token classes:

- Publishable key: `pk_live_...`
  Safe to expose in browsers. Used only to bootstrap widget configuration and identify the tenant/inbox.

- Server secret: `sk_live_...`
  Never exposed to browsers. Used by customer backend services for trusted API calls, imports, secure identity signing, admin operations, and webhook configuration.

- Widget user token:
  Short-lived signed JWT or HMAC-backed token that identifies the current end user and grants access to a narrow conversation scope.

- Embedded agent token:
  Short-lived signed token for partner admin panels when the customer wants to show Holylabs inbox inside their own admin. It must represent a real agent/admin identity or a scoped service identity.

- Webhook secret:
  Per-inbox secret used to sign outgoing webhooks.

### 3. Authenticated Customer Widget

The customer popup should support two modes.

Authenticated mode:

- Host app only renders or initializes the widget after the user is signed in.
- Host backend creates or signs a short-lived widget token.
- Widget token contains:
  - tenant/business id or inbox id
  - user id (`sub`)
  - optional name/email/avatar
  - allowed conversation kinds
  - optional external refs
  - expiration time
  - issuer/audience
- Holylabs verifies the token before rendering user data.
- Customer endpoints only return conversations where the user is a participant or where the token explicitly grants access.

Anonymous mode:

- Optional and explicitly configured per inbox.
- Useful for marketing sites or lead capture.
- Uses local visitor id, but still scoped to one visitor conversation.
- Should be disabled by default for app-authenticated projects.

This lets customers choose:

- "Only logged-in users can chat."
- "Anyone can start a support conversation."
- "Only logged-in users can chat about orders/bookings/accounts."

### 4. Recommended Auth Flow

Browser setup:

1. Host app loads Holylabs script or React provider with a publishable key.
2. Host app checks whether its own user is authenticated.
3. If user is not authenticated:
   - Do not show the popup, or show a disabled/login CTA if configured.
4. If user is authenticated:
   - Host app requests a signed widget token from its own backend.
   - Backend signs token using a server secret or calls Holylabs token mint endpoint with `sk_live_...`.
   - Widget initializes with `pk_live_...` and the signed user token.
5. Holylabs validates:
   - publishable key exists and tenant/inbox is active
   - origin is allowlisted
   - widget token is valid, unexpired, and matches the inbox/tenant
   - requested conversation belongs to the signed user/scope

The token should be short-lived, for example 15-60 minutes, and refreshable.

### 5. Conversation Authorization Rules

Customer widget rules:

- A customer may only list their own conversations.
- A customer may only read messages from conversations where:
  - `external_ref === token.sub`, or
  - `participants` contains `token.sub`, or
  - token contains an explicit scoped permission for that external ref.
- A customer may only create conversations for allowed kinds.
- For order/booking/account conversations, the token should include the allowed external ref or the host backend should create the conversation server-side.
- Customer messages use `sender_id = token.sub`, not user-supplied sender id.
- Customer profile data should come from signed token claims or server-side upsert, not arbitrary browser input in authenticated mode.

Agent/admin inbox rules:

- An agent may list inbox conversations only if authenticated as owner/lead/agent for that business/inbox.
- Agent messages should use `sender_id = agent-<supabase_user_id>` or another stable agent identity.
- Avoid generic `sender_id = "agent"` except for legacy compatibility.
- Audit every agent action: message send, assignment, status change, transfer, deletion, and note.

### 6. Browser Integration API

The final developer experience should offer both script and React SDK.

Script integration should look conceptually like:

- Load Holylabs widget script.
- Initialize with publishable key.
- Provide or fetch a user token when authenticated.
- SDK creates and manages iframe internally.
- SDK handles resize, open, close, unread count, deep links, and refresh.

React integration should look conceptually like:

- `HolylabsChatProvider` at app root.
- Pass publishable key and async `getToken`.
- Use hooks for `open`, `close`, `setContext`, `unreadCount`, and events.

The host developer should not manually:

- Create iframe HTML.
- Listen for postMessage resizing.
- Store visitor ids directly.
- Call raw REST endpoints for normal widget usage.

### 7. Widget UX Requirements

The popup should feel premium and app-native.

Core states:

- Hidden because user is not authenticated.
- Closed FAB with unread badge.
- Loading/authenticating state.
- Conversation list, if multiple conversations are allowed.
- Single active conversation, if product config uses one support thread.
- Start conversation state.
- Empty state.
- Offline/expected response state.
- Error/retry state.
- Attachment uploading state.
- Agent typing state.
- Message delivery status.

Authenticated app behavior:

- If the user is not logged in, default behavior should be no popup.
- Optional configuration can show a "Sign in to contact support" button, but this should be opt-in.
- If user signs out, SDK should immediately destroy session state, hide conversations, unsubscribe from realtime, and clear token-specific state.
- If user switches accounts, SDK should reset and reinitialize with the new token.

Conversation behavior:

- Support conversation: one persistent thread per user/inbox by default.
- Order/booking/account conversation: one thread per external ref.
- Deep open should support context:
  - kind
  - external_ref
  - title
  - metadata
  - participants if allowed
- Widget should display context clearly, for example "Order #1234" or "Booking May 26".

Visual direction:

- Quiet, polished, operational UI.
- Looks trustworthy inside enterprise dashboards and modern SaaS apps.
- No loud generic marketing bubble feeling.
- Customizable brand color, logo, position, launcher icon, and copy.
- Must work on desktop and mobile.
- Must not overlap host app controls in an incoherent way.

Accessibility:

- Keyboard reachable.
- Focus trap while open.
- Escape closes.
- Screen-reader labels for launcher, close, send, upload.
- Good color contrast.
- Reduced motion support.

### 8. postMessage Security

The iframe bridge must be hardened.

Requirements:

- Do not accept commands from any origin.
- Derive expected parent origin from `document.referrer` or initialization config.
- Validate every incoming `message` event against expected origin.
- Include a nonce/session id in the initial handshake.
- Send messages only to the verified parent origin, not `*`, after handshake.
- Ignore unknown message types.
- Version message protocol, for example `holylabs.widget.v1`.
- Never accept raw user identity or privileged commands from postMessage alone.

Allowed postMessage commands should be narrow:

- open
- close
- set context
- request resize
- view profile/order event back to host
- unread count event

Sensitive actions must still be authorized by server-verified tokens.

### 9. Realtime Requirements

Current Supabase Realtime broadcast channels are a good starting point, but access must be scoped.

Requirements:

- A customer can only subscribe to channels for conversations they are authorized to access.
- Avoid exposing raw channel names in a way that enables guessing another conversation id.
- Consider server-issued channel tokens or a backend WebSocket gateway if Supabase channel authorization becomes limiting.
- Messages should still be persisted through REST/server APIs first, then broadcast.
- Realtime failure must not break message persistence.
- Clients need fallback polling for degraded realtime.

### 10. Attachments

Enterprise-safe attachment handling:

- Validate file type and size server-side.
- Store under tenant/conversation scoped paths.
- Prefer private storage with signed read URLs for sensitive projects.
- Public buckets are acceptable only for non-sensitive starter mode.
- Add malware scanning hook later.
- Add attachment metadata table later if needed.
- Support image previews first, then files.

### 11. Webhooks

Webhooks must become production-grade.

Requirements:

- Per-inbox webhook secret.
- Sign every webhook with timestamp and HMAC.
- Include event id and idempotency key.
- Include event version.
- Retry failed deliveries with exponential backoff.
- Store delivery attempts.
- Allow manual replay from dashboard.
- Show recent failures in dashboard.
- Support event subscriptions per inbox.
- Avoid sending unbounded PII by default.

Required headers:

- `x-holylabs-event-id`
- `x-holylabs-timestamp`
- `x-holylabs-signature`
- `x-holylabs-delivery-id`

Recommended events:

- `message.created`
- `conversation.created`
- `conversation.status_changed`
- `conversation.assigned`
- `conversation.transferred`
- `conversation.closed`
- `user.updated`

### 12. Multi-Agent and Enterprise Operations

The new support ticket page should build on these concepts:

- Business owner, lead, and agent roles.
- Agent status: online, away, offline.
- Conversation assignment.
- Internal transfers between inboxes.
- Conversation statuses.
- Agent notes.
- Collision detection when multiple agents open same conversation.
- Audit trail.
- Saved replies/macros.
- SLA timers.
- Priority.
- Tags.
- Search and filters.
- Internal notes separate from customer-visible messages.

Important:

- The customer widget must show assigned agent identity when available.
- Agent attribution should be real, not generic "Support".
- If no assigned agent exists, show team/business identity.

### 13. Data Model Improvements

Recommended additions or evolutions:

- `inbox_keys`
  Store hashed keys instead of raw API keys when possible. Support rotation and revocation.

- `widget_sessions`
  Optional table for issued widget sessions if JWT-only stateless auth is not enough.

- `conversation_participants`
  Normalize participants for richer roles, joins, and permissions. Arrays are okay for prototype, but large projects will need better querying.

- `conversation_events`
  Audit log for created, assigned, transferred, status changed, closed, reopened, etc.

- `message_events`
  Read receipts, delivery receipts, edits, deletes.

- `webhook_secrets`
  Support active and next secret for rotation.

- `rate_limits` or external rate-limit store
  Prevent spam and abuse.

### 14. Security Requirements

Baseline before enterprise launch:

- Publishable key cannot grant tenant-wide conversation read access.
- User identity must be server-signed in authenticated mode.
- Agent identity must be session-backed or signed.
- Origin allowlist remains as defense-in-depth, not primary auth.
- Strong CSP for embedded routes.
- No sensitive errors returned to public browser endpoints.
- Rate limit public and embed endpoints.
- Rotate/revoke keys.
- Webhook signatures.
- Audit logs for support actions.
- Avoid storing raw secrets where hashing is possible.
- Confirm all service-role usage has explicit manual authorization checks.

### 15. Rate Limiting and Abuse Protection

Add rate limits per:

- IP address.
- Publishable key.
- Widget user token subject.
- Conversation id.
- Endpoint category.

Recommended examples:

- Start conversation: low frequency per user/IP.
- Send message: moderate frequency per user/conversation.
- Upload: strict frequency and size.
- Typing: very strict or client-throttled plus server-throttled.
- Token mint: strict server-side.

Return clear, non-leaky `429` responses.

### 16. Observability

Add structured logs and metrics for:

- Widget initialization success/failure.
- Auth/token verification failures.
- Message send latency.
- Realtime broadcast failures.
- Webhook delivery success/failure.
- Upload failures.
- Rate-limit hits.
- Agent response time.
- Conversation volume per tenant/inbox.

Dashboard should eventually surface:

- Conversations by status.
- First response time.
- Resolution time.
- Open backlog.
- Agent activity.
- Webhook health.

### 17. Documentation Requirements

Docs should be written for developers and CTOs.

Required docs:

- "Install on a website"
- "Install in a React app"
- "Authenticated users only"
- "Anonymous visitor mode"
- "Open chat for an order/booking/account"
- "Server API keys"
- "Webhook verification"
- "Embedded agent inbox"
- "Security model"
- "Key rotation"

Docs should clearly state:

- Do not put `sk_live_...` in browser code.
- `pk_live_...` only bootstraps the widget.
- User tokens must be generated server-side.
- Origin allowlist is required but not a replacement for user auth.

### 18. Build Phases

#### Phase 1: Safety Split

- Rename/reorganize customer widget vs agent inbox concepts.
- Prevent customer widget from using tenant-wide conversation list APIs.
- Add clear endpoint boundaries.
- Update docs and dashboard copy.
- Fix stale references to `EMBED_ALLOWED_ORIGINS`.

#### Phase 2: Authenticated Widget Token

- Add signed widget user token verification.
- Add config for inbox mode: authenticated only vs anonymous allowed.
- Implement customer widget initialization with `pk_live_...` + user token.
- Ensure sign-out/account-switch destroys widget session.
- Scope all reads/writes by token subject.

#### Phase 3: SDK Wrapper

- Build small web loader script.
- Build React provider/hook wrapper.
- Hide iframe creation and postMessage details.
- Support open/close/context/unread/events.
- Add secure postMessage handshake.

#### Phase 4: Agent Embed Security

- Require agent session or signed embedded-agent token for `/embed/inbox`.
- Add per-agent attribution.
- Remove generic `agent` sender where possible.
- Support owner/lead/agent permissions.

#### Phase 5: Enterprise Hardening

- Webhook signatures and retries.
- Rate limiting.
- Key rotation.
- Private attachments or signed URLs.
- Audit log.
- Observability.
- Better analytics.

### 19. Acceptance Criteria

The new browser integration is acceptable when:

- A logged-out user cannot see or access authenticated chat data.
- A logged-in user can only see their own scoped conversations.
- A publishable key alone cannot list all tenant conversations.
- Agent/admin inbox access requires human/session/signed-agent auth.
- postMessage commands are origin-validated.
- Webhooks are signed.
- Basic rate limits exist.
- Developer docs explain secure install clearly.
- The widget can be installed with a script or React provider without manual iframe resizing.
- The UI works cleanly on desktop and mobile.

### 20. Prompt For Claude Code

Use this section directly as a future Claude Code prompt:

> Read `README.md`, `AGENTS.md`, and this brief. Analyze the current embed, visitor, dashboard, API auth, webhook, and Supabase schema code. Implement Phase 1 and Phase 2 of the authenticated web widget plan with minimal, well-scoped changes. Preserve existing behavior where needed, but separate customer-facing widget authorization from agent/admin inbox authorization. The customer widget must support authenticated-only mode with server-signed user tokens, and customer endpoints must only read/write conversations scoped to the signed user. Update docs and dashboard copy to describe the new integration model. Add focused tests or verification steps for auth scoping, logged-out behavior, and tenant isolation. Follow existing project conventions and the Next.js 16 docs in `node_modules/next/dist/docs/` before editing framework-specific code.

