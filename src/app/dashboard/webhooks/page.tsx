import { revalidatePath } from "next/cache";
import { getServerClient } from "@/lib/supabase/server";

export default async function WebhooksPage() {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, webhook_url")
    .eq("owner_user_id", user!.id);

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
          We POST every new message to this URL so you can fan out FCM / SMS / your own
          notifications.
        </p>
      </header>
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
        {(tenants ?? []).map((t) => (
          <form key={t.id} action={save} className="flex flex-col sm:flex-row gap-3">
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
        ))}
        <div className="text-xs text-zinc-500 space-y-1">
          <p className="font-semibold text-zinc-700 dark:text-zinc-300">Payload shape:</p>
          <pre className="bg-zinc-100 dark:bg-zinc-800 rounded p-3 overflow-x-auto">
{`POST {webhook_url}
{
  "event": "message_received",
  "tenant_id": "...",
  "conversation_id": "...",
  "to_user_id": "...",
  "fcm_tokens": ["..."],
  "sender_id": "...",
  "snippet": "Hey, where are you?"
}`}
          </pre>
        </div>
      </div>
    </div>
  );
}
