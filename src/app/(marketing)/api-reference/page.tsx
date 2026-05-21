import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, KeyRound, Radio } from "lucide-react";

import { CodeTabs } from "@/app/_components/CodeTabs";

import { DocsNav, DocsNavMobile, type DocsNavItem } from "./_components/DocsNav";
import {
  EndpointCard,
  MethodPill,
  SubHead,
} from "./_components/EndpointCard";
import { ParamTable } from "./_components/ParamTable";
import { CopyButton } from "./_components/CopyButton";
import {
  AUTH_TABS,
  BASE_URL,
  CONFIG_TABS,
  CONFIG_RESPONSE,
  CONVERSATIONS_CREATE_RESPONSE,
  CONVERSATIONS_CREATE_TABS,
  CONVERSATIONS_LIST_RESPONSE,
  CONVERSATIONS_LIST_TABS,
  MESSAGES_DELETE_TABS,
  MESSAGES_EDIT_TABS,
  MESSAGES_LIST_RESPONSE,
  MESSAGES_LIST_TABS,
  MESSAGES_SEND_RESPONSE,
  MESSAGES_SEND_TABS,
  REALTIME_TABS,
  SAMPLE_KEY,
  TYPING_TABS,
  UPLOAD_RESPONSE,
  UPLOAD_TABS,
  USERS_RESPONSE,
  USERS_TABS,
} from "./_components/snippets";

export const metadata: Metadata = {
  title: "API reference — ChatKit",
  description:
    "REST API for sending messages, managing conversations, and uploading attachments.",
};

const NAV_ITEMS: DocsNavItem[] = [
  { id: "auth", label: "Authentication" },
  { id: "config", label: "Config" },
  { id: "users", label: "Users" },
  { id: "conversations-list", label: "List conversations" },
  { id: "conversations-create", label: "Create conversation", group: "conv" },
  { id: "messages-list", label: "List messages", group: "conv" },
  { id: "messages-send", label: "Send message", group: "conv" },
  { id: "messages-edit", label: "Edit message", group: "conv" },
  { id: "messages-delete", label: "Delete message", group: "conv" },
  { id: "typing", label: "Typing" },
  { id: "upload", label: "Upload" },
  { id: "realtime", label: "Realtime" },
  { id: "errors", label: "Errors" },
];

const ERRORS: { status: number; body: string; cause: string }[] = [
  { status: 400, body: `{ "error": "invalid json" }`, cause: "Body wasn't parseable JSON." },
  {
    status: 400,
    body: `{ "error": "<field> is required" }`,
    cause: "Missing a required field — see each endpoint's request schema.",
  },
  {
    status: 401,
    body: `{ "error": "missing x-chatkit-api-key header" }`,
    cause: "No auth header sent.",
  },
  {
    status: 401,
    body: `{ "error": "invalid api key" }`,
    cause: "Key not found, malformed, or wrong format.",
  },
  {
    status: 403,
    body: `{ "error": "tenant is overage|suspended" }`,
    cause: "Tenant is past its plan limit or has been suspended.",
  },
  {
    status: 404,
    body: `{ "error": "conversation not found" }`,
    cause: "Wrong id, or the conversation belongs to a different tenant.",
  },
  {
    status: 413,
    body: `{ "error": "file too large (>10 MB)" }`,
    cause: "Upload exceeded the 10 MB ceiling.",
  },
  {
    status: 415,
    body: `{ "error": "unsupported mime: …" }`,
    cause: "Upload wasn't one of the allowed image types.",
  },
  {
    status: 500,
    body: `{ "error": "<db message>" }`,
    cause: "Supabase or storage failure — usually transient.",
  },
];

