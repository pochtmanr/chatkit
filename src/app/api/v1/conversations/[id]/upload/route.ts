import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { authTenant, corsHeaders } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/v1/conversations/:id/upload
 *
 * SDK-facing image upload (mobile chat attach button). Tenant API key
 * auth via x-tinychat-api-key, same as the rest of /api/v1/*. Returns
 * the public URL; caller then POSTs the message with media_url +
 * message_type='image'.
 *
 * Mirrors /api/embed/conversations/:id/upload — same bucket, same
 * limits, just different auth.
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
  const auth = await authTenant(request);
  if ("error" in auth) return auth.error;
  const tenant = auth.tenant;

  const { id: conversationId } = await params;
  const service = getServiceClient();
  const { data: conv } = await service
    .from("conversations")
    .select("id, tenant_id")
    .eq("id", conversationId)
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  if (!conv) {
    return NextResponse.json(
      { error: "conversation not found" },
      { status: 404, headers: corsHeaders },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "multipart/form-data required" },
      { status: 400, headers: corsHeaders },
    );
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "file field required" },
      { status: 400, headers: corsHeaders },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `file too large (>${MAX_BYTES / 1024 / 1024} MB)` },
      { status: 413, headers: corsHeaders },
    );
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: `unsupported mime: ${file.type}` },
      { status: 415, headers: corsHeaders },
    );
  }

  const ext = (() => {
    const m = /\.([a-z0-9]+)$/i.exec(file.name);
    if (m) return m[1].toLowerCase();
    const fromMime = file.type.split("/")[1] || "bin";
    return fromMime.toLowerCase();
  })();
  const path = `${tenant.id}/${conversationId}/${randomUUID()}.${ext}`;

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
      { status: 500, headers: corsHeaders },
    );
  }

  const { data: pub } = service.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json(
    { url: pub.publicUrl, path },
    { headers: corsHeaders },
  );
}

export function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}
