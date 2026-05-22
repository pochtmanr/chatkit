"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Download, Trash2 } from "lucide-react";
import {
  requestBusinessDeletion,
  requestAccountDeletion,
  cancelDeletionRequest,
  requestDataExport,
} from "@/app/dashboard/_actions/account";
import type { TeamRole } from "@/lib/team";

type DeletionRequest = {
  id: string;
  kind: "business_data" | "account";
  business_id: string | null;
  scheduled_at: string;
  requested_at: string;
  cancelled_at: string | null;
  executed_at: string | null;
};

type ExportRequest = {
  id: string;
  business_id: string;
  status: "queued" | "ready" | "failed" | "expired";
  download_url: string | null;
  ready_at: string | null;
  expires_at: string | null;
  error: string | null;
  created_at: string;
};

export function AccountSection({
  businessId,
  businessName,
  myRole,
  deletionRequests,
  exportRequests,
}: {
  businessId: string;
  businessName: string;
  myRole: TeamRole;
  deletionRequests: DeletionRequest[];
  exportRequests: ExportRequest[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const activeBusinessDel = deletionRequests.find(
    (r) =>
      r.kind === "business_data" &&
      r.business_id === businessId &&
      !r.cancelled_at &&
      !r.executed_at,
  );
  const activeAccountDel = deletionRequests.find(
    (r) => r.kind === "account" && !r.cancelled_at && !r.executed_at,
  );

  function onExport() {
    setError(null);
    startTransition(async () => {
      const res = await requestDataExport(businessId);
      if (!res.ok) setError(res.error);
    });
  }

  function onDeleteBusiness() {
    if (
      !confirm(
        `Schedule ${businessName} for deletion in 30 days? You can cancel any time during that window.`,
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await requestBusinessDeletion(businessId);
      if (!res.ok) setError(res.error);
    });
  }

  function onDeleteAccount() {
    if (
      !confirm(
        "Schedule your entire account for deletion in 30 days? Cancellable during that window.",
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await requestAccountDeletion();
      if (!res.ok) setError(res.error);
    });
  }

  function onCancel(id: string) {
    startTransition(async () => {
      const res = await cancelDeletionRequest(id);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-white border border-mist/80 p-6 md:p-8 space-y-3">
        <h2 className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
          Data export
        </h2>
        <p className="text-[13px] text-deep/70 max-w-3xl">
          Request a JSON dump of everything in {businessName}: businesses,
          projects, inboxes, conversations, messages, end-users, billing
          history. We&apos;ll email you a download link when it&apos;s ready
          (typically within 24 hours). The link expires in 7 days.
        </p>
        {myRole === "owner" || myRole === "manager" ? (
          <button
            type="button"
            onClick={onExport}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-full bg-ink text-white px-4 py-2 text-[14px] font-medium hover:bg-deep transition-colors disabled:opacity-60"
          >
            <Download className="h-3.5 w-3.5" />
            Request export
          </button>
        ) : (
          <p className="text-[13px] text-deep/60">
            Only owners + leads can request exports.
          </p>
        )}
        {exportRequests.length > 0 && (
          <ul className="text-[13px] text-deep/70 space-y-1.5 mt-3">
            {exportRequests.map((r) => (
              <li key={r.id} className="flex items-center gap-3">
                <span>{new Date(r.created_at).toLocaleString()} —</span>
                <span className="capitalize">{r.status}</span>
                {r.status === "ready" && r.download_url && (
                  <a
                    href={r.download_url}
                    className="text-deep hover:text-ink underline"
                  >
                    Download
                  </a>
                )}
                {r.status === "failed" && r.error && (
                  <span className="text-red-700">({r.error})</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-red-200 bg-red-50/40 p-6 md:p-8 space-y-3">
        <header className="flex items-center gap-2 text-red-800">
          <AlertTriangle className="h-4 w-4" />
          <h2 className="text-[14px] font-medium">Delete this business</h2>
        </header>
        <p className="text-[13px] text-red-700/80 max-w-3xl">
          Schedules a hard delete of <strong>{businessName}</strong> and every
          conversation, message, inbox, project, and end-user under it. 30-day
          grace period; you can cancel any time.
        </p>
        {activeBusinessDel ? (
          <div className="flex items-center justify-between rounded-2xl border border-red-200 bg-white p-4">
            <p className="text-[13px] text-red-800">
              Scheduled for deletion on{" "}
              <strong>
                {new Date(activeBusinessDel.scheduled_at).toLocaleDateString()}
              </strong>
              .
            </p>
            <button
              type="button"
              onClick={() => onCancel(activeBusinessDel.id)}
              disabled={pending}
              className="rounded-full bg-white border border-mist px-4 py-2 text-[14px] font-medium text-ink hover:bg-mist/40 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          myRole === "owner" && (
            <button
              type="button"
              onClick={onDeleteBusiness}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-[14px] font-medium text-red-700 hover:bg-red-100 transition-colors disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete this business
            </button>
          )
        )}
      </section>

      <section className="rounded-2xl border border-red-200 bg-red-50/40 p-6 md:p-8 space-y-3">
        <header className="flex items-center gap-2 text-red-800">
          <AlertTriangle className="h-4 w-4" />
          <h2 className="text-[14px] font-medium">Delete your account</h2>
        </header>
        <p className="text-[13px] text-red-700/80 max-w-3xl">
          Schedules a hard delete of your entire account, every business you
          own, and your sign-in. 30-day grace period; cancellable.
        </p>
        {activeAccountDel ? (
          <div className="flex items-center justify-between rounded-2xl border border-red-200 bg-white p-4">
            <p className="text-[13px] text-red-800">
              Account scheduled for deletion on{" "}
              <strong>
                {new Date(activeAccountDel.scheduled_at).toLocaleDateString()}
              </strong>
              .
            </p>
            <button
              type="button"
              onClick={() => onCancel(activeAccountDel.id)}
              disabled={pending}
              className="rounded-full bg-white border border-mist px-4 py-2 text-[14px] font-medium text-ink hover:bg-mist/40 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onDeleteAccount}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-[14px] font-medium text-red-700 hover:bg-red-100 transition-colors disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete my account
          </button>
        )}
      </section>

      {error && <p className="text-[13px] text-red-700">{error}</p>}
    </div>
  );
}
