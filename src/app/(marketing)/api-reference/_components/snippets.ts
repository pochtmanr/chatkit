import { highlight, type SupportedLang } from "@/app/_components/highlight";
import type { CodeTab } from "@/app/_components/CodeTabs";

const BASE_URL = "https://api.chatkit.cc";
const SAMPLE_KEY = "pk_live_REPLACE_ME";

export { BASE_URL, SAMPLE_KEY };

/** Pre-highlight at module load — every page render reuses the cached
 *  HTML, avoiding a string-walk per request. */
export function tabs(
  entries: { label: string; lang: SupportedLang; code: string }[],
): CodeTab[] {
  return entries.map((t) => ({ ...t, html: highlight(t.code, t.lang) }));
}

// ─── Authentication ────────────────────────────────────────────────────

export const AUTH_TABS = tabs([
  {
    label: "curl",
    lang: "bash",
    code: `curl ${BASE_URL}/v1/config \\
  -H "x-chatkit-api-key: ${SAMPLE_KEY}"`,
  },
  {
    label: "TypeScript",
    lang: "tsx",
    code: `const res = await fetch("${BASE_URL}/v1/config", {
  headers: { "x-chatkit-api-key": process.env.CHATKIT_KEY! },
});
const { tenant, realtime } = await res.json();`,
  },
]);

// ─── GET /v1/config ────────────────────────────────────────────────────

export const CONFIG_TABS = tabs([
  {
    label: "curl",
    lang: "bash",
    code: `curl ${BASE_URL}/v1/config \\
  -H "x-chatkit-api-key: ${SAMPLE_KEY}"`,
  },
  {
    label: "TypeScript",
    lang: "tsx",
    code: `const res = await fetch("${BASE_URL}/v1/config", {
  headers: { "x-chatkit-api-key": apiKey },
});
const config = await res.json();
// { tenant: { id, name }, realtime: { supabase_url, supabase_anon_key, channel_prefix } }`,
  },
]);

export const CONFIG_RESPONSE = tabs([
  {
    label: "200 OK",
    lang: "json",
    code: `{
  "tenant": {
    "id": "11111111-2222-3333-4444-555555555555",
    "name": "Acme Logistics"
  },
  "realtime": {
    "supabase_url": "https://xxxx.supabase.co",
    "supabase_anon_key": "eyJhbGciOiJ…",
    "channel_prefix": "conv:"
  }
}`,
  },
]);

// ─── POST /v1/users ────────────────────────────────────────────────────

export const USERS_TABS = tabs([
  {
    label: "curl",
    lang: "bash",
    code: `curl -X POST ${BASE_URL}/v1/users \\
  -H "x-chatkit-api-key: ${SAMPLE_KEY}" \\
  -H "content-type: application/json" \\
  -d '{
    "user_id": "u_42",
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "role": "customer"
  }'`,
  },
  {
    label: "TypeScript",
    lang: "tsx",
    code: `await fetch("${BASE_URL}/v1/users", {
  method: "POST",
  headers: {
    "x-chatkit-api-key": apiKey,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    user_id: "u_42",
    name: "Ada Lovelace",
    email: "ada@example.com",
    role: "customer",
  }),
});`,
  },
  {
    label: "Swift",
    lang: "swift",
    code: `struct UpsertUser: Encodable {
  let user_id: String
  let name: String?
  let email: String?
  let role: String?
}

var req = URLRequest(url: URL(string: "${BASE_URL}/v1/users")!)
req.httpMethod = "POST"
req.setValue(apiKey, forHTTPHeaderField: "x-chatkit-api-key")
req.setValue("application/json", forHTTPHeaderField: "content-type")
req.httpBody = try JSONEncoder().encode(
  UpsertUser(user_id: "u_42", name: "Ada", email: nil, role: "customer")
)
let (data, _) = try await URLSession.shared.data(for: req)`,
  },
  {
    label: "Kotlin",
    lang: "kotlin",
    code: `val body = """
  { "user_id": "u_42", "name": "Ada", "role": "customer" }
""".trimIndent()

val req = Request.Builder()
  .url("${BASE_URL}/v1/users")
  .addHeader("x-chatkit-api-key", apiKey)
  .addHeader("content-type", "application/json")
  .post(body.toRequestBody("application/json".toMediaType()))
  .build()

val res = client.newCall(req).execute()`,
  },
]);

