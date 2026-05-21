import { requireActiveContext } from "@/lib/active-context";
import { getServiceClient } from "@/lib/supabase/server";
import { LABELS } from "@/lib/onboarding/enums";
import { WebhookRow } from "./WebhookRow";

interface DeliveryRow {
  id: string;
  webhook_url: string;
  event: string;
  status: "pending" | "success" | "failed";
  response_code: number | null;
  response_body: string | null;
  error: string | null;
  attempted_at: string;
}

export default async function WebhooksPage() {
  const ctx = await requireActiveContext();
  const service = getServiceClient();

  // Recent deliveries for the active business (across all its inboxes).
  let deliveries: DeliveryRow[] = [];
  try {
    const { data } = await service
      .from("webhook_deliveries")
      .select(
        "id, webhook_url, event, status, response_code, response_body, error, attempted_at",
      )
      .eq("tenant_id", ctx.business.id)
      .order("attempted_at", { ascending: false })
      .limit(50);
    deliveries = (data ?? []) as DeliveryRow[];
  } catch {
    // Migration 0012 may not be applied — render empty.
  }

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
        <p className="text-deep/70 leading-relaxed text-[15px] font-normal max-w-[640px]">
          We POST every new message to the inbox&apos;s webhook URL so you
          can fan out FCM / SMS / your own notifications. One URL per
          inbox.
        </p>
      </header>

      <section className="grid sm:grid-cols-2 gap-3">
        {ctx.groups.flatMap((g) =>
          g.inboxes.map((ib) => (
            <WebhookRow
              key={ib.id}
              inboxId={ib.id}
              inboxName={ib.name}
              projectName={g.project.name}
              audience={
                LABELS.audience[ib.audience as keyof typeof LABELS.audience] ??
                ib.audience
              }
              initialUrl={ib.webhook_url}
            />
          )),
        )}
      </section>

      <details className="rounded-2xl bg-white border border-mist/80 shadow-[0_1px_2px_rgba(11,11,11,0.04)] p-5">
        <summary className="cursor-pointer text-[14px] font-medium text-ink">
          Payload shape
        </summary>
        <pre className="mt-3 rounded-xl bg-ink text-white/90 font-mono text-[12px] px-4 py-3 overflow-x-auto">
{`POST {webhook_url}
{
  "event": "message_received",
  "tenant_id": "...",
  "inbox_id": "...",       // NEW — use this to route per inbox
  "conversation_id": "...",
  "conversation_kind": "support",
  "external_ref": "...",
  "direction": "inbound" | "outbound",
  "to_user_id": "...",
  "fcm_tokens": ["..."],
  "sender_id": "...",
  "snippet": "Hey, where are you?",
  "media_url": "..." // only for image messages
}`}
        </pre>
      </details>

      <section className="rounded-2xl bg-white border border-mist/80 shadow-[0_1px_2px_rgba(11,11,11,0.04)] overflow-hidden">
        <header className="sticky top-0 bg-white z-10 px-5 py-3 border-b border-mist flex items-baseline justify-between">
          <h2 className="text-[14px] font-medium text-ink">Recent deliveries</h2>
          <span className="text-[12px] text-deep/60">
            Last 50 across {ctx.business.name}
          </span>
        </header>
        {deliveries.length === 0 ? (
          <div className="p-12 text-center text-[14px] text-deep/60">
            No webhook calls yet. Set a URL on an inbox above and hit Test.
          </div>
        ) : (
          <ul className="divide-y divide-mist">
            {deliveries.map((d) => (
              <li key={d.id} className="px-5 py-3 text-[13px] space-y-1">
                <div className="flex items-center gap-2">
                  <StatusBadge status={d.status} />
                  <span className="font-medium text-ink">{d.event}</span>
                  <span className="text-deep/50">
                    {d.response_code ? `· ${d.response_code}` : ""}
                  </span>
                  <span className="ml-auto text-deep/50">
                    {new Date(d.attempted_at).toLocaleTimeString()}
                  </span>
                </div>
                {(d.error || d.response_body) && (
                  <div className="text-deep/60 font-mono break-all text-[12px]">
                    {d.error
                      ? `error: ${d.error}`
                      : (d.response_body ?? "").slice(0, 200)}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: DeliveryRow["status"] }) {
  const classes: Record<DeliveryRow["status"], string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-100",
    success: "bg-emerald-50 text-emerald-700 border-emerald-100",
    failed: "bg-red-50 text-red-700 border-red-100",
  };
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${classes[status]}`}
    >
      {status}
    </span>
  );
}
