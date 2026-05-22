import { getServiceClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { signWebhookBody, type SignatureInputs } from "./sign";
import type {
  TenantWebhookPayload,
  WebhookDispatchResult,
  WebhookEventKind,
} from "./types";

// 25s leaves breathing room under Vercel's 60s function ceiling for
// receivers that fan out FCM / SMTP synchronously.
const WEBHOOK_TIMEOUT_MS = 25_000;

type ServiceClient = ReturnType<typeof getServiceClient>;

export interface InboxDispatchContext {
  tenantId: string;
  inboxId: string;
  webhookUrl: string;
  signing: SignatureInputs;
  subscribedEvents: readonly string[];
}

/** Dispatches a single payload, signing + logging along the way.
 *  Never throws; surfaces failure via `WebhookDispatchResult.ok = false`.
 *
 *  If the inbox isn't subscribed to the payload's event the dispatch
 *  is silently dropped (and a "skipped: filtered" delivery row is
 *  recorded so the dashboard shows the choice was honoured). */
export async function dispatchToInbox(
  ctx: InboxDispatchContext,
  payload: TenantWebhookPayload,
): Promise<WebhookDispatchResult> {
  if (!ctx.subscribedEvents.includes(payload.event)) {
    return {
      ok: false,
      status: null,
      body: null,
      error: `event ${payload.event} not in inbox subscription`,
      durationMs: 0,
    };
  }

  const service = getServiceClient();
  const body = JSON.stringify(payload);
  const signed = signWebhookBody(body, ctx.signing);

  const delivery = await openDeliveryRow(service, {
    tenantId: ctx.tenantId,
    webhookUrl: ctx.webhookUrl,
    eventKind: payload.event,
    payload,
  });

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (signed) headers["x-chatkit-signature"] = signed.header;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const res = await fetch(ctx.webhookUrl, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
    const text = await res.text().catch(() => "");
    const trimmed = text.slice(0, 4000);
    const durationMs = Date.now() - startedAt;

    if (!res.ok) {
      console.warn(
        `[tenant-webhook] ${ctx.tenantId} ${ctx.webhookUrl} returned ${res.status}`,
      );
      await closeDeliveryRow(service, delivery, {
        status: "failed",
        response_code: res.status,
        response_body: trimmed,
        error: `HTTP ${res.status}`,
      });
      return {
        ok: false,
        status: res.status,
        body: trimmed,
        error: `HTTP ${res.status}`,
        durationMs,
      };
    }

    await closeDeliveryRow(service, delivery, {
      status: "success",
      response_code: res.status,
      response_body: trimmed,
    });
    return { ok: true, status: res.status, body: trimmed, durationMs };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startedAt;
    console.warn(
      `[tenant-webhook] ${ctx.tenantId} ${ctx.webhookUrl} failed:`,
      err,
    );
    await closeDeliveryRow(service, delivery, { status: "failed", error: msg });
    return {
      ok: false,
      status: null,
      body: null,
      error: msg,
      durationMs,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function openDeliveryRow(
  service: ServiceClient,
  args: {
    tenantId: string;
    webhookUrl: string;
    eventKind: WebhookEventKind;
    payload: TenantWebhookPayload;
  },
): Promise<string | null> {
  try {
    const { data } = await service
      .from("webhook_deliveries")
      .insert({
        tenant_id: args.tenantId,
        webhook_url: args.webhookUrl,
        event: args.eventKind,
        event_kind: args.eventKind,
        payload: args.payload as unknown as Json,
        status: "pending",
      })
      .select("id")
      .single();
    return data?.id ?? null;
  } catch {
    // Logging is best-effort — never block the actual webhook on it.
    return null;
  }
}

async function closeDeliveryRow(
  service: ServiceClient,
  deliveryId: string | null,
  patch: {
    status: "success" | "failed";
    response_code?: number | null;
    response_body?: string | null;
    error?: string | null;
  },
): Promise<void> {
  if (!deliveryId) return;
  try {
    await service
      .from("webhook_deliveries")
      .update({ ...patch, completed_at: new Date().toISOString() })
      .eq("id", deliveryId);
  } catch {
    /* logging only */
  }
}

/** Looks up dispatch context for `inboxId`. Returns `null` when the
 *  inbox has no webhook URL configured (callers should treat this as
 *  a successful no-op). */
export async function loadInboxDispatchContext(
  inboxId: string,
): Promise<InboxDispatchContext | null> {
  const service = getServiceClient();
  const { data: inbox } = await service
    .from("inboxes")
    .select(
      "id, business_id, webhook_url, webhook_secret, webhook_secret_previous, webhook_secret_rotated_at, webhook_events",
    )
    .eq("id", inboxId)
    .maybeSingle();
  if (!inbox?.webhook_url) return null;
  return {
    tenantId: inbox.business_id,
    inboxId: inbox.id,
    webhookUrl: inbox.webhook_url,
    signing: {
      secret: inbox.webhook_secret,
      previousSecret: inbox.webhook_secret_previous,
      rotatedAt: inbox.webhook_secret_rotated_at,
    },
    subscribedEvents: inbox.webhook_events ?? [],
  };
}
