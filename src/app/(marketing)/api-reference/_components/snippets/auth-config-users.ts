import { BASE_URL, SAMPLE_KEY, tabs } from "./_shared";

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
