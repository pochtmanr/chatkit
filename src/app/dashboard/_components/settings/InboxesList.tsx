"use client";

import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { LABELS } from "@/lib/onboarding/enums";
import type { ProjectGroup } from "@/lib/active-context";

export function InboxesList({ groups }: { groups: ProjectGroup[] }) {
  return (
    <section className="space-y-4">
      <h2 className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
        Inboxes
      </h2>
      {groups.map((g) => (
        <div key={g.project.id} className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[14px] font-medium text-ink">
              {g.project.name}
            </h3>
            <Link
              href={`/dashboard/inboxes/new?projectId=${g.project.id}`}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-deep hover:text-ink transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New inbox
            </Link>
          </div>
          <div className="rounded-2xl bg-white border border-mist/80 divide-y divide-mist overflow-hidden">
            {g.inboxes.map((ib) => (
              <Link
                key={ib.id}
                href={`/dashboard/inboxes/${ib.id}/edit`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-mist/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium text-ink truncate">
                    {ib.name}
                  </div>
                  <div className="text-[12px] text-deep/60">
                    {LABELS.purpose[
                      ib.purpose as keyof typeof LABELS.purpose
                    ] ?? ib.purpose}
                    {" · "}
                    {LABELS.audience[
                      ib.audience as keyof typeof LABELS.audience
                    ] ?? ib.audience}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-deep/40" />
              </Link>
            ))}
            {g.inboxes.length === 0 && (
              <div className="px-5 py-6 text-[13px] text-deep/60">
                No inboxes in this project.
              </div>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