export const USERS_RESPONSE = tabs([
  {
    label: "200 OK",
    lang: "json",
    code: `{
  "user": {
    "id": "9d2a…",
    "tenant_id": "1111…",
    "user_id": "u_42",
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "role": "customer",
    "fcm_tokens": [],
    "notification_prefs": {},
    "last_seen_at": "2026-01-15T10:21:09.114Z"
  }
}`,
  },
]);

// ─── GET /v1/conversations ─────────────────────────────────────────────

export const CONVERSATIONS_LIST_TABS = tabs([
  {
    label: "curl",
    lang: "bash",
    code: `curl "${BASE_URL}/v1/conversations?user_id=u_42&kind=support" \\
  -H "x-chatkit-api-key: ${SAMPLE_KEY}"`,
  },
  {
    label: "TypeScript",
    lang: "tsx",
    code: `const q = new URLSearchParams({ user_id: "u_42", kind: "support" });
const res = await fetch(\`${BASE_URL}/v1/conversations?\${q}\`, {
  headers: { "x-chatkit-api-key": apiKey },
});
const { conversations } = await res.json();`,
  },
  {
    label: "Swift",
    lang: "swift",
    code: `let url = URL(string: "${BASE_URL}/v1/conversations?user_id=u_42&kind=support")!
var req = URLRequest(url: url)
req.setValue(apiKey, forHTTPHeaderField: "x-chatkit-api-key")
let (data, _) = try await URLSession.shared.data(for: req)`,
  },
  {
    label: "Kotlin",
    lang: "kotlin",
    code: `val req = Request.Builder()
  .url("${BASE_URL}/v1/conversations?user_id=u_42&kind=support")
  .addHeader("x-chatkit-api-key", apiKey)
  .get()
  .build()
val res = client.newCall(req).execute()`,
  },
]);

export const CONVERSATIONS_LIST_RESPONSE = tabs([
  {
    label: "200 OK",
    lang: "json",
    code: `{
  "conversations": [
    {
      "id": "c_abc",
      "tenant_id": "1111…",
      "kind": "support",
      "external_ref": null,
      "participants": ["u_42", "agent_7"],
      "last_message": "Thanks, all sorted",
      "last_at": "2026-01-15T10:21:09.114Z"
    }
  ]
}`,
  },
]);

// ─── POST /v1/conversations ────────────────────────────────────────────

export const CONVERSATIONS_CREATE_TABS = tabs([
  {
    label: "curl",
    lang: "bash",
    code: `curl -X POST ${BASE_URL}/v1/conversations \\
  -H "x-chatkit-api-key: ${SAMPLE_KEY}" \\
  -H "content-type: application/json" \\
  -d '{
    "kind": "order",
    "external_ref": "order_9001",
    "participants": ["u_42", "driver_3"]
  }'`,
  },
  {
    label: "TypeScript",
    lang: "tsx",
    code: `const res = await fetch("${BASE_URL}/v1/conversations", {
  method: "POST",
  headers: {
    "x-chatkit-api-key": apiKey,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    kind: "order",
    external_ref: "order_9001",
    participants: ["u_42", "driver_3"],
  }),
});
const { conversation } = await res.json();`,
  },
  {
    label: "Swift",
    lang: "swift",
    code: `struct CreateConv: Encodable {
  let kind: String
  let external_ref: String?
  let participants: [String]
}

var req = URLRequest(url: URL(string: "${BASE_URL}/v1/conversations")!)
req.httpMethod = "POST"
req.setValue(apiKey, forHTTPHeaderField: "x-chatkit-api-key")
req.setValue("application/json", forHTTPHeaderField: "content-type")
req.httpBody = try JSONEncoder().encode(
  CreateConv(kind: "order", external_ref: "order_9001",
             participants: ["u_42", "driver_3"])
)`,
  },
  {
    label: "Kotlin",
    lang: "kotlin",
    code: `val body = """
  {
    "kind": "order",
    "external_ref": "order_9001",
    "participants": ["u_42", "driver_3"]
  }
""".trimIndent()

val req = Request.Builder()
  .url("${BASE_URL}/v1/conversations")
  .addHeader("x-chatkit-api-key", apiKey)
  .addHeader("content-type", "application/json")
  .post(body.toRequestBody("application/json".toMediaType()))
  .build()`,
  },
]);

