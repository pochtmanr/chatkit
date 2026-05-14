import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerClient, getServiceClient } from "@/lib/supabase/server";

/**
 * Inbox — list of support conversations for the signed-in tenant.
 *
 * Ordered by `last_at` desc so the most recently active conversation
 * sits at the top. Each row links to /dashboard/inbox/[id] which
 * renders the thread + reply box.
 *
 * Why service client for the data fetch: the dashboard user owns the
 * tenant but RLS would otherwise need a per-row policy mapping
 * `conversations.tenant_id` -> `tenants.owner_user_id`. Simpler to
 * scope server-side here.
 */
export default async function InboxPage() {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);
  const tenant = tenants?.[0];
  if (!tenant) {
    return (
      <div className="text-sm text-zinc-500">
        No tenant found. <Link href="/dashboard">Go back</Link>.
      </div>
    );
  }

  const service = getServiceClient();
  const { data: conversations } = await service
    .from("conversations")
    .select("id, external_ref, last_message, last_at, participants, updated_at")
    .eq("tenant_id", tenant.id)
    .eq("kind", "support")
    .order("last_at", { ascending: false, nullsFirst: false })
    .limit(50);

  // Pull display names for each conversation's counterpart (the non-admin
  // participant). External_ref is the canonical user id we use to look
  // up chat_users.
  const refs = (conversations ?? [])
    .map((c) => c.external_ref)
    .filter((v): v is string => !!v);
  const { data: usersData } = refs.length
    ? await service
        .from("chat_users")
        .select("user_id, name, email")
        .eq("tenant_id", tenant.id)
        .in("user_id", refs)
    : { data: [] };
  const userByRef = new Map<string, { name: string | null; email: string | null }>();
  (usersData ?? []).forEach((u) => {
    userByRef.set(u.user_id, { name: u.name, email: u.email });
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Customer conversations for {tenant.name}. Click a row to reply.
        </p>
      </div>

      {!conversations || conversations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center">
          <p className="text-sm text-zinc-500">No conversations yet.</p>
          <p className="text-xs text-zinc-400 mt-1">
            They&apos;ll appear here as your customers start chatting from the SDK.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 divide-y divide-zinc-200 dark:divide-zinc-800">
          {conversations
            .filter((c) => {
              const u = c.external_ref ? userByRef.get(c.external_ref) : null;
              return !!(
                (u?.name && u.name.trim()) ||
                (u?.email && u.email.trim())
              );
            })
            .map((c) => {
            const u = c.external_ref ? userByRef.get(c.external_ref) : null;
            const displayName = u?.name || u?.email || "Unknown";
            const lastAt = c.last_at ? new Date(c.last_at) : null;
            return (
              <Link
                key={c.id}
                href={`/dashboard/inbox/${c.id}`}
                className="flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition"
              >
                <div className="h-9 w-9 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs font-medium text-zinc-600 dark:text-zinc-400 shrink-0">
                  {displayName.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium truncate">{displayName}</span>
                    {lastAt && (
                      <span className="text-xs text-zinc-500 shrink-0">
                        {formatRelativeTime(lastAt)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-500 truncate mt-0.5">
                    {c.last_message || <span className="italic">No messages yet</span>}
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

/** Lightweight relative time. Avoids pulling in date-fns for a single use. */
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
