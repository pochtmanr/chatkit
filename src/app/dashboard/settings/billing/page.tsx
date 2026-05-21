import { requireActiveContext } from "@/lib/active-context";
import { listPlans, getCurrentPlanForBusiness, type Plan } from "@/lib/plans";
import { listInvoices } from "@/app/dashboard/_actions/billing";
import { PlanPicker } from "@/app/dashboard/_components/billing/PlanPicker";
import { InvoicesTable } from "@/app/dashboard/_components/billing/InvoicesTable";

export default async function SettingsBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string }>;
}) {
  const ctx = await requireActiveContext();
  const { paid } = await searchParams;

  const [plans, currentPlan, invoices] = await Promise.all([
    listPlans(),
    getCurrentPlanForBusiness(ctx.business.id),
    listInvoices(ctx.business.id),
  ]);

  return (
    <div className="space-y-8">
      {paid === "1" && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-[14px] text-emerald-900">
          Payment received. Your plan will update once Revolut confirms
          (usually within a minute).
        </div>
      )}
      {paid === "0" && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 text-[14px] text-rose-900">
          Payment didn&apos;t go through. Your plan is unchanged — try again
          below.
        </div>
      )}

      <section className="rounded-2xl bg-white border border-mist/80 p-6 md:p-8 space-y-4">
        <header>
          <h2 className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
            Current plan
          </h2>
        </header>
        <div className="flex items-baseline justify-between gap-6 flex-wrap">
          <div>
            <p className="text-[24px] font-medium text-ink">
              {currentPlan?.name ?? "Free"}
            </p>
            <p className="text-[13px] text-deep/60">
              {currentPlan && currentPlan.monthly_price_cents > 0
                ? `£${(currentPlan.monthly_price_cents / 100).toFixed(2)} / month`
                : "No charge"}
            </p>
          </div>
          <PlanLimitsSummary plan={currentPlan} />
        </div>
      </section>

      <PlanPicker plans={plans} currentPlanId={currentPlan?.id ?? "free"} />

      <InvoicesTable invoices={invoices} />
    </div>
  );
}

function PlanLimitsSummary({ plan }: { plan: Plan | null }) {
  if (!plan) return null;
  return (
    <ul className="text-[13px] text-deep/70 space-y-1 text-right">
      <li>{plan.max_inboxes_per_business} inboxes / business</li>
      <li>
        {plan.max_conversations_per_month.toLocaleString()} conversations /
        month
      </li>
    </ul>
  );
}