export const CONVERSATIONS_CREATE_RESPONSE = tabs([
  {
    label: "200 OK",
    lang: "json",
    code: `{
  "conversation": {
    "id": "c_abc",
    "tenant_id": "1111…",
    "kind": "order",
    "external_ref": "order_9001",
    "participants": ["u_42", "driver_3"],
    "last_at": null
  }
}`,
  },
]);

// ─── GET /v1/conversations/:id/messages ────────────────────────────────

export const MESSAGES_LIST_TABS = tabs([
  {
    label: "curl",
    lang: "bash",
    code: `curl "${BASE_URL}/v1/conversations/c_abc/messages?limit=50" \\
  -H "x-chatkit-api-key: ${SAMPLE_KEY}"`,
  },
  {
    label: "TypeScript",
    lang: "tsx",
    code: `const res = await fetch(
  \`${BASE_URL}/v1/conversations/\${id}/messages?limit=50\`,
  { headers: { "x-chatkit-api-key": apiKey } },
);
const { messages } = await res.json();  // oldest first`,
  },
  {
    label: "Swift",
    lang: "swift",
    code: `let url = URL(string: "${BASE_URL}/v1/conversations/\\(id)/messages?limit=50")!
var req = URLRequest(url: url)
req.setValue(apiKey, forHTTPHeaderField: "x-chatkit-api-key")
let (data, _) = try await URLSession.shared.data(for: req)`,
  },
  {
    label: "Kotlin",
    lang: "kotlin",
    code: `val req = Request.Builder()
  .url("${BASE_URL}/v1/conversations/$id/messages?limit=50")
  .addHeader("x-chatkit-api-key", apiKey)
  .get()
  .build()`,
  },
]);

export const MESSAGES_LIST_RESPONSE = tabs([
  {
    label: "200 OK",
    lang: "json",
    code: `{
  "messages": [
    {
      "id": "m_1",
      "conversation_id": "c_abc",
      "sender_id": "u_42",
      "body": "Hi, where's my order?",
      "message_type": "text",
      "media_url": null,
      "reply_to": null,
      "created_at": "2026-01-15T10:18:01.412Z",
      "edited_at": null,
      "deleted_at": null
    }
  ]
}`,
  },
]);

// ─── POST /v1/conversations/:id/messages ───────────────────────────────

export const MESSAGES_SEND_TABS = tabs([
  {
    label: "curl",
    lang: "bash",
    code: `curl -X POST ${BASE_URL}/v1/conversations/c_abc/messages \\
  -H "x-chatkit-api-key: ${SAMPLE_KEY}" \\
  -H "content-type: application/json" \\
  -d '{
    "sender_id": "u_42",
    "body": "Hi, where is my order?",
    "message_type": "text"
  }'`,
  },
  {
    label: "TypeScript",
    lang: "tsx",
    code: `const res = await fetch(
  \`${BASE_URL}/v1/conversations/\${id}/messages\`,
  {
    method: "POST",
    headers: {
      "x-chatkit-api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender_id: "u_42",
      body: "Hi, where is my order?",
      message_type: "text",
    }),
  },
);
const { message } = await res.json();`,
  },
  {
    label: "Swift",
    lang: "swift",
    code: `struct SendMessage: Encodable {
  let sender_id: String
  let body: String?
  let message_type: String
  let media_url: String?
}

var req = URLRequest(
  url: URL(string: "${BASE_URL}/v1/conversations/\\(id)/messages")!
)
req.httpMethod = "POST"
req.setValue(apiKey, forHTTPHeaderField: "x-chatkit-api-key")
req.setValue("application/json", forHTTPHeaderField: "content-type")
req.httpBody = try JSONEncoder().encode(
  SendMessage(sender_id: "u_42", body: "Hello",
              message_type: "text", media_url: nil)
)`,
  },
  {
    label: "Kotlin",
    lang: "kotlin",
    code: `val body = """
  { "sender_id": "u_42", "body": "Hello", "message_type": "text" }
""".trimIndent()

val req = Request.Builder()
  .url("${BASE_URL}/v1/conversations/$id/messages")
  .addHeader("x-chatkit-api-key", apiKey)
  .addHeader("content-type", "application/json")
  .post(body.toRequestBody("application/json".toMediaType()))
  .build()`,
  },
]);

