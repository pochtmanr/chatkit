import { CodeTabs } from "@/app/_components/CodeTabs";

import { EndpointCard, SubHead } from "./EndpointCard";
import { ParamTable } from "./ParamTable";
import {
  CONFIG_RESPONSE,
  CONFIG_TABS,
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
  TYPING_TABS,
  UPLOAD_RESPONSE,
  UPLOAD_TABS,
  USERS_RESPONSE,
  USERS_TABS,
} from "./snippets";

export function ConfigEndpoint() {
  return (
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
          Returns the tenant identity and the Supabase Realtime endpoint used
          for live subscriptions. The{" "}
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
  );
}

export function UsersEndpoint() {
  return (
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
                Display name. <strong>Empty strings are ignored</strong> —
                re-upserting an anonymous user will not blank out a previously
                stored name. Pass a real value or omit it.
              </>
            ),
          },
          {
            name: "email",
            type: "string",
            description: "Email address. Same empty-string rule as name.",
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
  );
}

export function ConversationsListEndpoint() {
  return (
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
            description: "Filter to a single kind. Omit to get every kind.",
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
  );
}

export function ConversationsCreateEndpoint() {
  return (
    <EndpointCard
      id="conversations-create"
      method="POST"
      path="/api/v1/conversations"
      title="Create (or fetch) a conversation"
      description="Get-or-create. Idempotent on (tenant_id, kind, external_ref) — re-calling with the same external_ref returns the existing row instead of creating a duplicate or overwriting participants."
    >
      <div className="rounded-2xl border border-deep/20 bg-deep/[0.04] p-4 text-[14px] text-deep/80 leading-relaxed">
        <strong className="text-ink">Gotcha:</strong> if you call this for the
        same{" "}
        <code className="font-mono text-[13px] bg-white px-1.5 py-0.5 rounded border border-mist">
          external_ref
        </code>{" "}
        twice with different participants, the second call returns the original
        row — it does <em>not</em> update participants. Manage membership via
        your own backend if you need to add agents.
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
  );
}

export function MessagesListEndpoint() {
  return (
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
  );
}

export function MessagesSendEndpoint() {
  return (
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
  );
}

export function MessagesEditEndpoint() {
  return (
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
  );
}

export function MessagesDeleteEndpoint() {
  return (
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
  );
}

export function TypingEndpoint() {
  return (
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
  );
}

export function UploadEndpoint() {
  return (
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
  );
}

