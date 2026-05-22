"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import type { SessionRow } from "@/lib/agent-sessions";

type AgentRow = {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: "agent" | "manager";
  status: "online" | "away" | "offline";
  sessions: SessionRow[];
  onlineSeconds: number;
  claims: number;
};

type Stats = {
  onlineNow: number;
  awayNow: number;
  offlineNow: number;
  avgOnlineSeconds: number;
  teamSize: number;
};

type Props = {
  businessName: string;
  dayIso: string;
  fromIso: string;
  toIso: string;
  nowIso: string;
  stats: Stats;
  rows: AgentRow[];
};

export function TeamTimeline({
  businessName,
  dayIso,
  fromIso,
  toIso,
  nowIso,
  stats,
  rows,
}: Props) {
  const router = useRouter();
  // Local clock so the now-marker on the strip advances without a refresh.
  // The lint rule for purity flags `Date.now()` in render — keep it in
  // state and re-tick it every 30s.
  const [liveNow, setLiveNow] = useState<number>(() => Date.parse(nowIso));
  useEffect(() => {
    const id = setInterval(() => setLiveNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = todayYmd(today);
  const isToday = dayIso === todayIso;

  function navigate(deltaDays: number) {
    const [y, m, d] = dayIso.split("-").map(Number);
    const next = new Date(y, (m ?? 1) - 1, d ?? 1);
    next.setDate(next.getDate() + deltaDays);
    next.setHours(0, 0, 0, 0);
    if (next.getTime() > today.getTime()) return;
    router.push(`/dashboard/team?day=${todayYmd(next)}`);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
            Team
          </p>
          <h1 className="text-[24px] font-semibold text-ink mt-1">
            Live activity · {businessName}
          </h1>
          <p className="text-[13px] text-deep/70 mt-1 max-w-2xl">
            Who&apos;s on shift right now and how the day looked. Auto-refreshes
            when you flip to a new day. To invite or archive, head to{" "}
            <Link
              href="/dashboard/settings/team"
              className="text-deep underline hover:text-ink"
            >
              Settings → Team
            </Link>
            .
          </p>
        </div>

        <div className="flex items-center gap-1 bg-white border border-mist/80 rounded-full px-1 py-1">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Previous day"
            className="h-7 w-7 grid place-items-center rounded-full hover:bg-mist/40 text-deep"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="px-2 text-[13px] font-medium text-ink min-w-[100px] text-center">
            {formatDayLabel(dayIso, isToday)}
          </span>
          <button
            type="button"
            onClick={() => navigate(1)}
            disabled={isToday}
            aria-label="Next day"
            className="h-7 w-7 grid place-items-center rounded-full hover:bg-mist/40 text-deep disabled:opacity-30"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* Summary stats. */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Online now"
          value={String(stats.onlineNow)}
          dot="bg-emerald-500"
        />
        <StatCard
          label="Away now"
          value={String(stats.awayNow)}
          dot="bg-amber-400"
        />
        <StatCard
          label="Offline now"
          value={String(stats.offlineNow)}
          dot="bg-zinc-400"
        />
        <StatCard
          label="Avg online today"
          value={formatHours(stats.avgOnlineSeconds)}
        />
      </section>

      {/* Per-agent timeline rows. */}
      <section className="rounded-2xl bg-white border border-mist/80 overflow-hidden">
        <header className="px-6 py-4 border-b border-mist/80 flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-deep/60" />
          <p className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
            Team timeline · {stats.teamSize} member
            {stats.teamSize === 1 ? "" : "s"}
          </p>
        </header>
        {rows.length === 0 ? (
          <div className="px-6 py-10 text-[13px] text-deep/60">
            No accepted teammates yet. Invite someone from{" "}
            <Link
              href="/dashboard/settings/team"
              className="text-deep underline hover:text-ink"
            >
              Settings → Team
            </Link>
            .
          </div>
        ) : (
          <ul className="divide-y divide-mist/70">
            {rows.map((row) => (
              <AgentTimelineRow
                key={row.id}
                row={row}
                fromIso={fromIso}
                toIso={toIso}
                liveNow={liveNow}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  dot,
}: {
  label: string;
  value: string;
  dot?: string;
}) {
  return (
    <div className="rounded-2xl bg-white border border-mist/80 p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-deep/50">
        {dot && <span className={`h-2 w-2 rounded-full ${dot}`} />}
        <span>{label}</span>
      </div>
      <p className="text-[24px] font-semibold text-ink mt-2 tabular-nums">
        {value}
      </p>
    </div>
  );
}

function AgentTimelineRow({
  row,
  fromIso,
  toIso,
  liveNow,
}: {
  row: AgentRow;
  fromIso: string;
  toIso: string;
  liveNow: number;
}) {
  const start = Date.parse(fromIso);
  const end = Date.parse(toIso);
  const span = end - start;
  const dot = statusDotClass(row.status);

  return (
    <li className="px-6 py-4 flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-3 min-w-[200px]">
        <AvatarChip url={row.avatarUrl} name={row.displayName} />
        <div className="min-w-0">
          <p className="text-[14px] text-ink truncate flex items-center gap-2">
            {row.displayName}
            <span className={`h-2 w-2 rounded-full ${dot}`} />
          </p>
          <p className="text-[11.5px] text-deep/60 capitalize">
            {row.role} · {row.claims} claim{row.claims === 1 ? "" : "s"} today
          </p>
        </div>
      </div>

      <div className="flex-1 min-w-[260px]">
        <div className="relative h-6 w-full rounded-md bg-mist/40 overflow-hidden">
          {row.sessions.map((s) => {
            const segStart = Math.max(Date.parse(s.started_at), start);
            const segEnd = Math.min(
              s.ended_at ? Date.parse(s.ended_at) : liveNow,
              end,
            );
            if (segEnd <= segStart) return null;
            const left = ((segStart - start) / span) * 100;
            const width = ((segEnd - segStart) / span) * 100;
            const isOpen = !s.ended_at;
            return (
              <div
                key={s.id}
                title={
                  isOpen
                    ? `Online since ${formatTime(s.started_at)}`
                    : `${formatTime(s.started_at)} – ${formatTime(s.ended_at!)}`
                }
                className={`absolute top-0 bottom-0 ${
                  isOpen ? "bg-emerald-500" : "bg-emerald-400/80"
                }`}
                style={{ left: `${left}%`, width: `${width}%` }}
              />
            );
          })}
          {liveNow > start && liveNow < end && (
            <div
              aria-hidden
              className="absolute top-0 bottom-0 w-px bg-ink/40"
              style={{ left: `${((liveNow - start) / span) * 100}%` }}
            />
          )}
        </div>
        <div className="flex items-center justify-between mt-1 text-[10px] text-deep/50">
          <span>00:00</span>
          <span>06:00</span>
          <span>12:00</span>
          <span>18:00</span>
          <span>24:00</span>
        </div>
      </div>

      <div className="min-w-[80px] text-right">
        <p className="text-[15px] font-medium text-ink tabular-nums">
          {formatHours(row.onlineSeconds)}
        </p>
        <p className="text-[11px] text-deep/60">online</p>
      </div>
    </li>
  );
}

function AvatarChip({ url, name }: { url: string | null; name: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="h-9 w-9 rounded-full object-cover border border-mist shrink-0"
      />
    );
  }
  const initial = (name.trim().charAt(0) || "?").toUpperCase();
  return (
    <div className="h-9 w-9 rounded-full bg-mist/60 border border-mist grid place-items-center text-[13px] font-medium text-deep shrink-0">
      {initial}
    </div>
  );
}

function statusDotClass(status: AgentRow["status"]): string {
  if (status === "online") return "bg-emerald-500";
  if (status === "away") return "bg-amber-400";
  return "bg-zinc-400";
}

function formatHours(seconds: number): string {
  if (seconds <= 0) return "0m";
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  if (hours <= 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDayLabel(dayIso: string, isToday: boolean): string {
  if (isToday) return "Today";
  const [y, m, d] = dayIso.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
}

function todayYmd(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
