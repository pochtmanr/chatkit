"use server";

import { revalidatePath } from "next/cache";
import { getServerClient, getServiceClient } from "@/lib/supabase/server";
import type { TablesUpdate } from "@/lib/supabase/database.types";
import {
  CONVERSATION_STATUSES,
  type ConversationStatus,
} from "@/lib/conversation-status";
import { fireConversationStatusChanged } from "@/lib/tenant-webhook";
import { broadcastStatus } from "@/lib/realtime";

type Ok<T = unknown> = { ok: true } & T;
type Err = { ok: false; error: string };
type ActionResult<T = unknown> = Ok<T> | Err;

/**
 * Server-side manual status change. Auto-flips on inbound/outbound
 * live in the message routes themselves (see
 * updateConversationStatusFromMessage). This action is hit by the
 * agent picking a status from the thread-page dropdown.
 *
 * Transfers carry an optional destination inbox (must belong to the
 * same business) and/or a free-text note. Internal transfers move the
 * row's `inbox_id`; external ones just stamp the note.
 */
export async function updateConversationStatus(input: {
  conversationId: string;
  status: ConversationStatus;
  transferredToInboxId?: string;
  transferredNote?: string;
}): Promise<ActionResult> {
  if (!CONVERSATION_STATUSES.includes(input.status)) {
    return { ok: false, error: "invalid status" };
  }

  const sb = await getServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "not signed in" };

  // Manual ownership chain — the conversations RLS doesn't express it
  // for arbitrary user roles. Mirrors the pattern in the dashboard
  // reply route.
  const service = getServiceClient();
  const { data: conv, error: readErr } = await service
    .from("conversations")
    .select(
      "id, status, inbox_id, tenant_id, tenants!inner(owner_user_id)",
    )
    .eq("id", input.conversationId)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  type OwnerRow = {
    id: string;
    status: string;
    inbox_id: string;
    tenant_id: string;
    tenants: { owner_user_id: string };
  };
  const owned = (conv as unknown as OwnerRow | null) ?? null;
  if (!owned || owned.tenants.owner_user_id !== user.id) {
    return { ok: false, error: "conversation not found" };
  }

  const previous = owned.status as ConversationStatus;
  if (
    previous === input.status &&
    input.status !== "transferred" &&
    !input.transferredToInboxId &&
    !input.transferredNote
  ) {
    return { ok: true };
  }

  const patch: TablesUpdate<"conversations"> = {
    status: input.status,
    status_updated_at: new Date().toISOString(),
  };

  if (input.status === "transferred") {
    if (!input.transferredNote && !input.transferredToInboxId) {
      return {
        ok: false,
        error: "transfers need a destination inbox or a note",
      };
    }
    patch.transferred_note = input.transferredNote ?? null;

    if (input.transferredToInboxId) {
      const { data: target } = await service
        .from("inboxes")
        .select("id, business_id")
        .eq("id", input.transferredToInboxId)
        .maybeSingle();
      if (!target || target.business_id !== owned.tenant_id) {
        return {
          ok: false,
          error: "transfer target must be an inbox in the same business",
        };
      }
      patch.inbox_id = target.id;
    }
  } else {
    // Clearing the note on the way out keeps re-entry into the dialog
    // tidy; not strictly required.
    patch.transferred_note = null;
  }

  const { error: updErr } = await service
    .from("conversations")
    .update(patch)
    .eq("id", owned.id);
  if (updErr) return { ok: false, error: updErr.message };

  const changedAt = new Date().toISOString();

  void fireConversationStatusChanged({
    conversationId: owned.id,
    previousStatus: previous,
    newStatus: input.status,
    changedBy: "agent",
    changedByUserId: user.id,
    transferredToInboxId: input.transferredToInboxId,
    transferredNote: input.transferredNote,
  });
  void broadcastStatus(owned.id, {
    previousStatus: previous,
    newStatus: input.status,
    changedAt,
    changedByUserId: user.id,
    transferredToInboxId: input.transferredToInboxId,
    transferredNote: input.transferredNote,
  });

  revalidatePath("/dashboard/inbox");
  revalidatePath(`/dashboard/inbox/${owned.id}`);
  return { ok: true };
}
