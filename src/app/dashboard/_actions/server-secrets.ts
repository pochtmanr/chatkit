"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/team";
import {
  generateServerSecret,
  hashServerSecret,
} from "@/lib/server-secret";

type Ok<T = unknown> = { ok: true } & T;
type Err = { ok: false; error: string };
type ActionResult<T = unknown> = Ok<T> | Err;

async function activeBusinessId(): Promise<string | null> {
  return (await cookies()).get("chatkit_active_biz")?.value ?? null;
}

async function ownerGuard(): Promise<
  | { ok: true; businessId: string; userId: string }
  | { ok: false; error: string }
> {
  const businessId = await activeBusinessId();
  if (!businessId) return { ok: false, error: "no active business" };
  const guard = await requireRole(businessId, "owner");
  if (!guard.ok) return { ok: false, error: guard.error };
  return { ok: true, businessId, userId: guard.userId };
}

async function loadInbox(
  inboxId: string,
  businessId: string,
): Promise<
  | { ok: true; row: { id: string; server_secret_hash: string | null } }
  | { ok: false; error: string }
> {
  const admin = getServiceClient();
  const { data, error } = await admin
    .from("inboxes")
    .select("id, server_secret_hash")
    .eq("id", inboxId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "inbox not found" };
  return { ok: true, row: data };
}

export async function createServerSecret(input: {
  inboxId: string;
}): Promise<ActionResult<{ rawKey: string; prefix: string }>> {
  const guard = await ownerGuard();
  if (!guard.ok) return guard;

  const inbox = await loadInbox(input.inboxId, guard.businessId);
  if (!inbox.ok) return inbox;
  if (inbox.row.server_secret_hash) {
    return { ok: false, error: "server secret already exists; rotate instead" };
  }

  const { raw, prefix } = generateServerSecret();
  const admin = getServiceClient();
  const { error } = await admin
    .from("inboxes")
    .update({
      server_secret_hash: hashServerSecret(raw),
      server_secret_previous_hash: null,
      server_secret_rotated_at: null,
    })
    .eq("id", input.inboxId)
    .eq("business_id", guard.businessId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings/api-keys");
  return { ok: true, rawKey: raw, prefix };
}

export async function rotateServerSecret(input: {
  inboxId: string;
}): Promise<ActionResult<{ rawKey: string; prefix: string }>> {
  const guard = await ownerGuard();
  if (!guard.ok) return guard;

  const inbox = await loadInbox(input.inboxId, guard.businessId);
  if (!inbox.ok) return inbox;
  if (!inbox.row.server_secret_hash) {
    return { ok: false, error: "no server secret to rotate; create one first" };
  }

  const { raw, prefix } = generateServerSecret();
  const admin = getServiceClient();
  const { error } = await admin
    .from("inboxes")
    .update({
      server_secret_hash: hashServerSecret(raw),
      server_secret_previous_hash: inbox.row.server_secret_hash,
      server_secret_rotated_at: new Date().toISOString(),
    })
    .eq("id", input.inboxId)
    .eq("business_id", guard.businessId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings/api-keys");
  return { ok: true, rawKey: raw, prefix };
}

export async function revokeServerSecret(input: {
  inboxId: string;
}): Promise<ActionResult> {
  const guard = await ownerGuard();
  if (!guard.ok) return guard;

  const admin = getServiceClient();
  const { error } = await admin
    .from("inboxes")
    .update({
      server_secret_hash: null,
      server_secret_previous_hash: null,
      server_secret_rotated_at: null,
    })
    .eq("id", input.inboxId)
    .eq("business_id", guard.businessId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings/api-keys");
  return { ok: true };
}
