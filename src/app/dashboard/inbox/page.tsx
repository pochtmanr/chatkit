import Link from "next/link";
import { requireActiveContext } from "@/lib/active-context";
import { getServiceClient } from "@/lib/supabase/server";
import { LABELS } from "@/lib/onboarding/enums";
import { Avatar } from "@/app/dashboard/_components/shared/Avatar";
import { StatusPill } from "@/app/dashboard/_components/ui/StatusPill";
import {
  CONVERSATION_STATUSES,
  type ConversationStatus,
} from "@/lib/conversation-status";

const FILTER_OPTIONS: { id: "open" | ConversationStatus; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "new", label: "New" },
  { id: "active", label: "Active" },
  { id: "waiting_customer", label: "Waiting on customer" },
  { id: "waiting_support", label: "Waiting on us" },
  { id: "done", label: "Done" },
  { id: "transferred", label: "Transferred" },
];

function resolveFilter(raw: string | undefined): "open" | ConversationStatus {
  if (!raw) return "open";
  if (raw === "open") return "open";
  return (CONVERSATION_STATUSES as readonly string[]).includes(raw)
    ? (raw as ConversationStatus)
    : "open";
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const ctx = await requireActiveContext();
  const sp = await searchParams;
  const currentFilter = resolveFilter(sp.filter);
  const service = getServiceClient();

  let q = service
    .from("conversations")
    .select(
      "id, external_ref, last_message, last_at, status, status_updated_at, participants, updated_at",
    )
    .eq("tenant_id", ctx.business.id)
    .eq("inbox_id", ctx.inbox.id)
    .eq("kind", "support")
    .order("status_updated_at", { ascending: false, nullsFirst: false })
    .limit(50);

  if (currentFilter === "open") {
    q = q.neq("status", "done");
  } else {
    q = q.eq("status", currentFilter);
  }

  const { data: conversations } = await q;

  const refs = (conversations ?? [])
    .map((c) => c.external_ref)
    .filter((v): v is string => !!v);
  const { data: usersData } = refs.length
    ? await service
        .from("chat_users")
        .select("user_id, name, email")
        .eq("tenant_id", ctx.business.id)
        .in("user_id", refs)
    : { data: [] };
  const userByRef = new Map<
    string,
    { name: string | null; email: string | null }
  >();
  (usersData ?? []).forEach((u) =>
    userByRef.set(u.user_id, { name: u.name, email: u.email }),
  );

  const filteredConversations = (conversations ?? []).filter((c) => {
    const u = c.external_ref ? userByRef.get(c.external_ref) : null;
    return !!(
      (u?.name && u.name.trim()) ||
      (u?.email && u.email.trim())
    );
  });

  const purposeLabel =
    LABELS.purpose[ctx.inbox.purpose as keyof typeof LABELS.purpose] ??
    ctx.inbox.purpose;
  const audienceLabel =
    LABELS.audience[ctx.inbox.audience as keyof typeof LABELS.audience] ??
    ctx.inbox.audience;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-[14px] font-medium text-deep/60">Conversations</p>
        <h1 className="text-3xl sm:text-4xl tracking-tight text-ink leading-[1] font-normal">
          All your{" "}
          <span className="font-serif-italic font-normal text-deep">
            conversations<span className="text-deep/40">.</span>
          </span>
        </h1>
        <p className="text-deep/70 leading-relaxed text-[15px] font-normal max-w-[640px]">
          You&apos;re viewing{" "}
          <span className="font-medium text-ink">{ctx.inbox.name}</span> (
          {purposeLabel}) inside{" "}
          <span className="font-medium text-ink">{ctx.business.name}</span>.
          {ctx.inboxes.length > 1
            ? " Switch inbox in the sidebar to see another."
            : ""}
        </p>
      </header>

      <div className="inline-flex items-center gap-2 rounded-full bg-mist/60 border border-mist px-3 py-1 text-[12px] text-deep/70">
        <span className="h-1.5 w-1.5 rounded-full bg-deep/50" />
        Replying as{" "}
        <span className="font-medium text-ink">{ctx.business.name}</span>
        <span className="text-deep/30">·</span>
        Audience: {audienceLabel}
      </div>

      <nav className="flex flex-wrap gap-1.5" aria-label="Status filter">
        {FILTER_OPTIONS.map((f) => {
          const active = currentFilter === f.id;
          return (
            <Link
              key={f.id}
              href={
                f.id === "open"
                  ? "/dashboard/inbox"
                  : `/dashboard/inbox?filter=${f.id}`
              }
              aria-current={active ? "page" : undefined}
              className={
                (active
                  ? "bg-ink text-white border-ink"
                  : "bg-white text-ink border-mist hover:bg-mist/40") +
                " inline-flex items-center rounded-full border px-3 py-1.5 text-[13px] transition-colors"
              }
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      {filteredConversations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-mist bg-white/50 p-12 text-center space-y-2">
          <p className="text-[15px] text-ink">No conversations yet.</p>
          <p className="text-[13px] text-deep/60">
            They&apos;ll appear here as your customers start chatting from the
            SDK using{" "}
            <span className="font-medium text-ink">{ctx.inbox.name}</span>
            &apos;s API key.
          </p>
          <Link
            href="/dashboard/api-keys"
            className="inline-block mt-2 text-[13px] font-medium text-deep underline hover:text-ink transition-colors"
          >
            Get the API key
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-mist/80 shadow-[0_1px_2px_rgba(11,11,11,0.04)] divide-y divide-mist overflow-hidden">
          {filteredConversations.map((c) => {
            const u = c.external_ref ? userByRef.get(c.external_ref) : null;
            const displayName = u?.name || u?.email || "Unknown";
            const lastAt = c.last_at ? new Date(c.last_at) : null;
            const status = c.status as ConversationStatus;
            return (
              <Link
                key={c.id}
                href={`/dashboard/inbox/${c.id}`}
                className="flex items-start gap-3.5 px-5 py-4 hover:bg-mist/30 transition-colors"
              >
                <Avatar name={displayName} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[14px] font-medium text-ink truncate">
                      {displayName}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {lastAt && (
                        <span className="text-[12px] text-deep/50">
                          {formatRelativeTime(lastAt)}
                        </span>
                      )}
                      <StatusPill status={status} />
                    </div>
                  </div>
                  <p className="text-[13px] text-deep/70 truncate mt-0.5">
                    {c.last_message || (
                      <span className="italic text-deep/40">
                        No messages yet
                      </span>
                    )}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(d: Date): string {
  const now = Date.now();
  const diffMs = now - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString();
}
