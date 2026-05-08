import { getServerClient } from "@/lib/supabase/server";

export default async function UsagePage() {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, plan")
    .eq("owner_user_id", user!.id)
    .limit(1);
  const tenantId = tenants?.[0]?.id;

  // Current period stats
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM
  const { data: billing } = tenantId
    ? await supabase
        .from("chat_billing")
        .select("conversations_used, status")
        .eq("tenant_id", tenantId)
        .eq("period_key", period)
        .maybeSingle()
    : { data: null };

  const { count: messageCount } = tenantId
    ? await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
    : { count: 0 };

  const planLimit = tenants?.[0]?.plan === "growth" ? 10000 : tenants?.[0]?.plan === "scale" ? 100000 : 1000;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Usage</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Real-time usage across your chat installation.
        </p>
      </header>

      <div className="grid sm:grid-cols-3 gap-4">
        <Stat
          label="Conversations this month"
          value={(billing?.conversations_used ?? 0).toLocaleString()}
          sub={`${planLimit.toLocaleString()} included`}
        />
        <Stat label="Total messages (lifetime)" value={(messageCount ?? 0).toLocaleString()} />
        <Stat
          label="Status"
          value={billing?.status ?? "active"}
          sub={billing?.status === "overage" ? "Above plan quota" : "Within plan"}
        />
      </div>

      <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
        <h2 className="font-semibold">Getting started</h2>
        <ol className="mt-4 space-y-3 text-sm text-zinc-700 dark:text-zinc-300 list-decimal pl-5">
          <li>
            Grab your API key from{" "}
            <a href="/dashboard/api-keys" className="underline">
              API keys
            </a>
            .
          </li>
          <li>Install the SDK in your app: <code className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5">npm install @holylabs/chat-sdk-rn</code> (mobile) or <code className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5">@holylabs/chat-sdk-web</code> (web).</li>
          <li>
            Set up FAQs and quick links from the{" "}
            <a href="/dashboard/faq" className="underline">
              FAQ
            </a>{" "}
            page so users see them in the widget.
          </li>
          <li>Wire your webhook endpoint so you can fan out push notifications.</li>
        </ol>
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
      <div className="text-sm text-zinc-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}
