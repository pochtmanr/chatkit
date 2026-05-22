import { WebhookEndpointInput } from "./WebhookEndpointInput";
import { WebhookSecretBlock } from "./WebhookSecretBlock";
import { WebhookEventsList } from "./WebhookEventsList";
import { WebhookDeliveriesTable } from "./WebhookDeliveriesTable";

export interface WebhookInboxRow {
  id: string;
  name: string;
  slug: string;
  projectName: string;
  audienceLabel: string;
  webhookUrl: string | null;
  webhookSecret: string | null;
  webhookSecretPrevious: string | null;
  webhookSecretRotatedAt: string | null;
  webhookEvents: string[];
}

export function WebhookInboxCard({ inbox }: { inbox: WebhookInboxRow }) {
  return (
    <section className="rounded-2xl bg-white border border-mist/80 shadow-[0_1px_2px_rgba(11,11,11,0.04)] p-5 md:p-6 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-medium text-ink truncate">
            {inbox.name}
          </h2>
          <p className="text-[12px] text-deep/60 mt-0.5">
            {inbox.projectName} · inbox slug{" "}
            <code className="font-mono">{inbox.slug}</code> · {inbox.audienceLabel}
          </p>
        </div>
      </header>

      <div className="space-y-2">
        <p className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
          Endpoint
        </p>
        <WebhookEndpointInput
          inboxId={inbox.id}
          initialUrl={inbox.webhookUrl}
          subscribedEvents={inbox.webhookEvents}
        />
      </div>

      <div className="space-y-2">
        <p className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
          Signing secret
        </p>
        <WebhookSecretBlock
          inboxId={inbox.id}
          currentSecret={inbox.webhookSecret}
          previousSecret={inbox.webhookSecretPrevious}
          rotatedAt={inbox.webhookSecretRotatedAt}
        />
      </div>

      <div className="space-y-2">
        <p className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
          Events to send
        </p>
        <WebhookEventsList
          inboxId={inbox.id}
          initialEvents={inbox.webhookEvents}
        />
      </div>

      <div className="space-y-2">
        <p className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
          Recent deliveries
        </p>
        <WebhookDeliveriesTable inboxId={inbox.id} />
      </div>
    </section>
  );
}
