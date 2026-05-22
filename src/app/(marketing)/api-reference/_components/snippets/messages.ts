import { BASE_URL, SAMPLE_KEY, tabs } from "./_shared";

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
