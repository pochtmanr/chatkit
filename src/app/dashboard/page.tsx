import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getActiveContext } from "@/lib/active-context";
import { getServerClient, getServiceClient } from "@/lib/supabase/server";
import { OnboardingModal } from "./_components/onboarding/OnboardingModal";

export default async function UsagePage() {
  const ctx = await getActiveContext();

  // No active context ⇒ user hasn't completed onboarding (no business with
  // onboarding_completed_at set, or no inbox yet). Render the blocking
  // wizard on top of an empty surface; `completeOnboarding` + router.refresh
  // unmounts it on success.
  if (!ctx) {
    const sb = await getServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    return <OnboardingModal userEmail={user?.email ?? ""} />;
  }

  const period = new Date().toISOString().slice(0, 7); // YYYY-MM
  const service = getServiceClient();

  // Business-level billing summary. The row may not exist yet for a
  // freshly-onboarded business — that's fine, render zero values.
  const { data: billing } = await service
    .from("chat_billing")
    .select("conversations_used, status")
    .eq("tenant_id", ctx.business.id)
    .eq("period_key", period)
    .maybeSingle();

  const { count: totalMessages } = await service
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", ctx.business.id);

  // Per-inbox breakdown — count conversations + messages per inbox via two
  // parallel queries. O(rows-in-business), fine at v0.x scale. If this
  // becomes a hotspot, add a materialized view keyed by inbox_id.
  const [convRows, msgRows] = await Promise.all([
    service
      .from("conversations")
      .select("inbox_id")
      .eq("tenant_id", ctx.business.id)
      .in(
        "inbox_id",
        ctx.inboxes.map((i) => i.id),
      )
      .then((res) => res.data ?? []),
    service
      .from("messages")
      .select("conversation_id, conversations!inner(inbox_id)")
      .eq("tenant_id", ctx.business.id)
      .then((res) => res.data ?? []),
  ]);

  const convByInbox = new Map<string, number>();
  for (const c of convRows as Array<{ inbox_id: string }>) {
    convByInbox.set(c.inbox_id, (convByInbox.get(c.inbox_id) ?? 0) + 1);
  }
  const msgByInbox = new Map<string, number>();
  for (const m of msgRows as Array<{
    conversations: { inbox_id: string } | { inbox_id: string }[];
  }>) {
    const c = Array.isArray(m.conversations) ? m.conversations[0] : m.conversations;
    if (!c) continue;
    msgByInbox.set(c.inbox_id, (msgByInbox.get(c.inbox_id) ?? 0) + 1);
  }

  const planLimit =
    ctx.business.plan === "growth"
      ? 10000
      : ctx.business.plan === "scale"
        ? 100000
        : 1000;

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="text-[14px] font-medium text-deep/60">Overview</p>
        <h1 className="text-3xl sm:text-4xl tracking-tight text-ink leading-[1] font-normal">
          This month&apos;s{" "}
          <span className="font-serif-italic font-normal text-deep">
            usage<span className="text-deep/40">.</span>
          </span>
        </h1>
        <p className="text-deep/70 leading-relaxed text-[15px] font-normal max-w-2xl">
          Real-time activity across{" "}
          <span className="font-medium text-ink">{ctx.business.name}</span>.
          {ctx.inboxes.length > 1
            ? " Switch inbox in the sidebar to scope the conversations tab."
            : ""}
        </p>
      </header>

      {/* Top stats — business-wide. */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="Conversations this month"
          value={(billing?.conversations_used ?? 0).toLocaleString()}
          sub={`${planLimit.toLocaleString()} included on ${ctx.business.plan}`}
        />
        <Stat
          label="Total messages (lifetime)"
          value={(totalMessages ?? 0).toLocaleString()}
        />
        <Stat
          label="Status"
          value={billing?.status ?? "active"}
          sub={billing?.status === "overage" ? "Above plan quota" : "Within plan"}
          accent={billing?.status === "overage" ? "amber" : undefined}
        />
        {/* TODO(round-3 prompt 3): replace with live count of conversations in
            `new` | `active` | `waiting_customer` | `waiting_support` once the
            status enum + backfill migration land. */}
        <Stat
          label="Active conversations"
          value="—"
          sub="Available once statuses are enabled"
        />
      </section>

      {/* Per-inbox breakdown. Only render when there's more than one. */}
      {ctx.inboxes.length > 1 && (
        <section className="space-y-3">
          <header>
            <h2 className="text-[20px] tracking-tight text-ink font-normal">
              By{" "}
              <span className="font-serif-italic font-normal text-deep">
                inbox<span className="text-deep/40">.</span>
              </span>
            </h2>
            <p className="text-deep/70 text-[14px] mt-1">
              Activity per inbox across {ctx.business.name}.
            </p>
          </header>
          <div className="rounded-2xl bg-white border border-mist/80 shadow-[0_1px_2px_rgba(11,11,11,0.04)] overflow-hidden">
            <table className="w-full text-left text-[14px]">
              <thead className="sticky top-0 bg-white z-10 border-b border-mist">
                <tr className="text-left text-[12px] uppercase tracking-[0.12em] text-deep/50">
                  <th className="px-5 py-3 font-medium">Inbox</th>
                  <th className="px-5 py-3 font-medium">Project</th>
                  <th className="px-5 py-3 font-medium text-right">Conversations</th>
                  <th className="px-5 py-3 font-medium text-right">Messages</th>
                  <th className="px-5 py-3 font-medium">Webhook</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mist">
                {ctx.groups.flatMap((g) =>
                  g.inboxes.map((ib) => (
                    <tr
                      key={ib.id}
                      className={ib.id === ctx.inbox.id ? "bg-mist/30" : ""}
                    >
                      <td className="px-5 py-3 text-ink font-medium">
                        {ib.name}
                        {ib.id === ctx.inbox.id && (
                          <span className="ml-2 inline-block rounded-full bg-ink text-white text-[10px] px-2 py-0.5 align-middle">
                            ACTIVE
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-deep/70">{g.project.name}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-ink">
                        {(convByInbox.get(ib.id) ?? 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-ink">
                        {(msgByInbox.get(ib.id) ?? 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-deep/70">
                        {ib.webhook_url ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Configured
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-deep/50">
                            <span className="h-1.5 w-1.5 rounded-full bg-deep/30" />
                            Not set
                          </span>
                        )}
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Getting started panel — restyled. */}
      <section className="rounded-2xl bg-white border border-mist/80 shadow-[0_1px_2px_rgba(11,11,11,0.04)] p-6 md:p-8 space-y-4">
        <h2 className="text-[18px] font-medium text-ink">Getting started</h2>
        <ol className="space-y-3 text-[14px] text-deep/80 list-decimal pl-5 marker:text-deep/40">
          <li>
            Grab the API key for{" "}
            <span className="font-medium text-ink">{ctx.inbox.name}</span> from{" "}
            <Link
              href="/dashboard/api-keys"
              className="text-deep underline hover:text-ink"
            >
              API keys
            </Link>
            .
          </li>
          <li>
            Install the SDK:{" "}
            <code className="rounded-md bg-mist/60 px-1.5 py-0.5 text-[13px] font-mono text-ink">
              npm install @holylabs/chat-sdk-web
            </code>{" "}
            (or the RN package for mobile).
          </li>
          <li>
            Point the SDK at the inbox key. The widget appears wherever you
            mount it.
          </li>
          <li>
            Wire a webhook for{" "}
            <span className="font-medium text-ink">{ctx.inbox.name}</span> on{" "}
            <Link
              href="/dashboard/webhooks"
              className="text-deep underline hover:text-ink"
            >
              Webhooks
            </Link>{" "}
            to fan out push notifications.
          </li>
        </ol>
        <div className="pt-2">
          <Link
            href="/dashboard/inbox"
            className="group inline-flex items-center gap-2 rounded-full bg-ink text-white pl-5 pr-2 py-2 text-[14px] font-medium shadow-lg shadow-ink/10 hover:bg-deep transition-colors"
          >
            Open inbox
            <span className="grid place-items-center h-7 w-7 rounded-full bg-white text-ink">
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "amber";
}) {
  const valueClass =
    accent === "amber" ? "text-amber-700 capitalize" : "text-ink capitalize";
  return (
    <div className="rounded-2xl bg-white border border-mist/80 shadow-[0_1px_2px_rgba(11,11,11,0.04)] p-5">
      <div className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
        {label}
      </div>
      <div className={`mt-2 text-3xl font-normal tabular-nums ${valueClass}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-[12px] text-deep/60">{sub}</div>}
    </div>
  );
}
