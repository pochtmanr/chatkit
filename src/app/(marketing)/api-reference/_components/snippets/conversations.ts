import { BASE_URL, SAMPLE_KEY, tabs } from "./_shared";

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
