"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireActiveContext } from "@/lib/active-context";
import { requireRole } from "@/lib/team";
import { getServiceClient } from "@/lib/supabase/server";
import {
  ALL_WEBHOOK_EVENTS,
  isWebhookEvent,
  dispatchTestPayload,
  type WebhookEventKind,
} from "@/lib/tenant-webhook";

type Ok<T = unknown> = { ok: true } & T;
type Err = { ok: false; error: string };
type ActionResult<T = unknown> = Ok<T> | Err;

/**
 * Owner-only server actions backing the `/dashboard/webhooks` page.
 *
 * Each action resolves the active business from the cookie, enforces
 * `requireRole(business, 'owner')`, then verifies the target inbox
 * belongs to that business before touching it. Plain agents and leads
 * cannot reach these actions.
 */

async function authoriseInboxOwner(
  inboxId: string,
): Promise<
  | { ok: true; businessId: string }
  | { ok: false; error: string }
> {
  const ctx = await requireActiveContext();
  const role = await requireRole(ctx.business.id, "owner");
  if (!role.ok) return { ok: false, error: role.error };

  const service = getServiceClient();
  const { data: inbox } = await service
    .from("inboxes")
    .select("id, business_id")
    .eq("id", inboxId)
    .is("archived_at", null)
    .maybeSingle();
  if (!inbox) return { ok: false, error: "inbox not found" };
  if (inbox.business_id !== ctx.business.id) {
    return { ok: false, error: "forbidden" };
  }
  return { ok: true, businessId: inbox.business_id };
}

export async function setInboxWebhookUrl(
  inboxId: string,
  url: string | null,
): Promise<ActionResult> {
  const auth = await authoriseInboxOwner(inboxId);
  if (!auth.ok) return auth;

  const normalised = url?.trim() ? url.trim() : null;
  if (normalised) {
    try {
      const parsed = new URL(normalised);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return { ok: false, error: "URL must use http(s)" };
      }
    } catch {
      return { ok: false, error: "must be a valid URL" };
    }
  }

  const service = getServiceClient();
  const { error } = await service
    .from("inboxes")
    .update({ webhook_url: normalised })
    .eq("id", inboxId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/webhooks");
  return { ok: true };
}

export async function setInboxWebhookEvents(
  inboxId: string,
  events: string[],
): Promise<ActionResult> {
  const auth = await authoriseInboxOwner(inboxId);
  if (!auth.ok) return auth;

  const unique = Array.from(new Set(events));
  for (const ev of unique) {
    if (!isWebhookEvent(ev)) {
      return { ok: false, error: `unknown event: ${ev}` };
    }
  }
  // Preserve canonical ordering so the column reads predictably in psql.
  const ordered: WebhookEventKind[] = ALL_WEBHOOK_EVENTS.filter((e) =>
    unique.includes(e),
  );

  const service = getServiceClient();
  const { error } = await service
    .from("inboxes")
    .update({ webhook_events: ordered })
    .eq("id", inboxId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/webhooks");
  return { ok: true };
}

export async function rotateInboxWebhookSecret(
  inboxId: string,
): Promise<ActionResult<{ newSecret: string }>> {
  const auth = await authoriseInboxOwner(inboxId);
  if (!auth.ok) return auth;

  const service = getServiceClient();
  const { data: current } = await service
    .from("inboxes")
    .select("webhook_secret")
    .eq("id", inboxId)
    .maybeSingle();
  if (!current) return { ok: false, error: "inbox not found" };

  const newSecret = crypto.randomBytes(32).toString("base64");
  // Guard against the (vanishingly unlikely) collision the check constraint
  // forbids.
  if (current.webhook_secret === newSecret) {
    return { ok: false, error: "secret collision — retry" };
  }
  const { error } = await service
    .from("inboxes")
    .update({
      webhook_secret: newSecret,
      webhook_secret_previous: current.webhook_secret ?? null,
      webhook_secret_rotated_at: new Date().toISOString(),
    })
    .eq("id", inboxId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/webhooks");
  return { ok: true, newSecret };
}

export async function clearInboxWebhookSecretPrevious(
  inboxId: string,
): Promise<ActionResult> {
  const auth = await authoriseInboxOwner(inboxId);
  if (!auth.ok) return auth;

  const service = getServiceClient();
  const { error } = await service
    .from("inboxes")
    .update({
      webhook_secret_previous: null,
      webhook_secret_rotated_at: null,
    })
    .eq("id", inboxId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/webhooks");
  return { ok: true };
}

export async function testFireWebhook(
  inboxId: string,
  eventKind: string,
): Promise<
  ActionResult<{
    statusCode: number | null;
    responseBody: string;
    durationMs: number;
  }>
> {
  const auth = await authoriseInboxOwner(inboxId);
  if (!auth.ok) return auth;
  if (!isWebhookEvent(eventKind)) {
    return { ok: false, error: `unknown event: ${eventKind}` };
  }

  const result = await dispatchTestPayload(inboxId, eventKind);
  revalidatePath("/dashboard/webhooks");
  if (result.ok) {
    return {
      ok: true,
      statusCode: result.status,
      responseBody: result.body,
      durationMs: result.durationMs,
    };
  }
  // A non-2xx response still tells the user something useful; we surface
  // it through the success-shaped result rather than an error.
  if (result.status !== null) {
    return {
      ok: true,
      statusCode: result.status,
      responseBody: result.body ?? "",
      durationMs: result.durationMs,
    };
  }
  return { ok: false, error: result.error };
}
