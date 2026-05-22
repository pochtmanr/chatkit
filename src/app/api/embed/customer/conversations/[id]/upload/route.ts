import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { getServiceClient } from "@/lib/supabase/server";
import { authCustomer, assertCustomerOwnsConversation } from "@/lib/customer-auth";

/**
 * POST /api/embed/customer/conversations/:id/upload
 *
 * Accepts a multipart/form-data body with a single `file` field,
 * uploads it to the `chat` bucket, and returns the public URL the
 * caller passes as `media_url` on the follow-up reply. Capped at 10MB
 * to keep the proxy light.
 */

const BUCKET = "chat";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authCustomer(request);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const { id: conversationId } = await params;
  const ownership = await assertCustomerOwnsConversation(session, conversationId);
  if (!ownership.ok) return ownership.response;
  const conv = ownership.conversation;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "multipart/form-data required" },
      { status: 400 },
    );
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file field required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `file too large (>${MAX_BYTES / 1024 / 1024} MB)` },
      { status: 413 },
    );
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: `unsupported mime: ${file.type}` },
      { status: 415 },
    );
  }

  const ext = (() => {
    const m = /\.([a-z0-9]+)$/i.exec(file.name);
    if (m) return m[1].toLowerCase();
    return (file.type.split("/")[1] || "bin").toLowerCase();
  })();
  const path = `${conv.tenant_id}/${conversationId}/${randomUUID()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const service = getServiceClient();
  const { error: upErr } = await service.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (upErr) {
    return NextResponse.json(
      { error: `upload failed: ${upErr.message}` },
      { status: 500 },
    );
  }

  const { data: pub } = service.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: pub.publicUrl, path });
}
