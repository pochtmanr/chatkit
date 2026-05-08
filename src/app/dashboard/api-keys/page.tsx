import { revalidatePath } from "next/cache";
import { getServerClient } from "@/lib/supabase/server";

export default async function ApiKeysPage() {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name, api_key")
    .eq("owner_user_id", user!.id);

  async function rotateKey(formData: FormData) {
    "use server";
    const tenantId = String(formData.get("tenantId") ?? "");
    const newKey =
      "pk_live_" +
      Array.from(globalThis.crypto.getRandomValues(new Uint8Array(12)), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
    const sb = await getServerClient();
    await sb.from("tenants").update({ api_key: newKey }).eq("id", tenantId);
    revalidatePath("/dashboard/api-keys");
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">API keys</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Use this in your app: <code>initChatSDK({"{ apiKey }"})</code>. Treat like a password.
        </p>
      </header>
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-200 dark:divide-zinc-800">
        {(tenants ?? []).map((t) => (
          <div key={t.id} className="p-5 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{t.name}</div>
              <code className="mt-1 block text-xs text-zinc-600 dark:text-zinc-400 truncate font-mono">
                {t.api_key}
              </code>
            </div>
            <form action={rotateKey}>
              <input type="hidden" name="tenantId" value={t.id} />
              <button
                type="submit"
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Rotate
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