export const MESSAGES_SEND_RESPONSE = tabs([
  {
    label: "200 OK",
    lang: "json",
    code: `{
  "message": {
    "id": "m_42",
    "conversation_id": "c_abc",
    "sender_id": "u_42",
    "body": "Hi, where is my order?",
    "message_type": "text",
    "created_at": "2026-01-15T10:21:09.114Z"
  }
}`,
  },
]);

// ─── PATCH /v1/conversations/:id/messages/:msgId ───────────────────────

export const MESSAGES_EDIT_TABS = tabs([
  {
    label: "curl",
    lang: "bash",
    code: `curl -X PATCH ${BASE_URL}/v1/conversations/c_abc/messages/m_42 \\
  -H "x-chatkit-api-key: ${SAMPLE_KEY}" \\
  -H "content-type: application/json" \\
  -d '{ "sender_id": "u_42", "body": "Actually, where IS my order?" }'`,
  },
  {
    label: "TypeScript",
    lang: "tsx",
    code: `await fetch(
  \`${BASE_URL}/v1/conversations/\${convId}/messages/\${msgId}\`,
  {
    method: "PATCH",
    headers: {
      "x-chatkit-api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({ sender_id: "u_42", body: "updated text" }),
  },
);`,
  },
]);

// ─── DELETE /v1/conversations/:id/messages/:msgId ──────────────────────

export const MESSAGES_DELETE_TABS = tabs([
  {
    label: "curl",
    lang: "bash",
    code: `curl -X DELETE ${BASE_URL}/v1/conversations/c_abc/messages/m_42 \\
  -H "x-chatkit-api-key: ${SAMPLE_KEY}" \\
  -H "content-type: application/json" \\
  -d '{ "sender_id": "u_42" }'`,
  },
  {
    label: "TypeScript",
    lang: "tsx",
    code: `await fetch(
  \`${BASE_URL}/v1/conversations/\${convId}/messages/\${msgId}\`,
  {
    method: "DELETE",
    headers: {
      "x-chatkit-api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({ sender_id: "u_42" }),
  },
);`,
  },
]);

// ─── POST /v1/conversations/:id/typing ─────────────────────────────────

export const TYPING_TABS = tabs([
  {
    label: "curl",
    lang: "bash",
    code: `curl -X POST ${BASE_URL}/v1/conversations/c_abc/typing \\
  -H "x-chatkit-api-key: ${SAMPLE_KEY}" \\
  -H "content-type: application/json" \\
  -d '{ "sender_id": "u_42", "sender_name": "Ada" }'`,
  },
  {
    label: "TypeScript",
    lang: "tsx",
    code: `// Throttle to ≤ 1 event / 2-3s
await fetch(\`${BASE_URL}/v1/conversations/\${id}/typing\`, {
  method: "POST",
  headers: {
    "x-chatkit-api-key": apiKey,
    "content-type": "application/json",
  },
  body: JSON.stringify({ sender_id: "u_42", sender_name: "Ada" }),
});`,
  },
  {
    label: "Swift",
    lang: "swift",
    code: `// Throttle to ≤ 1 event / 2-3s
var req = URLRequest(
  url: URL(string: "${BASE_URL}/v1/conversations/\\(id)/typing")!
)
req.httpMethod = "POST"
req.setValue(apiKey, forHTTPHeaderField: "x-chatkit-api-key")
req.setValue("application/json", forHTTPHeaderField: "content-type")
req.httpBody = #"{"sender_id":"u_42","sender_name":"Ada"}"#.data(using: .utf8)
_ = try? await URLSession.shared.data(for: req)`,
  },
  {
    label: "Kotlin",
    lang: "kotlin",
    code: `// Throttle to ≤ 1 event / 2-3s
val body = """{ "sender_id": "u_42", "sender_name": "Ada" }"""
val req = Request.Builder()
  .url("${BASE_URL}/v1/conversations/$id/typing")
  .addHeader("x-chatkit-api-key", apiKey)
  .addHeader("content-type", "application/json")
  .post(body.toRequestBody("application/json".toMediaType()))
  .build()`,
  },
]);

