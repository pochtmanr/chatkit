import Link from "next/link";
import { getServiceClient } from "@/lib/supabase/server";
import { verifyEmbedToken } from "@/lib/embed-auth";

/**
 * Embed-mode inbox list.
 *
 * Auth: signed JWT in the `?token=` query param. No chat-admin login
 * required — the host (e.g. GoDelivery admin) signs the JWT and the
 * iframe URL carries it.
 *
 * No sidebar, no header chrome — meant to be iframed inside another
 * admin panel that already has its own navigation. The host sets the
 * outer chrome; we just render the inbox content.
 */
export default async function EmbedInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    return <EmbedError message="Missing token." />;
  }
  let session: ReturnType<typeof verifyEmbedToken>;
  try {
    session = verifyEmbedToken(token);
  } catch (err) {
    return (
      <EmbedError
        message={`Authentication failed: ${err instanceof Error ? err.message : "invalid token"}`}
      />
    );
  }

  const service = getServiceClient();
  // Confirm the tenant exists (defense in depth — JWT could be forged
  // with a non-existent tenant id, and we'd return empty results
  // instead of an error otherwise, making debugging confusing).
  const { data: tenant } = await service
    .from("tenants")
    .select("id, name")
    .eq("id", session.tenantId)
    .maybeSingle();
  if (!tenant) {
    return <EmbedError message="Tenant not found." />;
  }

  const { data: conversations } = await service
    .from("conversations")
    .select("id, external_ref, last_message, last_at, participants")
    .eq("tenant_id", tenant.id)
    .eq("kind", "support")
    .order("last_at", { ascending: false, nullsFirst: false })
    .limit(50);

  // Look up display names for counterparts in one query.
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
    <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <div className="p-4">
        {!conversations || conversations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center">
            <p className="text-sm text-zinc-500">No conversations yet.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 divide-y divide-zinc-200 dark:divide-zinc-800">
            {conversations.map((c) => {
              const u = c.external_ref ? userByRef.get(c.external_ref) : null;
              const displayName =
                u?.name || u?.email || c.external_ref || c.id.slice(0, 8);
              const lastAt = c.last_at ? new Date(c.last_at) : null;
              return (
                <Link
                  // Preserve the token in the URL so the thread page can
                  // re-verify without needing cookies (iframes have
                  // SameSite cookie pitfalls we side-step here).
                  key={c.id}
                  href={`/embed/inbox/${c.id}?token=${encodeURIComponent(token)}`}
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
    </div>
  );
}

function EmbedError({ message }: { message: string }) {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-8">
      <div className="text-center max-w-md">
        <p className="text-sm font-medium">Unable to load inbox</p>
        <p className="text-xs text-zinc-500 mt-2">{message}</p>
      </div>
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
