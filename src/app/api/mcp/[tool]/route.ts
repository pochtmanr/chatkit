import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import {
  extractKeyFromAuthHeader,
  prefixOf,
  verifyKey,
} from "@/lib/mcp-keys";
import {
  CONVERSATION_STATUSES,
  type ConversationStatus,
} from "@/lib/conversation-status";

export const runtime = "nodejs";

type ToolContext = { businessId: string };

type AuthOk = { ok: true; ctx: ToolContext };
type AuthErr = { ok: false; status: number; error: string };

async function authenticate(req: NextRequest): Promise<AuthOk | AuthErr> {
  const raw = extractKeyFromAuthHeader(req.headers.get("authorization"));
  if (!raw) {
    return {
      ok: false,
      status: 401,
      error: "missing or malformed Authorization header",
    };
  }

  const admin = getServiceClient();
  const prefix = prefixOf(raw);

  const { data: candidates } = await admin
    .from("mcp_access_keys")
    .select("id, business_id, key_hash")
    .eq("key_prefix", prefix)
    .is("revoked_at", null);

  for (const cand of candidates ?? []) {
    if (await verifyKey(raw, cand.key_hash)) {
      void admin
        .from("mcp_access_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", cand.id);
      return { ok: true, ctx: { businessId: cand.business_id } };
    }
  }
  return { ok: false, status: 401, error: "invalid key" };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tool: string }> },
) {
  const { tool } = await params;
  const auth = await authenticate(req);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine for some tools */
  }

  const admin = getServiceClient();
  const { businessId } = auth.ctx;

  try {
    switch (tool) {
      case "list_businesses": {
        const { data } = await admin
          .from("businesses")
          .select("id, name, slug, current_plan_id")
          .eq("id", businessId);
        return NextResponse.json({ ok: true, data });
      }
      case "list_inboxes": {
        const { data } = await admin
          .from("inboxes")
          .select("id, name, slug, purpose, audience")
          .eq("business_id", businessId)
          .is("archived_at", null)
          .order("name", { ascending: true });
        return NextResponse.json({ ok: true, data });
      }
      case "list_conversations": {
        const inboxId = body.inbox_id as string | undefined;
        const status = body.status as ConversationStatus | undefined;
        const limit = Math.min(Number(body.limit ?? 50) || 50, 200);
        let q = admin
          .from("conversations")
          .select(
            "id, inbox_id, status, last_message, last_at, external_ref, status_updated_at, created_at",
          )
          .eq("tenant_id", businessId)
          .order("status_updated_at", { ascending: false })
          .limit(limit);
        if (inboxId) q = q.eq("inbox_id", inboxId);
        if (status && CONVERSATION_STATUSES.includes(status)) {
          q = q.eq("status", status);
        }
        const { data } = await q;
        return NextResponse.json({ ok: true, data });
      }
      case "get_conversation": {
        const id = body.conversation_id as string | undefined;
        if (!id) {
          return NextResponse.json(
            { ok: false, error: "conversation_id required" },
            { status: 400 },
          );
        }
        const { data: conv } = await admin
          .from("conversations")
          .select(
            "id, inbox_id, status, last_message, last_at, external_ref, transferred_note, created_at, status_updated_at",
          )
          .eq("id", id)
          .eq("tenant_id", businessId)
          .maybeSingle();
        if (!conv) {
          return NextResponse.json(
            { ok: false, error: "not found" },
            { status: 404 },
          );
        }
        const { data: messages } = await admin
          .from("messages")
          .select("id, sender_id, body, message_type, media_url, created_at")
          .eq("conversation_id", id)
          .order("created_at", { ascending: false })
          .limit(50);
        const convRow = conv as Record<string, unknown>;
        return NextResponse.json({
          ok: true,
          data: { ...convRow, messages: (messages ?? []).reverse() },
        });
      }
      case "list_messages": {
        const id = body.conversation_id as string | undefined;
        const limit = Math.min(Number(body.limit ?? 50) || 50, 200);
        if (!id) {
          return NextResponse.json(
            { ok: false, error: "conversation_id required" },
            { status: 400 },
          );
        }
        const { data } = await admin
          .from("messages")
          .select("id, sender_id, body, message_type, media_url, created_at")
          .eq("conversation_id", id)
          .order("created_at", { ascending: false })
          .limit(limit);
        return NextResponse.json({ ok: true, data: (data ?? []).reverse() });
      }
      case "send_reply": {
        const id = body.conversation_id as string | undefined;
        const text = String(body.body ?? "").trim();
        if (!id || !text) {
          return NextResponse.json(
            { ok: false, error: "conversation_id + body required" },
            { status: 400 },
          );
        }

        const { data: conv } = await admin
          .from("conversations")
          .select("id, tenant_id, inbox_id")
          .eq("id", id)
          .eq("tenant_id", businessId)
          .maybeSingle();
        if (!conv) {
          return NextResponse.json(
            { ok: false, error: "not found" },
            { status: 404 },
          );
        }

        const { data: msg, error } = await admin
          .from("messages")
          .insert({
            tenant_id: conv.tenant_id,
            conversation_id: conv.id,
            sender_id: "agent",
            body: text,
            message_type: "text",
          })
          .select("id, created_at")
          .single();
        if (error || !msg) {
          return NextResponse.json(
            { ok: false, error: error?.message ?? "insert failed" },
            { status: 500 },
          );
        }

        await admin
          .from("conversations")
          .update({ last_message: text, last_at: msg.created_at })
          .eq("id", conv.id);

        const { updateConversationStatusFromMessage } = await import(
          "@/lib/conversation-status-server"
        );
        const { fireConversationStatusChanged } = await import(
          "@/lib/tenant-webhook"
        );
        const { broadcastStatus, broadcastMessage } = await import(
          "@/lib/realtime"
        );
        const change = await updateConversationStatusFromMessage({
          conversationId: conv.id,
          direction: "outbound",
        });
        if (change) {
          void fireConversationStatusChanged({
            conversationId: conv.id,
            previousStatus: change.previous,
            newStatus: change.next,
            changedBy: "api",
            changedByUserId: null,
          });
          void broadcastStatus(conv.id, {
            previousStatus: change.previous,
            newStatus: change.next,
            changedAt: new Date().toISOString(),
            changedByUserId: null,
          });
        }
        void broadcastMessage(conv.id, msg);

        return NextResponse.json({
          ok: true,
          data: { message_id: msg.id },
        });
      }
      case "change_status": {
        const id = body.conversation_id as string | undefined;
        const status = body.status as ConversationStatus | undefined;
        if (!id || !status || !CONVERSATION_STATUSES.includes(status)) {
          return NextResponse.json(
            { ok: false, error: "conversation_id + valid status required" },
            { status: 400 },
          );
        }
        const { data: conv } = await admin
          .from("conversations")
          .select("id, status, tenant_id")
          .eq("id", id)
          .eq("tenant_id", businessId)
          .maybeSingle();
        if (!conv) {
          return NextResponse.json(
            { ok: false, error: "not found" },
            { status: 404 },
          );
        }
        const previous = conv.status as ConversationStatus;
        if (previous === status) return NextResponse.json({ ok: true });

        await admin
          .from("conversations")
          .update({ status, status_updated_at: new Date().toISOString() })
          .eq("id", conv.id);

        const { fireConversationStatusChanged } = await import(
          "@/lib/tenant-webhook"
        );
        const { broadcastStatus } = await import("@/lib/realtime");
        void fireConversationStatusChanged({
          conversationId: conv.id,
          previousStatus: previous,
          newStatus: status,
          changedBy: "api",
          changedByUserId: null,
        });
        void broadcastStatus(conv.id, {
          previousStatus: previous,
          newStatus: status,
          changedAt: new Date().toISOString(),
          changedByUserId: null,
        });
        return NextResponse.json({ ok: true });
      }
      case "list_chat_users": {
        const { data } = await admin
          .from("chat_users")
          .select("user_id, name, email, role, last_seen_at")
          .eq("tenant_id", businessId)
          .order("last_seen_at", { ascending: false })
          .limit(200);
        return NextResponse.json({ ok: true, data });
      }
      case "get_stats": {
        const range =
          (body.range as "7d" | "30d" | "90d" | "all" | undefined) ?? "30d";
        const stats = await computeMcpStats(admin, businessId, range);
        return NextResponse.json({ ok: true, data: stats });
      }
      case "search_messages": {
        const query = String(body.query ?? "").trim();
        if (!query) {
          return NextResponse.json(
            { ok: false, error: "query required" },
            { status: 400 },
          );
        }
        const limit = Math.min(Number(body.limit ?? 25) || 25, 100);
        const { data } = await admin
          .from("messages")
          .select("id, conversation_id, sender_id, body, created_at")
          .eq("tenant_id", businessId)
          .ilike("body", `%${query}%`)
          .order("created_at", { ascending: false })
          .limit(limit);
        return NextResponse.json({ ok: true, data });
      }
      default:
        return NextResponse.json(
          { ok: false, error: `unknown tool: ${tool}` },
          { status: 404 },
        );
    }
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "internal error" },
      { status: 500 },
    );
  }
}

