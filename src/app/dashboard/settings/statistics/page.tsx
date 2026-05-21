import Link from "next/link";
import { requireActiveContext } from "@/lib/active-context";
import {
  getBusinessStats,
  type StatsRange,
} from "@/app/dashboard/_actions/statistics";

const RANGES: { id: StatsRange; label: string }[] = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
  { id: "all", label: "All time" },
];

export default async function SettingsStatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const ctx = await requireActiveContext();
  const { range: rangeParam } = await searchParams;
  const range = (RANGES.find((r) => r.id === rangeParam)?.id ??
    "30d") as StatsRange;

  const stats = await getBusinessStats(ctx.business.id, range);

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-1.5">
        {RANGES.map((r) => (
          <Link
            key={r.id}
            href={`/dashboard/settings/statistics?range=${r.id}`}
            className={
              (range === r.id
                ? "bg-ink text-white border-ink"
                : "bg-white text-ink border-mist hover:bg-mist/40") +
              " inline-flex items-center rounded-full border px-3 py-1.5 text-[13px] transition-colors"
            }
          >
            {r.label}
          </Link>
        ))}
      </nav>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile
          label="Conversations created"
          value={stats.conversationsCreated}
        />
        <Tile label="Resolved" value={stats.conversationsResolved} />
        <Tile label="Inbound messages" value={stats.inboundMessages} />
        <Tile label="Outbound messages" value={stats.outboundMessages} />
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Tile
          label="Median resolution"
          value={
            stats.medianResolutionHours === null
              ? "—"
              : `${stats.medianResolutionHours}h`
          }
        />
        <Tile
          label="Avg first response"
          value={
            stats.averageFirstResponseMinutes === null
              ? "—"
              : `${stats.averageFirstResponseMinutes}m`
          }
          hint="Computed in a future round"
        />
        <Tile label="Active inboxes" value={stats.activeInboxes} />
      </section>

      <section className="rounded-2xl bg-white border border-mist/80 overflow-hidden">
        <header className="px-5 py-4 border-b border-mist">
          <h2 className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
            Per-inbox breakdown
          </h2>
        </header>
        <table className="w-full text-left text-[14px]">
          <thead className="bg-white border-b border-mist">
            <tr className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
              <th className="px-5 py-2.5">Inbox</th>
              <th className="px-5 py-2.5 text-right">Conversations</th>
              <th className="px-5 py-2.5 text-right">Messages</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mist">
            {stats.perInbox.map((row) => (
              <tr key={row.inboxId}>
                <td className="px-5 py-3">
                  <Link
                    href={`/dashboard/inboxes/${row.inboxId}/edit`}
                    className="text-ink hover:underline"
                  >
                    {row.inboxName}
                  </Link>
                </td>
                <td className="px-5 py-3 text-right text-deep/80 tabular-nums">
                  {row.conversations}
                </td>
                <td className="px-5 py-3 text-right text-deep/80 tabular-nums">
                  {row.messages}
                </td>
              </tr>
            ))}
            {stats.perInbox.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-5 py-6 text-[13px] text-deep/60"
                >
                  No active inboxes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl bg-white border border-mist/80 p-5">
      <p className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
        {label}
      </p>
      <p className="mt-2 text-[28px] font-medium text-ink tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-1 text-[12px] text-deep/60">{hint}</p>}
    </div>
  );
}
