import { revalidatePath } from "next/cache";
import { getServerClient, getServiceClient } from "@/lib/supabase/server";
import { WebhookTestButton } from "./WebhookTestButton";

interface DeliveryRow {
  id: string;
  webhook_url: string;
  event: string;
  status: "pending" | "success" | "failed";
  response_code: number | null;
  response_body: string | null;
  error: string | null;
  attempted_at: string;
  completed_at: string | null;
}

export default async function WebhooksPage() {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, webhook_url")
    .eq("owner_user_id", user!.id);

  // Recent delivery attempts. Service client because we're outside an
  // auth.uid() session context — scope by tenant_id explicitly so a
  // bug here can't cross tenants.
  const service = getServiceClient();
  const tenantIds = (tenants ?? []).map((t) => t.id);
  let deliveries: DeliveryRow[] = [];
  if (tenantIds.length > 0) {
    try {
      const { data } = await service
        .from("webhook_deliveries")
        .select(
          "id, webhook_url, event, status, response_code, response_body, error, attempted_at, completed_at",
        )
        .in("tenant_id", tenantIds)
        .order("attempted_at", { ascending: false })
        .limit(50);
      deliveries = (data ?? []) as DeliveryRow[];
    } catch {
      // Migration 0012 may not be applied yet; render with no rows.
    }
  }

  async function save(formData: FormData) {
    "use server";
    const tenantId = String(formData.get("tenantId") ?? "");
    const url = String(formData.get("url") ?? "").trim() || null;
    const sb = await getServerClient();
    await sb.from("tenants").update({ webhook_url: url }).eq("id", tenantId);
    revalidatePath("/dashboard/webhooks");
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Webhooks</h1>
        <p className="mt-1 text-sm text-zinc-500">
          We POST every new message to this URL so you can fan out FCM /
          SMS / your own notifications. Set the URL, hit{" "}
          <span className="font-medium">Test</span>, and watch the
          delivery log below.
        </p>
      </header>

      <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
        {(tenants ?? []).map((t) => (
          <div key={t.id} className="space-y-3">
            <form action={save} className="flex flex-col sm:flex-row gap-3">
              <input type="hidden" name="tenantId" value={t.id} />
              <input
                name="url"
                type="url"
                defaultValue={t.webhook_url ?? ""}
                placeholder="https://your-server.com/chat-webhook"
                className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm font-mono"
              />
              <button
                type="submit"
                className="rounded-lg bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white px-4 py-2 text-sm font-medium"
              >
                Save
              </button>
            </form>
            <WebhookTestButton disabled={!t.webhook_url} />
          </div>
        ))}

        <details className="text-xs text-zinc-500 space-y-1">
          <summary className="cursor-pointer font-semibold text-zinc-700 dark:text-zinc-300">
            Payload shape
          </summary>
          <pre className="mt-2 bg-zinc-100 dark:bg-zinc-800 rounded p-3 overflow-x-auto">
{`POST {webhook_url}
{
  "event": "message_received",
  "tenant_id": "...",
  "conversation_id": "...",
  "to_user_id": "...",
  "fcm_tokens": ["..."],
  "sender_id": "...",
  "snippet": "Hey, where are you?",
  "media_url": "..." // optional, only for image messages
}`}
          </pre>
        </details>
      </section>

      <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-0 overflow-hidden">
        <header className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold tracking-tight">
            Recent deliveries
          </h2>
          <span className="text-xs text-zinc-500">
            Last 50 — most recent first
          </span>
        </header>
        {deliveries.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            No webhook calls yet. Send a chat message or hit Test above.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {deliveries.map((d) => (
              <li key={d.id} className="px-4 py-3 text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <StatusBadge status={d.status} />
                  <span className="font-medium">{d.event}</span>
                  <span className="text-zinc-500">
                    {d.response_code ? `· ${d.response_code}` : ""}
                  </span>
                  <span className="ml-auto text-zinc-500">
                    {new Date(d.attempted_at).toLocaleTimeString()}
                  </span>
                </div>
                {(d.error || d.response_body) && (
                  <div className="text-zinc-500 font-mono break-all">
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
    pending:
      "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
    success:
      "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
    failed:
      "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${classes[status]}`}
    >
      {status}
    </span>
  );
}
