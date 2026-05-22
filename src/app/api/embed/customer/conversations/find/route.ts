import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { authCustomer, assertAllowedKind } from "@/lib/customer-auth";
import type { WidgetKind } from "@/lib/widget-token";

/**
 * GET  /api/embed/customer/conversations/find?external_ref=…&kind=…
 *   Look up a single conversation the JWT subject can access. 404 if
 *   missing.
 *
 * POST /api/embed/customer/conversations/find
 *   Canonical "start conversation" endpoint. Either:
 *     { start_option_id }      — kind + required_skills copied from
 *                                 the row in conversation_start_options.
 *     { external_ref, kind, participants? }
 *
 *   The created conversation's external_ref defaults to claims.sub
 *   when kind is 'support'. For other kinds the caller must supply
 *   one of the values listed in claims.external_refs[kind].
 */

const ALLOWED_KINDS: ReadonlyArray<WidgetKind> = ["support", "order", "direct"];

function isWidgetKind(value: unknown): value is WidgetKind {
  return typeof value === "string" && (ALLOWED_KINDS as readonly string[]).includes(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(request: NextRequest) {
  const auth = await authCustomer(request);
  if (!auth.ok) return auth.response;
  const { session } = auth;
  const sub = session.claims.sub;

  const externalRef = request.nextUrl.searchParams.get("external_ref");
  const kind = request.nextUrl.searchParams.get("kind");
  if (!externalRef) {
    return NextResponse.json({ error: "external_ref required" }, { status: 400 });
  }

  const service = getServiceClient();
  let query = service
    .from("conversations")
    .select("id, kind, external_ref, participants")
    .eq("inbox_id", session.inboxId)
    .eq("external_ref", externalRef)
    .or(`external_ref.eq.${sub},participants.cs.{${sub}}`);
  if (kind) query = query.eq("kind", kind);
  const { data, error } = await query.maybeSingle();
  if (error) return NextResponse.json({ error: "find failed" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ conversation: data });
}

export async function POST(request: NextRequest) {
  const auth = await authCustomer(request);
  if (!auth.ok) return auth.response;
  const { session } = auth;
  const sub = session.claims.sub;

  let payload: {
    start_option_id?: string;
    external_ref?: string;
    kind?: string;
    participants?: string[];
  };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const service = getServiceClient();

  // ── Start-option path ───────────────────────────────────────────────
  // When the caller supplies a start_option_id, the option row is the
  // source of truth for `kind` and `required_skills`. The assignment
  // trigger (prompt 3) reads required_skills off the inserted row.
  let kind: WidgetKind;
  let startOptionId: string | null = null;
  if (payload.start_option_id) {
    if (!isUuid(payload.start_option_id)) {
      return NextResponse.json({ error: "invalid start_option_id" }, { status: 400 });
    }
    const { data: option } = await service
      .from("conversation_start_options")
      .select("id, inbox_id, kind, is_active")
      .eq("id", payload.start_option_id)
      .maybeSingle();
    if (!option || option.inbox_id !== session.inboxId || !option.is_active) {
      return NextResponse.json({ error: "start option not available" }, { status: 404 });
    }
    if (!isWidgetKind(option.kind)) {
      return NextResponse.json({ error: "start option has invalid kind" }, { status: 500 });
    }
    kind = option.kind;
    startOptionId = option.id;
  } else if (isWidgetKind(payload.kind)) {
    kind = payload.kind;
  } else {
    return NextResponse.json({ error: "kind or start_option_id required" }, { status: 400 });
  }

  const kindCheck = assertAllowedKind(session, kind);
  if (!kindCheck.ok) return kindCheck.response;

  // ── external_ref resolution ─────────────────────────────────────────
  // support: implicitly the JWT subject — never let the caller pin a
  // different end user onto their own thread. For order/direct the
  // caller's ref must appear in claims.external_refs[kind] (when that
  // map exists; an absent map means anything goes for non-support kinds).
  let externalRef: string;
  if (kind === "support") {
    externalRef = sub;
  } else {
    const requested = payload.external_ref?.trim();
    if (!requested) {
      return NextResponse.json({ error: "external_ref required" }, { status: 400 });
    }
    const allowedRefs = session.claims.external_refs?.[kind];
    if (allowedRefs && !allowedRefs.includes(requested)) {
      return NextResponse.json({ error: "external_ref not allowed" }, { status: 403 });
    }
    externalRef = requested;
  }

  // Find first — re-opening an existing thread is the common path. For
  // start-option creations we additionally match on start_option_id so
  // two options that share a kind don't collide.
  let findQuery = service
    .from("conversations")
    .select("id, kind, external_ref, start_option_id")
    .eq("inbox_id", session.inboxId)
    .eq("kind", kind)
    .eq("external_ref", externalRef);
  if (startOptionId) findQuery = findQuery.eq("start_option_id", startOptionId);
  const { data: existing } = await findQuery.maybeSingle();
  if (existing) {
    return NextResponse.json({ conversation: existing, created: false });
  }

  // Participant set: support always includes the JWT subject (so list
  // queries that scan participants match). Other kinds honour the
  // caller's array if supplied.
  const requestedParticipants = Array.isArray(payload.participants)
    ? payload.participants.filter((p): p is string => typeof p === "string" && p.length > 0)
    : [];
  let participants: string[];
  if (kind === "support") {
    participants = Array.from(new Set([sub, ...requestedParticipants]));
  } else {
    participants = requestedParticipants.length > 0 ? requestedParticipants : [sub];
  }

  const { data: inserted, error } = await service
    .from("conversations")
    .insert({
      tenant_id: session.tenantId,
      inbox_id: session.inboxId,
      kind,
      external_ref: externalRef,
      participants,
      start_option_id: startOptionId,
    })
    .select("id, kind, external_ref, start_option_id")
    .single();
  if (error || !inserted) {
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }
  return NextResponse.json({ conversation: inserted, created: true });
}
