import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { getServiceClient } from "@/lib/supabase/server";
import { verifyEmbedKey } from "@/lib/embed-auth";

/**
 * POST /api/embed/conversations/:id/upload
 *
 * Auth: Bearer <tenant api key> + Origin/Referer check.
 *
 * Accepts a `multipart/form-data` body with a single `file` field.
 * Uploads it to the `chat-attachments` Supabase Storage bucket (one
 * file per object id), then returns the public URL for the caller to
 * pass as `media_url` on the subsequent reply.
 *
 * Caps file size at 10MB to keep the proxy lightweight; we can swap
 * to direct-upload signed URLs if larger files become a need.
 */

const BUCKET = "chat";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
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
  const auth = request.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return NextResponse.json(
      { error: "missing bearer key" },
      { status: 401 },
    );
  }
  let session;
  try {
    session = await verifyEmbedKey(m[1]);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "invalid key" },
      { status: 401 },
    );
  }

  const { id: conversationId } = await params;

  // Scope check: conversation belongs to the bearer's tenant.
  const service = getServiceClient();
  const { data: conv } = await service
    .from("conversations")
    .select("id, tenant_id")
    .eq("id", conversationId)
    .eq("tenant_id", session.tenantId)
    .maybeSingle();
  if (!conv) {
    return NextResponse.json(
      { error: "conversation not found" },
      { status: 404 },
    );
  }

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

  // Path is tenant-scoped: <tenant>/<conv>/<uuid>.<ext>. The conv
  // segment keeps things browsable in the Supabase dashboard.
  const ext = (() => {
    const m = /\.([a-z0-9]+)$/i.exec(file.name);
    if (m) return m[1].toLowerCase();
    const fromMime = file.type.split("/")[1] || "bin";
    return fromMime.toLowerCase();
  })();
  const path = `${session.tenantId}/${conversationId}/${randomUUID()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await service.storage
    .from(BUCKET)
    .upload(path, buffer, {
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
