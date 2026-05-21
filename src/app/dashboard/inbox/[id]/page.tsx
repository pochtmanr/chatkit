import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { getServerClient, getServiceClient } from "@/lib/supabase/server";
import { Avatar } from "@/app/dashboard/_components/shared/Avatar";
import { StatusDropdown } from "@/app/dashboard/_components/ui/StatusDropdown";
import { type ConversationStatus } from "@/lib/conversation-status";
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
      "id, tenant_id, inbox_id, external_ref, kind, last_message, status, transferred_note, tenants!inner(owner_user_id, name)",
    )
    .eq("id", id)
    .maybeSingle();
  type ConvRow = {
    id: string;
    tenant_id: string;
    inbox_id: string;
    external_ref: string | null;
    kind: string;
    status: string;
    transferred_note: string | null;
    tenants: { owner_user_id: string; name: string };
  };
  const c = conv as unknown as ConvRow | null;
  if (!c || c.tenants.owner_user_id !== user.id) {
    return (
      <div className="text-sm text-deep/60">
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

  const { data: inboxRow } = await service
    .from("inboxes")
    .select("name")
    .eq("id", c.inbox_id)
    .maybeSingle();
  const inboxName = inboxRow?.name ?? "Inbox";

  // Sibling inboxes — destinations for an internal transfer.
  const { data: siblingInboxes } = await service
    .from("inboxes")
    .select("id, name")
    .eq("business_id", c.tenant_id)
    .is("archived_at", null)
    .neq("id", c.inbox_id)
    .order("name", { ascending: true });

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
    <div className="flex flex-col h-[calc(100dvh-4rem)] -m-8 md:-m-10">
      <header className="border-b border-mist px-6 py-3 flex items-center gap-3 bg-white">
        <Link
          href="/dashboard/inbox"
          className="p-1.5 rounded-md hover:bg-mist/50 text-deep/70 hover:text-ink transition-colors"
          aria-label="Back to inbox"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <Avatar name={displayName} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-medium text-ink truncate">
            {displayName}
          </div>
          <div className="text-[12px] text-deep/60 truncate">
            {counterpart?.email || c.external_ref || "—"}
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-mist/60 border border-mist px-3 py-1 text-[11px] text-deep/70">
          <span className="h-1.5 w-1.5 rounded-full bg-deep/50" />
          <span className="font-medium text-ink">{inboxName}</span>
        </div>
        <StatusDropdown
          conversationId={c.id}
          currentStatus={c.status as ConversationStatus}
          siblingInboxes={siblingInboxes ?? []}
          currentTransferredNote={c.transferred_note}
        />
        {/* Placeholder for prompt 8 — keeps the header layout stable. */}
        <div data-slot="assignment" />
      </header>

      <ThreadView
        conversationId={c.id}
        currentUserId={user.id}
        initialMessages={initialMessages}
      />
    </div>
  );
}
