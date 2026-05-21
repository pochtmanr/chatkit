"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { requestRevolutCheckout } from "@/app/dashboard/_actions/billing";
import type { Plan } from "@/lib/plans";

export function PlanPicker({
  plans,
  currentPlanId,
}: {
  plans: Plan[];
  currentPlanId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);

  function upgrade(planId: string) {
    setError(null);
    setPendingPlanId(planId);
    startTransition(async () => {
      const res = await requestRevolutCheckout(planId);
      if (!res.ok) {
        setPendingPlanId(null);
        setError(res.error);
        return;
      }
      window.location.assign(res.checkoutUrl);
    });
  }

  return (
    <section className="space-y-3">
      <h2 className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
        Change plan
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((p) => {
          const isCurrent = p.id === currentPlanId;
          const isFree = p.monthly_price_cents <= 0;
          return (
            <div
              key={p.id}
              className="rounded-2xl bg-white border border-mist/80 p-5 space-y-3 flex flex-col"
            >
              <div className="space-y-1">
                <p className="text-[18px] font-medium text-ink">{p.name}</p>
                <p className="text-[13px] text-deep/70">
                  {isFree
                    ? "No charge"
                    : `£${(p.monthly_price_cents / 100).toFixed(2)} / month`}
                </p>
              </div>
              <ul className="text-[13px] text-deep/70 space-y-1 flex-1">
                <li>{p.max_inboxes_per_business} inboxes / business</li>
                <li>
                  {p.max_conversations_per_month.toLocaleString()} conversations
                  / month
                </li>
              </ul>
              <button
                type="button"
                disabled={pending || isCurrent || isFree}
                onClick={() => upgrade(p.id)}
                className={
                  (isCurrent
                    ? "bg-mist/40 text-deep/60 border border-mist cursor-not-allowed"
                    : isFree
                      ? "bg-white text-deep/50 border border-mist cursor-not-allowed"
                      : "bg-ink text-white border-ink hover:bg-deep") +
                  " w-full rounded-full px-4 py-2 text-[14px] font-medium border transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
                }
              >
                {pending && pendingPlanId === p.id && (
                  <Loader2 className="h-3 w-3 animate-spin" />
                )}
                {isCurrent
                  ? "Current plan"
                  : isFree
                    ? "Downgrade via support"
                    : "Upgrade"}
              </button>
            </div>
          );
        })}
      </div>
      {error && <p className="text-[13px] text-red-700">{error}</p>}
    </section>
  );
}