type ServiceClient = ReturnType<typeof getServiceClient>;

async function computeMcpStats(
  admin: ServiceClient,
  businessId: string,
  range: "7d" | "30d" | "90d" | "all",
) {
  const sinceIso =
    range === "all"
      ? "1970-01-01T00:00:00Z"
      : new Date(
          Date.now() -
            (range === "7d" ? 7 : range === "30d" ? 30 : 90) *
              24 *
              60 *
              60 *
              1000,
        ).toISOString();

  const [
    { count: conversationsCreated },
    { count: conversationsResolved },
    { count: activeInboxes },
    { data: messageRows },
  ] = await Promise.all([
    admin
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", businessId)
      .gte("created_at", sinceIso),
    admin
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", businessId)
      .eq("status", "done")
      .gte("status_updated_at", sinceIso),
    admin
      .from("inboxes")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .is("archived_at", null),
    admin
      .from("messages")
      .select("sender_id")
      .eq("tenant_id", businessId)
      .gte("created_at", sinceIso),
  ]);

  const total = messageRows ?? [];
  const outboundMessages = total.filter(
    (m) =>
      typeof m.sender_id === "string" &&
      (m.sender_id === "agent" || m.sender_id.startsWith("agent-")),
  ).length;

  return {
    range,
    conversationsCreated: conversationsCreated ?? 0,
    conversationsResolved: conversationsResolved ?? 0,
    inboundMessages: total.length - outboundMessages,
    outboundMessages,
    activeInboxes: activeInboxes ?? 0,
  };
}