export default function ApiReferencePage() {
  return (
    <>
      {/* ─── Hero band: mist + dotted, page heading ─── */}
      <section className="relative bg-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-dotted-mist [mask-image:radial-gradient(ellipse_60%_70%_at_center,_black_0%,_transparent_85%)] [-webkit-mask-image:radial-gradient(ellipse_60%_70%_at_center,_black_0%,_transparent_85%)]"
        />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-28 sm:pt-32 pb-12 sm:pb-16">
          <div className="max-w-3xl">
            <p className="text-[14px] font-medium text-deep/60">API reference</p>
            <h1 className="mt-4 text-4xl sm:text-6xl tracking-tight text-ink leading-[1] font-normal">
              The ChatKit{" "}
              <span className="font-serif-italic text-deep">
                REST surface<span className="text-deep/40">.</span>
              </span>
            </h1>
            <p className="mt-5 text-deep/70 leading-relaxed text-[16px]">
              Every endpoint you need to send messages, manage conversations,
              and upload attachments from any server or client. Calls are
              authenticated with a single header. All requests share the same
              base URL as your dashboard.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <code className="inline-flex items-center gap-2 rounded-lg border border-deep/15 bg-white/90 px-3 py-1.5 font-mono text-xs text-deep shadow-sm">
                <span className="text-deep/40">base</span>
                {BASE_URL}
              </code>
              <span className="text-deep/50 text-[13px]">
                or your dashboard host
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Two-column body: sticky nav + endpoint cards ─── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
        <div className="grid lg:grid-cols-[220px_1fr] gap-10">
          <aside className="hidden lg:block">
            <DocsNav items={NAV_ITEMS} />
          </aside>

          <div className="space-y-12">
            <DocsNavMobile items={NAV_ITEMS} />

            {/* ─── Authentication ─── */}
            <section
              id="auth"
              className="scroll-mt-24 rounded-[2rem] border border-mist bg-white p-6 md:p-8 shadow-sm"
            >
              <header className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-deep/60">
                  <KeyRound className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-[0.18em] text-zinc-600">
                    Authentication
                  </span>
                </div>
                <h2 className="text-3xl sm:text-4xl tracking-tight text-ink leading-tight font-normal">
                  One header,{" "}
                  <span className="font-serif-italic text-deep">
                    every call<span className="text-deep/40">.</span>
                  </span>
                </h2>
                <p className="text-deep/70 leading-relaxed text-[15px]">
                  Send your tenant&apos;s publishable key in the{" "}
                  <code className="font-mono text-[13px] text-ink bg-mist/60 px-1.5 py-0.5 rounded">
                    x-chatkit-api-key
                  </code>{" "}
                  header on every request. Keys start with{" "}
                  <code className="font-mono text-[13px] text-ink bg-mist/60 px-1.5 py-0.5 rounded">
                    pk_live_
                  </code>{" "}
                  or{" "}
                  <code className="font-mono text-[13px] text-ink bg-mist/60 px-1.5 py-0.5 rounded">
                    pk_test_
                  </code>
                  . Real keys are issued in your dashboard — never check them
                  into source control.
                </p>
              </header>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-mist bg-mist/30 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-600">
                    Example key
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <code className="font-mono text-[13px] text-ink break-all">
                      pk_live_xxxx••••••••xxxx
                    </code>
                    <CopyButton value={SAMPLE_KEY} label="Copy template" />
                  </div>
                  <p className="mt-3 text-[13px] text-deep/70 leading-relaxed">
                    Issue a real key in the{" "}
                    <Link
                      href="/dashboard/api-keys"
                      className="text-deep font-medium hover:text-ink underline underline-offset-2 decoration-deep/30"
                    >
                      dashboard
                    </Link>
                    .
                  </p>
                </div>

                <div className="rounded-2xl border border-mist bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-600">
                    CORS
                  </p>
                  <ul className="mt-3 space-y-1.5 text-[13px] text-deep/80 leading-relaxed">
                    <li>
                      <span className="text-deep/50">Origin:</span> any (
                      <code className="font-mono">*</code>)
                    </li>
                    <li>
                      <span className="text-deep/50">Methods:</span>{" "}
                      <code className="font-mono">
                        GET, POST, PATCH, DELETE, OPTIONS
                      </code>
                    </li>
                    <li>
                      <span className="text-deep/50">Headers:</span>{" "}
                      <code className="font-mono">
                        content-type, x-chatkit-api-key
                      </code>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-6">
                <SubHead>Example request</SubHead>
                <div className="mt-3">
                  <CodeTabs tabs={AUTH_TABS} />
                </div>
              </div>
            </section>

            {/* ─── GET /v1/config ─── */}
            <EndpointCard
              id="config"
              method="GET"
              path="/api/v1/config"
              title="Bootstrap SDK config"
              description="Fetch the public realtime credentials and the tenant's metadata. The SDK calls this once on launch and caches the result for the session."
            >
              <ParamTable
                title="Headers"
                rows={[
                  {
                    name: "x-chatkit-api-key",
                    type: "string",
                    required: true,
                    description: "Your tenant key (pk_live_… or pk_test_…).",
                  },
                ]}
              />
              <div>
                <SubHead>Response</SubHead>
                <p className="mt-2 text-[14px] text-deep/70 leading-relaxed">
                  Returns the tenant identity and the Supabase Realtime
                  endpoint used for live subscriptions. The{" "}
                  <code className="font-mono text-[13px] bg-mist/60 px-1.5 py-0.5 rounded">
                    channel_prefix
                  </code>{" "}
                  is what the SDK joins to{" "}
                  <code className="font-mono text-[13px] bg-mist/60 px-1.5 py-0.5 rounded">
                    {`<id>`}
                  </code>{" "}
                  to form a channel name.
                </p>
                <div className="mt-3">
                  <CodeTabs tabs={CONFIG_RESPONSE} />
                </div>
              </div>
              <div>
                <SubHead>Example</SubHead>
                <div className="mt-3">
                  <CodeTabs tabs={CONFIG_TABS} />
                </div>
              </div>
            </EndpointCard>

            {/* ─── POST /v1/users ─── */}
            <EndpointCard
              id="users"
              method="POST"
              path="/api/v1/users"
              title="Upsert an end-user"
              description="Identify the user the SDK is acting on behalf of. Call once per session, or whenever identity changes. Idempotent on (tenant_id, user_id)."
            >
              <ParamTable
                title="Body"
                rows={[
                  {
                    name: "user_id",
                    type: "string",
                    required: true,
                    description:
                      "Opaque, stable identifier from your system. Used to key all conversation membership.",
                  },
                  {
                    name: "name",
                    type: "string",
                    description: (
                      <>
                        Display name. <strong>Empty strings are ignored</strong>{" "}
                        — re-upserting an anonymous user will not blank out a
                        previously stored name. Pass a real value or omit it.
                      </>
                    ),
                  },
                  {
                    name: "email",
                    type: "string",
                    description:
                      "Email address. Same empty-string rule as name.",
                  },
                  {
                    name: "role",
                    type: '"customer" | "driver" | "admin" | "support"',
                    description:
                      "Defaults to 'customer'. Affects how the inbox routes and labels the user.",
                  },
                  {
                    name: "fcm_tokens",
                    type: "string[]",
                    description: "Push tokens for fan-out to FCM/APNs.",
                  },
                  {
                    name: "notification_prefs",
                    type: "object",
                    description: "Opaque blob; the SDK reads/writes it.",
                  },
                ]}
              />
              <div>
                <SubHead>Response</SubHead>
                <div className="mt-3">
                  <CodeTabs tabs={USERS_RESPONSE} />
                </div>
              </div>
              <div>
                <SubHead>Example</SubHead>
                <div className="mt-3">
                  <CodeTabs tabs={USERS_TABS} />
                </div>
              </div>
            </EndpointCard>

            {/* ─── GET /v1/conversations ─── */}
            <EndpointCard
              id="conversations-list"
              method="GET"
              path="/api/v1/conversations"
              title="List a user's conversations"
              description="Returns up to 100 conversations the user participates in, sorted by last activity descending."
            >
              <ParamTable
                title="Query parameters"
                rows={[
                  {
                    name: "user_id",
                    type: "string",
                    required: true,
                    description:
                      "The user whose conversations you want. Same opaque id you used with POST /v1/users.",
                  },
                  {
                    name: "kind",
                    type: '"order" | "support" | "direct"',
                    description:
                      "Filter to a single kind. Omit to get every kind.",
                  },
                ]}
              />
              <div>
                <SubHead>Response</SubHead>
                <div className="mt-3">
                  <CodeTabs tabs={CONVERSATIONS_LIST_RESPONSE} />
                </div>
              </div>
              <div>
                <SubHead>Example</SubHead>
                <div className="mt-3">
                  <CodeTabs tabs={CONVERSATIONS_LIST_TABS} />
                </div>
              </div>
            </EndpointCard>

            {/* ─── POST /v1/conversations ─── */}
            <EndpointCard
              id="conversations-create"
              method="POST"
              path="/api/v1/conversations"
              title="Create (or fetch) a conversation"
              description="Get-or-create. Idempotent on (tenant_id, kind, external_ref) — re-calling with the same external_ref returns the existing row instead of creating a duplicate or overwriting participants."
            >
              <div className="rounded-2xl border border-deep/20 bg-deep/[0.04] p-4 text-[14px] text-deep/80 leading-relaxed">
                <strong className="text-ink">Gotcha:</strong> if you call this
                for the same{" "}
                <code className="font-mono text-[13px] bg-white px-1.5 py-0.5 rounded border border-mist">
                  external_ref
                </code>{" "}
                twice with different participants, the second call returns the
                original row — it does <em>not</em> update participants. Manage
                membership via your own backend if you need to add agents.
              </div>
              <ParamTable
                title="Body"
                rows={[
                  {
                    name: "kind",
                    type: '"order" | "support" | "direct"',
                    required: true,
                    description: "Which inbox bucket the conversation lives in.",
                  },
                  {
                    name: "external_ref",
                    type: "string",
                    description:
                      "Your system's id (e.g. order id). Required for stable idempotency on order/support threads.",
                  },
                  {
                    name: "participants",
                    type: "string[]",
                    required: true,
                    description:
                      "Non-empty array of user_ids — at minimum the customer and the agent/driver.",
                  },
                ]}
              />
              <div>
                <SubHead>Response</SubHead>
                <div className="mt-3">
                  <CodeTabs tabs={CONVERSATIONS_CREATE_RESPONSE} />
                </div>
              </div>
              <div>
                <SubHead>Example</SubHead>
                <div className="mt-3">
                  <CodeTabs tabs={CONVERSATIONS_CREATE_TABS} />
                </div>
              </div>
            </EndpointCard>

            {/* ─── GET /v1/conversations/:id/messages ─── */}
            <EndpointCard
              id="messages-list"
              method="GET"
              path="/api/v1/conversations/:id/messages"
              title="Paginated message history"
              description="Returns messages oldest-first in the array. Pass a cursor from the oldest message you already have to load the next page."
            >
              <ParamTable
                title="Query parameters"
                rows={[
                  {
                    name: "before",
                    type: "string (ISO-8601)",
                    description:
                      "Return messages with created_at strictly less than this. Use the oldest message's created_at to paginate backwards.",
                  },
                  {
                    name: "limit",
                    type: "number",
                    description: "Default 50, max 200.",
                  },
                ]}
              />
              <div>
                <SubHead>Response</SubHead>
                <div className="mt-3">
                  <CodeTabs tabs={MESSAGES_LIST_RESPONSE} />
                </div>
              </div>
              <div>
                <SubHead>Example</SubHead>
                <div className="mt-3">
                  <CodeTabs tabs={MESSAGES_LIST_TABS} />
                </div>
              </div>
            </EndpointCard>

            {/* ─── POST /v1/conversations/:id/messages ─── */}
            <EndpointCard
              id="messages-send"
              method="POST"
              path="/api/v1/conversations/:id/messages"
              title="Send a message"
              description="Inserts the message, broadcasts it on the Supabase Realtime channel conv:<id>, and fires the tenant's outbound webhook fire-and-forget."
            >
              <ParamTable
                title="Body"
                rows={[
                  {
                    name: "sender_id",
                    type: "string",
                    required: true,
                    description: "The user_id sending the message.",
                  },
                  {
                    name: "body",
                    type: "string",
                    description:
                      "Required when message_type is 'text'. Plain text — the SDK handles linkification.",
                  },
                  {
                    name: "message_type",
                    type: '"text" | "image"',
                    description: "Defaults to 'text'.",
                  },
                  {
                    name: "media_url",
                    type: "string",
                    description:
                      "Required for non-text messages. Use the URL returned by POST /upload.",
                  },
                  {
                    name: "reply_to",
                    type: "string (message id)",
                    description:
                      "Threads this message under an earlier one in the same conversation.",
                  },
                  {
                    name: "receiver_id",
                    type: "string",
                    description:
                      "Optional explicit recipient — useful for direct conversations.",
                  },
                ]}
              />
              <div>
                <SubHead>Response</SubHead>
                <div className="mt-3">
                  <CodeTabs tabs={MESSAGES_SEND_RESPONSE} />
                </div>
              </div>
              <div>
                <SubHead>Example</SubHead>
                <div className="mt-3">
                  <CodeTabs tabs={MESSAGES_SEND_TABS} />
                </div>
              </div>
            </EndpointCard>

            {/* ─── PATCH /v1/conversations/:id/messages/:msgId ─── */}
            <EndpointCard
              id="messages-edit"
              method="PATCH"
              path="/api/v1/conversations/:id/messages/:msgId"
              title="Edit a message"
              description="Updates body and sets edited_at. Only the original sender (matched on sender_id) may edit. The edit is broadcast on the conversation channel so other clients update in place."
            >
              <ParamTable
                title="Body"
                rows={[
                  {
                    name: "sender_id",
                    type: "string",
                    required: true,
                    description:
                      "Must match the original sender_id or the request 403s.",
                  },
                  {
                    name: "body",
                    type: "string",
                    required: true,
                    description: "New text. Cannot be empty.",
                  },
                ]}
              />
              <div>
                <SubHead>Example</SubHead>
                <div className="mt-3">
                  <CodeTabs tabs={MESSAGES_EDIT_TABS} />
                </div>
              </div>
            </EndpointCard>

            {/* ─── DELETE /v1/conversations/:id/messages/:msgId ─── */}
            <EndpointCard
              id="messages-delete"
              method="DELETE"
              path="/api/v1/conversations/:id/messages/:msgId"
              title="Soft-delete a message"
              description="Sets deleted_at; the message is hidden from history but is retained for moderation. Only the original sender may delete."
            >
              <ParamTable
                title="Body"
                rows={[
                  {
                    name: "sender_id",
                    type: "string",
                    required: true,
                    description:
                      "Must match the original sender_id or the request 403s.",
                  },
                ]}
              />
              <div>
                <SubHead>Example</SubHead>
                <div className="mt-3">
                  <CodeTabs tabs={MESSAGES_DELETE_TABS} />
                </div>
              </div>
            </EndpointCard>

            {/* ─── POST /v1/conversations/:id/typing ─── */}
            <EndpointCard
              id="typing"
              method="POST"
              path="/api/v1/conversations/:id/typing"
              title="Typing indicator"
              description="Fire-and-forget. Broadcasts a typing event on the conversation channel; the receiver clears the indicator ~3 s after the last event. Throttle to at most one event every 2–3 seconds on the client."
            >
              <ParamTable
                title="Body"
                rows={[
                  {
                    name: "sender_id",
                    type: "string",
                    required: true,
                    description: "Who's typing.",
                  },
                  {
                    name: "sender_name",
                    type: "string",
                    description:
                      "Display name shown in the indicator (\"Ada is typing…\"). Optional.",
                  },
                ]}
              />
              <div>
                <SubHead>Example</SubHead>
                <div className="mt-3">
                  <CodeTabs tabs={TYPING_TABS} />
                </div>
              </div>
            </EndpointCard>

            {/* ─── POST /v1/conversations/:id/upload ─── */}
            <EndpointCard
              id="upload"
              method="POST"
              path="/api/v1/conversations/:id/upload"
              title="Upload an image attachment"
              description="Multipart upload to Supabase Storage. Returns a public URL that you then attach to a message via media_url + message_type: 'image'."
            >
              <ParamTable
                title="Form data"
                rows={[
                  {
                    name: "file",
                    type: "binary",
                    required: true,
                    description: (
                      <>
                        Max <strong>10 MB</strong>. Allowed MIME types:{" "}
                        <code className="font-mono text-[12px] bg-mist/60 px-1 py-0.5 rounded">
                          image/jpeg
                        </code>
                        ,{" "}
                        <code className="font-mono text-[12px] bg-mist/60 px-1 py-0.5 rounded">
                          image/png
                        </code>
                        ,{" "}
                        <code className="font-mono text-[12px] bg-mist/60 px-1 py-0.5 rounded">
                          image/gif
                        </code>
                        ,{" "}
                        <code className="font-mono text-[12px] bg-mist/60 px-1 py-0.5 rounded">
                          image/webp
                        </code>
                        ,{" "}
                        <code className="font-mono text-[12px] bg-mist/60 px-1 py-0.5 rounded">
                          image/heic
                        </code>
                        .
                      </>
                    ),
                  },
                ]}
              />
              <div>
                <SubHead>Response</SubHead>
                <div className="mt-3">
                  <CodeTabs tabs={UPLOAD_RESPONSE} />
                </div>
              </div>
              <div>
                <SubHead>Example</SubHead>
                <div className="mt-3">
                  <CodeTabs tabs={UPLOAD_TABS} />
                </div>
              </div>
            </EndpointCard>

            {/* ─── Realtime ─── */}
            <section
              id="realtime"
              className="scroll-mt-24 rounded-[2rem] border border-mist bg-white p-6 md:p-8 shadow-sm"
            >
              <header className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-deep/60">
                  <Radio className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-[0.18em] text-zinc-600">
                    Realtime
                  </span>
                </div>
                <h2 className="text-3xl sm:text-4xl tracking-tight text-ink leading-tight font-normal">
                  Live message{" "}
                  <span className="font-serif-italic text-deep">
                    delivery<span className="text-deep/40">.</span>
                  </span>
                </h2>
                <p className="text-deep/70 leading-relaxed text-[15px]">
                  Each conversation has its own Supabase Realtime channel named{" "}
                  <code className="font-mono text-[13px] text-ink bg-mist/60 px-1.5 py-0.5 rounded">
                    conv:&lt;conversation_id&gt;
                  </code>
                  . When a new message is sent, edited, or deleted, the server
                  broadcasts a payload on that channel; typing indicators ride
                  the same channel under a separate event name.
                </p>
              </header>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-mist bg-mist/30 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-600">
                    Events
                  </p>
                  <ul className="mt-3 space-y-2 text-[14px] text-deep/80 leading-relaxed">
                    <li>
                      <code className="font-mono text-[13px] text-ink">
                        message
                      </code>{" "}
                      — new, edited, or soft-deleted message.
                    </li>
                    <li>
                      <code className="font-mono text-[13px] text-ink">
                        typing
                      </code>{" "}
                      — sender id + name, fires per keystroke window.
                    </li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-mist bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-600">
                    Channel name
                  </p>
                  <code className="mt-3 block font-mono text-[14px] text-ink break-all">
                    {`${"conv:"}${"<conversation_id>"}`}
                  </code>
                  <p className="mt-3 text-[13px] text-deep/70 leading-relaxed">
                    Prefix is returned as{" "}
                    <code className="font-mono text-[12px] bg-mist/60 px-1 py-0.5 rounded">
                      channel_prefix
                    </code>{" "}
                    by <a href="#config" className="text-deep underline underline-offset-2 decoration-deep/30">GET /v1/config</a>.
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <SubHead>Subscribe (browser / Node)</SubHead>
                <div className="mt-3">
                  <CodeTabs tabs={REALTIME_TABS} />
                </div>
              </div>
            </section>

            {/* ─── Errors ─── */}
            <section
              id="errors"
              className="scroll-mt-24 rounded-[2rem] border border-mist bg-white p-6 md:p-8 shadow-sm"
            >
              <header>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-600">
                  Errors
                </p>
                <h2 className="mt-3 text-3xl sm:text-4xl tracking-tight text-ink leading-tight font-normal">
                  Predictable{" "}
                  <span className="font-serif-italic text-deep">
                    failure modes<span className="text-deep/40">.</span>
                  </span>
                </h2>
                <p className="mt-3 text-deep/70 leading-relaxed text-[15px]">
                  Errors are always JSON with a single{" "}
                  <code className="font-mono text-[13px] bg-mist/60 px-1.5 py-0.5 rounded">
                    error
                  </code>{" "}
                  string. Treat the status code as authoritative; the message
                  body is for humans.
                </p>
              </header>

              <div className="mt-6 overflow-hidden rounded-2xl border border-mist">
                <table className="w-full text-left text-[14px]">
                  <thead className="bg-mist/40 text-deep/70">
                    <tr>
                      <th className="px-4 py-3 font-medium text-[12px] uppercase tracking-[0.16em] w-[80px]">
                        Status
                      </th>
                      <th className="px-4 py-3 font-medium text-[12px] uppercase tracking-[0.16em]">
                        Body
                      </th>
                      <th className="px-4 py-3 font-medium text-[12px] uppercase tracking-[0.16em] hidden md:table-cell">
                        Cause
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ERRORS.map((err, idx) => (
                      <tr
                        key={`${err.status}-${idx}`}
                        className="align-top border-t border-mist"
                      >
                        <td className="px-4 py-3">
                          <code className="font-mono text-[13px] text-ink">
                            {err.status}
                          </code>
                        </td>
                        <td className="px-4 py-3">
                          <code className="font-mono text-[12px] text-deep/80 break-all">
                            {err.body}
                          </code>
                          <p className="mt-1 text-[13px] text-deep/70 md:hidden">
                            {err.cause}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-deep/70 hidden md:table-cell">
                          {err.cause}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ─── Next steps strip ─── */}
            <div className="rounded-[2rem] bg-mist p-2 shadow-sm">
              <div className="rounded-[1.6rem] bg-white p-6 md:p-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-600">
                      Next
                    </p>
                    <p className="mt-2 text-[16px] text-ink">
                      Prefer drop-in widgets to wiring fetch calls?
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href="/sdk"
                      className="inline-flex items-center gap-2 rounded-full bg-ink text-white pl-5 pr-2 py-2 text-[15px] shadow-lg shadow-ink/10 hover:bg-deep transition-colors group"
                    >
                      Read the SDK guide
                      <span className="grid place-items-center h-7 w-7 rounded-full bg-white text-ink transition-transform group-hover:translate-x-0.5">
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </Link>
                    <Link
                      href="/dashboard/api-keys"
                      className="inline-flex items-center gap-2 rounded-full bg-white border border-zinc-200/80 px-5 py-2.5 text-[15px] text-ink shadow-sm hover:bg-mist/40 transition-colors"
                    >
                      Get an API key
                    </Link>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px] text-deep/60">
                  <MethodPill method="GET" />
                  <MethodPill method="POST" />
                  <MethodPill method="PATCH" />
                  <MethodPill method="DELETE" />
                  <span>— every method this API uses.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

    </>
  );
}
