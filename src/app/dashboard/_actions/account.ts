"use server";

import { revalidatePath } from "next/cache";
import { getServerClient, getServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/team";

type Ok<T = unknown> = { ok: true } & T;
type Err = { ok: false; error: string };
type ActionResult<T = unknown> = Ok<T> | Err;

const GRACE_DAYS = 30;

export async function requestBusinessDeletion(
  businessId: string,
): Promise<ActionResult<{ scheduledAt: string }>> {
  const guard = await requireRole(businessId, "owner");
  if (!guard.ok) return guard;

  const admin = getServiceClient();

  const { data: existing } = await admin
    .from("deletion_requests")
    .select("id, scheduled_at")
    .eq("user_id", guard.userId)
    .eq("kind", "business_data")
    .eq("business_id", businessId)
    .is("executed_at", null)
    .is("cancelled_at", null)
    .maybeSingle();
  if (existing) {
    return { ok: true, scheduledAt: existing.scheduled_at };
  }

  const scheduledAt = new Date(
    Date.now() + GRACE_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { error } = await admin.from("deletion_requests").insert({
    user_id: guard.userId,
    kind: "business_data",
    business_id: businessId,
    scheduled_at: scheduledAt,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings/account");
  return { ok: true, scheduledAt };
}

export async function requestAccountDeletion(): Promise<
  ActionResult<{ scheduledAt: string }>
> {
  const sb = await getServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "not signed in" };

  const admin = getServiceClient();
  const { data: existing } = await admin
    .from("deletion_requests")
    .select("id, scheduled_at")
    .eq("user_id", user.id)
    .eq("kind", "account")
    .is("executed_at", null)
    .is("cancelled_at", null)
    .maybeSingle();
  if (existing) return { ok: true, scheduledAt: existing.scheduled_at };

  const scheduledAt = new Date(
    Date.now() + GRACE_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { error } = await admin.from("deletion_requests").insert({
    user_id: user.id,
    kind: "account",
    business_id: null,
    scheduled_at: scheduledAt,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings/account");
  return { ok: true, scheduledAt };
}

export async function cancelDeletionRequest(
  requestId: string,
): Promise<ActionResult> {
  const sb = await getServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "not signed in" };

  const admin = getServiceClient();
  const { error } = await admin
    .from("deletion_requests")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("user_id", user.id)
    .is("executed_at", null)
    .is("cancelled_at", null);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings/account");
  return { ok: true };
}

export async function requestDataExport(
  businessId: string,
): Promise<ActionResult<{ requestId: string }>> {
  const guard = await requireRole(businessId, "manager");
  if (!guard.ok) return guard;

  const admin = getServiceClient();
  const { data, error } = await admin
    .from("data_export_requests")
    .insert({
      user_id: guard.userId,
      business_id: businessId,
      status: "queued",
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "couldn't queue export" };
  }

  revalidatePath("/dashboard/settings/account");
  return { ok: true, requestId: data.id };
}
