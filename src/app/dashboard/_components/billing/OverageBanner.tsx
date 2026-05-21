import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { OverageInfo } from "@/lib/billing-banner";

export function OverageBanner({ info }: { info: OverageInfo }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 md:p-5 flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-amber-700 flex-shrink-0 mt-0.5" />
      <div className="flex-1 space-y-1">
        <p className="text-[14px] font-medium text-amber-900">
          {info.businessName} is over the {info.planId} plan limit
        </p>
        <p className="text-[13px] text-amber-800/80">
          {info.monthCount.toLocaleString()} conversations this month vs.{" "}
          {info.capConversations.toLocaleString()} included. Messages still
          land — upgrade to lift the cap.
        </p>
      </div>
      <Link
        href="/dashboard/settings/billing"
        className="rounded-full bg-ink text-white px-4 py-2 text-[13px] font-medium hover:bg-deep transition-colors"
      >
        Upgrade
      </Link>
    </div>
  );
}
