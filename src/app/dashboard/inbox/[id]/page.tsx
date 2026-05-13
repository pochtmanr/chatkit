import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { getServerClient, getServiceClient } from "@/lib/supabase/server";
import { ThreadView } from "./ThreadView";

/**
 * Thread page — header + ThreadView client component.
 *
 * The page does the server-side auth + initial data fetch, then hands
 * off to ThreadView (client) which manages realtime subscription, scroll
 * behavior, and the reply input. Splitting it this way avoids hydrating
 * the entire message list as static HTML on every page visit.
 */
export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = getServiceClient();
  // Ownership check + fetch counterpart info in one round-trip.
  const { data: conv } = await service
    .from("conversations")
    .select(
      "id, tenant_id, external_ref, kind, last_message, tenants!inner(owner_user_id, name)",
    )
    .eq("id", id)
    .maybeSingle();
  type ConvRow = {
    id: string;
    tenant_id: string;
    external_ref: string | null;
    kind: string;
    tenants: { owner_user_id: string; name: string };
  };
  const c = conv as unknown as ConvRow | null;
  if (!c || c.tenants.owner_user_id !== user.id) {
    return (
      <div className="text-sm text-zinc-500">
        Conversation not found.{" "}
        <Link href="/dashboard/inbox" className="underline">
          Back to inbox
        </Link>
      </div>
    );
  }

  // Counterpart profile for the header.
  const { data: counterpart } = c.external_ref
    ? await service
        .from("chat_users")
        .select("user_id, name, email")
        .eq("tenant_id", c.tenant_id)
        .eq("user_id", c.external_ref)
        .maybeSingle()
    : { data: null };
  const displayName =
    counterpart?.name ||
    counterpart?.email ||
    c.external_ref ||
    c.id.slice(0, 8);

  // Initial message page — 50 most recent, oldest-first for the UI.
  const { data: rows } = await service
    .from("messages")
    .select("id, sender_id, body, message_type, media_url, created_at")
    .eq("conversation_id", c.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  const initialMessages = (rows ?? []).reverse();

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] -m-8">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-3 flex items-center gap-3 bg-white dark:bg-zinc-950">
        <Link
          href="/dashboard/inbox"
          className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400"
          aria-label="Back to inbox"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="h-9 w-9 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs font-medium text-zinc-600 dark:text-zinc-400">
          {displayName.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{displayName}</div>
          <div className="text-xs text-zinc-500 truncate">
            {counterpart?.email || c.external_ref || "—"}
          </div>
        </div>
      </header>

      <ThreadView
        conversationId={c.id}
        currentUserId={user.id}
        initialMessages={initialMessages}
      />
    </div>
  );
}
