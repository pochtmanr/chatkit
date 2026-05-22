import { requireActiveContext } from "@/lib/active-context";
import { getServiceClient } from "@/lib/supabase/server";
import { LABELS } from "@/lib/onboarding/enums";
import {
  WebhookInboxCard,
  type WebhookInboxRow,
} from "@/app/dashboard/_components/webhooks/WebhookInboxCard";
import { WebhookDocsPanel } from "@/app/dashboard/_components/webhooks/WebhookDocsPanel";
import { ALL_WEBHOOK_EVENTS } from "@/lib/tenant-webhook";

export default async function WebhooksPage() {
  const ctx = await requireActiveContext();
  const service = getServiceClient();

  // Pull the signing-related columns for every inbox in the active
  // business. The active-context payload only exposes the slim Inbox
  // shape, so we re-query here.
  const { data: rawInboxes } = await service
    .from("inboxes")
    .select(
      "id, name, slug, project_id, audience, webhook_url, webhook_secret, webhook_secret_previous, webhook_secret_rotated_at, webhook_events",
    )
    .eq("business_id", ctx.business.id)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  const projectsById = new Map(
    ctx.groups.map((g) => [g.project.id, g.project.name] as const),
  );

  const inboxes: WebhookInboxRow[] = (rawInboxes ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    projectName: projectsById.get(row.project_id) ?? "—",
    audienceLabel:
      LABELS.audience[row.audience as keyof typeof LABELS.audience] ??
      row.audience,
    webhookUrl: row.webhook_url,
    webhookSecret: row.webhook_secret,
    webhookSecretPrevious: row.webhook_secret_previous,
    webhookSecretRotatedAt: row.webhook_secret_rotated_at,
    webhookEvents:
      (Array.isArray(row.webhook_events) && row.webhook_events.length > 0)
        ? row.webhook_events
        : Array.from(ALL_WEBHOOK_EVENTS),
  }));

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-[14px] font-medium text-deep/60">Delivery</p>
        <h1 className="text-3xl sm:text-4xl tracking-tight text-ink leading-[1] font-normal">
          Outgoing{" "}
          <span className="font-serif-italic font-normal text-deep">
            webhooks<span className="text-deep/40">.</span>
          </span>
        </h1>
        <p className="text-deep/70 leading-relaxed text-[15px] font-normal max-w-[680px]">
          Each inbox POSTs the events you subscribe to its endpoint, signed
          with HMAC-SHA256 so you can verify the call really came from us.
          Rotate the secret any time — the previous one stays valid for a
          24-hour grace window.
        </p>
      </header>

      <WebhookDocsPanel />

      {inboxes.length === 0 ? (
        <div className="rounded-2xl bg-white border border-mist/80 p-10 text-center text-[14px] text-deep/60">
          No inboxes yet — create one to start receiving webhooks.
        </div>
      ) : (
        <div className="space-y-6">
          {inboxes.map((inbox) => (
            <WebhookInboxCard key={inbox.id} inbox={inbox} />
          ))}
        </div>
      )}
    </div>
  );
}
