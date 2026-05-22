"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/team";
import { generateKey, hashKey } from "@/lib/mcp-keys";

type Ok<T = unknown> = { ok: true } & T;
type Err = { ok: false; error: string };
type ActionResult<T = unknown> = Ok<T> | Err;

async function activeBusinessId(): Promise<string | null> {
  return (await cookies()).get("chatkit_active_biz")?.value ?? null;
}

export async function createMcpKey(input: {
  name: string;
}): Promise<ActionResult<{ id: string; rawKey: string; prefix: string }>> {
  const name = input.name.trim();
  if (name.length < 1 || name.length > 60) {
    return { ok: false, error: "name must be 1–60 chars" };
  }

  const businessId = await activeBusinessId();
  if (!businessId) return { ok: false, error: "no active business" };
  const guard = await requireRole(businessId, "manager");
  if (!guard.ok) return guard;

  const { raw, prefix } = generateKey();
  const hash = await hashKey(raw);

  const admin = getServiceClient();
  const { data, error } = await admin
    .from("mcp_access_keys")
    .insert({
      business_id: businessId,
      name,
      key_hash: hash,
      key_prefix: prefix,
      created_by: guard.userId,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "couldn't create key" };
  }

  revalidatePath("/dashboard/settings/mcp");
  return { ok: true, id: data.id, rawKey: raw, prefix };
}

export async function revokeMcpKey(keyId: string): Promise<ActionResult> {
  const businessId = await activeBusinessId();
  if (!businessId) return { ok: false, error: "no active business" };
  const guard = await requireRole(businessId, "manager");
  if (!guard.ok) return guard;

  const admin = getServiceClient();
  const { error } = await admin
    .from("mcp_access_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("business_id", businessId)
    .is("revoked_at", null);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/settings/mcp");
  return { ok: true };
}
