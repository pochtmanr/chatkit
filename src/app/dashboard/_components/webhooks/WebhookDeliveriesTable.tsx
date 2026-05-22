import { getServiceClient } from "@/lib/supabase/server";
import { WebhookPayloadDrawer } from "./WebhookPayloadDrawer";
import type { Json } from "@/lib/supabase/database.types";

interface DeliveryRow {
  id: string;
  webhook_url: string;
  event: string;
  event_kind: string | null;
  status: "pending" | "success" | "failed";
  response_code: number | null;
  response_body: string | null;
  error: string | null;
  attempted_at: string;
  completed_at: string | null;
  payload: Json;
}

export async function WebhookDeliveriesTable({
  inboxId,
  limit = 10,
}: {
  inboxId: string;
  limit?: number;
}) {
  const service = getServiceClient();
  // Filter by URL since webhook_deliveries doesn't carry inbox_id yet —
  // a delivery row is keyed by tenant + URL, and each inbox's URL is
  // unique within its business (operators rarely point two inboxes at
  // the same endpoint).
  const { data: inbox } = await service
    .from("inboxes")
    .select("id, business_id, webhook_url")
    .eq("id", inboxId)
    .maybeSingle();
  if (!inbox?.webhook_url) {
    return (
      <p className="text-[12px] text-deep/50">
        Configure a webhook URL to start seeing deliveries.
      </p>
    );
  }
  const { data } = await service
    .from("webhook_deliveries")
    .select(
      "id, webhook_url, event, event_kind, status, response_code, response_body, error, attempted_at, completed_at, payload",
    )
    .eq("tenant_id", inbox.business_id)
    .eq("webhook_url", inbox.webhook_url)
    .order("attempted_at", { ascending: false })
    .limit(limit);
  const rows: DeliveryRow[] = (data ?? []) as DeliveryRow[];

  if (rows.length === 0) {
    return (
      <p className="text-[12px] text-deep/50">
        No deliveries yet. Save a URL and hit Test to try it.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-mist border-t border-mist">
      {rows.map((row) => (
        <li
          key={row.id}
          className="py-2 flex items-center gap-3 text-[12px] flex-wrap"
        >
          <time className="text-deep/50 font-mono w-20 shrink-0">
            {new Date(row.attempted_at).toLocaleTimeString()}
          </time>
          <StatusPill status={row.status} code={row.response_code} />
          <span className="font-mono text-ink">
            {row.event_kind ?? row.event}
          </span>
          <span className="text-deep/50">
            {row.completed_at
              ? `${Date.parse(row.completed_at) - Date.parse(row.attempted_at)}ms`
              : "—"}
          </span>
          <span className="ml-auto">
            <WebhookPayloadDrawer
              payload={row.payload}
              responseBody={row.response_body}
              error={row.error}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}

function StatusPill({
  status,
  code,
}: {
  status: DeliveryRow["status"];
  code: number | null;
}) {
  const cls =
    status === "success"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : status === "failed"
        ? "bg-red-50 text-red-700 border-red-100"
        : "bg-amber-50 text-amber-700 border-amber-100";
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls}`}
    >
      {code ?? status}
    </span>
  );
}
