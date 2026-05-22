import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { getServerClient, getServiceClient } from "@/lib/supabase/server";

/**
 * Dashboard-side image upload. Mirrors /api/embed/.../upload but
 * authenticates the caller via Supabase session (signed-in agent)
 * instead of an API key.
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
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id: conversationId } = await params;

  // Ownership check: conversation must belong to a tenant this user
  // owns. Service client because conversation ↔ tenant join skirts RLS.
  const service = getServiceClient();
  const { data: conv } = await service
    .from("conversations")
    .select("id, tenant_id, tenants!inner(owner_user_id)")
    .eq("id", conversationId)
    .maybeSingle();
  type OwnerRow = { tenant_id: string; tenants: { owner_user_id: string } };
  const ownerRow = conv as unknown as OwnerRow | null;
  if (!ownerRow) {
    return NextResponse.json(
      { error: "conversation not found" },
      { status: 404 },
    );
  }
  if (ownerRow.tenants.owner_user_id !== user.id) {
    const { data: agentRow } = await service
      .from("support_agents")
      .select("id")
      .eq("business_id", ownerRow.tenant_id)
      .eq("user_id", user.id)
      .is("archived_at", null)
      .not("accepted_at", "is", null)
      .maybeSingle();
    if (!agentRow) {
      return NextResponse.json(
        { error: "conversation not found" },
        { status: 404 },
      );
    }
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

  const ext = (() => {
    const m = /\.([a-z0-9]+)$/i.exec(file.name);
    if (m) return m[1].toLowerCase();
    const fromMime = file.type.split("/")[1] || "bin";
    return fromMime.toLowerCase();
  })();
  const path = `${ownerRow.tenant_id}/${conversationId}/${randomUUID()}.${ext}`;

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