// ─── POST /v1/conversations/:id/upload ─────────────────────────────────

export const UPLOAD_TABS = tabs([
  {
    label: "curl",
    lang: "bash",
    code: `curl -X POST ${BASE_URL}/v1/conversations/c_abc/upload \\
  -H "x-chatkit-api-key: ${SAMPLE_KEY}" \\
  -F "file=@./receipt.png"`,
  },
  {
    label: "TypeScript",
    lang: "tsx",
    code: `const form = new FormData();
form.append("file", fileBlob, "receipt.png");

const up = await fetch(
  \`${BASE_URL}/v1/conversations/\${id}/upload\`,
  {
    method: "POST",
    headers: { "x-chatkit-api-key": apiKey },
    body: form,
  },
);
const { url } = await up.json();

// Then post the message that references it:
await fetch(\`${BASE_URL}/v1/conversations/\${id}/messages\`, {
  method: "POST",
  headers: {
    "x-chatkit-api-key": apiKey,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    sender_id: "u_42",
    message_type: "image",
    media_url: url,
  }),
});`,
  },
  {
    label: "Swift",
    lang: "swift",
    code: `let boundary = UUID().uuidString
var req = URLRequest(
  url: URL(string: "${BASE_URL}/v1/conversations/\\(id)/upload")!
)
req.httpMethod = "POST"
req.setValue(apiKey, forHTTPHeaderField: "x-chatkit-api-key")
req.setValue(
  "multipart/form-data; boundary=\\(boundary)",
  forHTTPHeaderField: "content-type"
)

var body = Data()
body.append("--\\(boundary)\\r\\n".data(using: .utf8)!)
body.append(
  "Content-Disposition: form-data; name=\\"file\\"; filename=\\"img.jpg\\"\\r\\n"
    .data(using: .utf8)!
)
body.append("Content-Type: image/jpeg\\r\\n\\r\\n".data(using: .utf8)!)
body.append(imageData)
body.append("\\r\\n--\\(boundary)--\\r\\n".data(using: .utf8)!)
req.httpBody = body`,
  },
  {
    label: "Kotlin",
    lang: "kotlin",
    code: `val body = MultipartBody.Builder()
  .setType(MultipartBody.FORM)
  .addFormDataPart(
    "file", "img.jpg",
    file.asRequestBody("image/jpeg".toMediaType())
  )
  .build()

val req = Request.Builder()
  .url("${BASE_URL}/v1/conversations/$id/upload")
  .addHeader("x-chatkit-api-key", apiKey)
  .post(body)
  .build()`,
  },
]);

export const UPLOAD_RESPONSE = tabs([
  {
    label: "200 OK",
    lang: "json",
    code: `{
  "url": "https://xxxx.supabase.co/storage/v1/object/public/chat/…/img.jpg",
  "path": "1111…/c_abc/abcd-ef.jpg"
}`,
  },
]);

// ─── Realtime ──────────────────────────────────────────────────────────

export const REALTIME_TABS = tabs([
  {
    label: "TypeScript",
    lang: "tsx",
    code: `import { createClient } from "@supabase/supabase-js";

// 1. Bootstrap: pull realtime creds from /v1/config
const cfg = await fetch("${BASE_URL}/v1/config", {
  headers: { "x-chatkit-api-key": apiKey },
}).then((r) => r.json());

const supabase = createClient(
  cfg.realtime.supabase_url,
  cfg.realtime.supabase_anon_key,
);

// 2. Subscribe to a conversation's channel
const channel = supabase
  .channel(\`\${cfg.realtime.channel_prefix}\${conversationId}\`)
  .on("broadcast", { event: "message" }, ({ payload }) => {
    console.log("new/edited/deleted message:", payload.message);
  })
  .on("broadcast", { event: "typing" }, ({ payload }) => {
    console.log("typing:", payload.senderId);
  })
  .subscribe();

// 3. Tear down when the screen unmounts
// channel.unsubscribe();`,
  },
]);
