import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getServiceClient } from "@/lib/supabase/server";
import { verifyEmbedKey } from "@/lib/embed-auth";
import { ThreadView } from "@/app/dashboard/inbox/[id]/ThreadView";

/**
 * Embed-mode thread view.
 *
 * Same auth as /embed/inbox: tenant API key in `?key=` + Origin/Referer
 * check. The key is forwarded to ThreadView so the reply POST carries
 * it in the Authorization header.
 */
export default async function EmbedThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  const { id } = await params;
  const { key } = await searchParams;
  let session;
  try {
    session = await verifyEmbedKey(key);
  } catch (err) {
    return (
      <EmbedError
        message={`Authentication failed: ${err instanceof Error ? err.message : "invalid"}`}
      />
    );
  }

  const service = getServiceClient();
  // Tenant scope check: the conversation must belong to the tenant the
  // JWT claims. Stops a forged JWT with one tenant from reading
  // another tenant's conversation.
  const { data: conv } = await service
    .from("conversations")
    .select("id, tenant_id, external_ref, kind")
    .eq("id", id)
    .eq("tenant_id", session.tenantId)
    .maybeSingle();
  if (!conv) return <EmbedError message="Conversation not found." />;

  // Counterpart for the header.
  const { data: counterpart } = conv.external_ref
    ? await service
        .from("chat_users")
        .select("user_id, name, email")
        .eq("tenant_id", conv.tenant_id)
        .eq("user_id", conv.external_ref)
        .maybeSingle()
    : { data: null };
  const displayName =
    counterpart?.name ||
    counterpart?.email ||
    conv.external_ref ||
    conv.id.slice(0, 8);

  const { data: rows } = await service
    .from("messages")
    .select("id, sender_id, body, message_type, media_url, created_at")
    .eq("conversation_id", conv.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  const initialMessages = (rows ?? []).reverse();

  return (
    <div className="flex flex-col h-dvh bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center gap-3 bg-white dark:bg-zinc-950">
        <Link
          href={`/embed/inbox?key=${encodeURIComponent(key!)}`}
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
            {counterpart?.email || conv.external_ref || "—"}
          </div>
        </div>
      </header>

      <ThreadView
        conversationId={conv.id}
        // No per-admin identity in the API-key model — use a stable
        // sentinel so all admin replies render on the agent side.
        currentUserId="agent"
        initialMessages={initialMessages}
        replyEndpoint={`/api/embed/conversations/${conv.id}/reply`}
        replyAuthToken={key}
      />
    </div>
  );
}

function EmbedError({ message }: { message: string }) {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-8">
      <div className="text-center max-w-md">
        <p className="text-sm font-medium">Unable to load conversation</p>
        <p className="text-xs text-zinc-500 mt-2">{message}</p>
      </div>
    </div>
  );
}
