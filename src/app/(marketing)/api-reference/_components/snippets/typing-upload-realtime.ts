import { BASE_URL, SAMPLE_KEY, tabs } from "./_shared";

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
