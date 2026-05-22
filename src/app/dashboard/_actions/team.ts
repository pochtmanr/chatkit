"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createHash, randomBytes } from "node:crypto";
import { getServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/team";
import {
  getResend,
  getResendFromAddress,
} from "@/lib/email/resend";
import { agentInviteEmail } from "@/lib/email/templates/agent-invite";
import type { Json } from "@/lib/supabase/database.types";

type Ok<T = unknown> = { ok: true } & T;
type Err = { ok: false; error: string };
type ActionResult<T = unknown> = Ok<T> | Err;

const TOKEN_PREFIX = "inv_";
const TOKEN_BYTES = 16;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DISPLAY_NAME_MAX = 80;

async function activeBusinessId(): Promise<string | null> {
  return (await cookies()).get("chatkit_active_biz")?.value ?? null;
}

function isValidEmail(value: string): boolean {
  // Deliberately permissive — Supabase auth is the source of truth for
  // deliverability; we just want to catch obvious garbage.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function generateInviteToken(): { raw: string; hash: string } {
  const raw = TOKEN_PREFIX + randomBytes(TOKEN_BYTES).toString("hex");
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

function siteOrigin(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  return "http://localhost:3000";
}

async function inviterLabel(userId: string): Promise<string> {
  const admin = getServiceClient();
  // We display the inviter's email to the recipient — there's no
  // separate "name" column anywhere else in the system yet. If they
  // also exist in support_agents under any business, prefer that
  // display name (more human).
  const { data: agentRow } = await admin
    .from("support_agents")
    .select("display_name")
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("invited_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (agentRow?.display_name) return agentRow.display_name;

  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  return authUser?.user?.email ?? "A Chatkit teammate";
}

async function sendInviteEmail(args: {
  businessId: string;
  email: string;
  displayName: string;
  role: "agent" | "manager";
  rawToken: string;
  inviterUserId: string;
}): Promise<void> {
  const admin = getServiceClient();
  const { data: biz } = await admin
    .from("businesses")
    .select("name")
    .eq("id", args.businessId)
    .maybeSingle();
  const businessName = biz?.name ?? "your team";
  const inviterName = await inviterLabel(args.inviterUserId);
  const acceptUrl = `${siteOrigin()}/invite/${args.rawToken}`;

  const { subject, html, text } = agentInviteEmail({
    businessName,
    inviterName,
    acceptUrl,
    displayName: args.displayName,
    role: args.role,
  });

  await getResend().emails.send({
    from: getResendFromAddress(),
    to: args.email,
    subject,
    html,
    text,
  });
}

async function logBillingEvent(
  businessId: string,
  kind: string,
  payload: Json,
): Promise<void> {
  const admin = getServiceClient();
  await admin.from("billing_events").insert({
    business_id: businessId,
    kind,
    payload,
  });
}

export async function inviteAgent(
  formData: FormData,
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const role = String(formData.get("role") ?? "agent");

  if (!isValidEmail(email)) {
    return { ok: false, error: "enter a valid email address" };
  }
  if (displayName.length < 1 || displayName.length > DISPLAY_NAME_MAX) {
    return { ok: false, error: `display name must be 1–${DISPLAY_NAME_MAX} chars` };
  }
  if (role !== "agent" && role !== "manager") {
    return { ok: false, error: "role must be agent or manager" };
  }

  const businessId = await activeBusinessId();
  if (!businessId) return { ok: false, error: "no active business" };
  const guard = await requireRole(businessId, "manager");
  if (!guard.ok) return guard;

  const admin = getServiceClient();

  // Reject if this email is already an active agent in this business.
  // auth.admin.listUsers doesn't support filter-by-email cleanly, so
  // we do the join by hand: find any auth.users with this email, then
  // look up a non-archived support_agents row.
  const { data: usersByEmail } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existingUser = usersByEmail?.users?.find(
    (u) => (u.email ?? "").toLowerCase() === email,
  );
  if (existingUser) {
    const { data: existingAgent } = await admin
      .from("support_agents")
      .select("id")
      .eq("business_id", businessId)
      .eq("user_id", existingUser.id)
      .is("archived_at", null)
      .maybeSingle();
    if (existingAgent) {
      return { ok: false, error: "already an agent for this business" };
    }
  }

  // Reject if a pending invitation already exists for this email +
  // business pair. Service client bypasses RLS.
  const { data: pending } = await admin
    .from("invitations")
    .select("id, expires_at")
    .eq("business_id", businessId)
    .eq("email", email)
    .is("accepted_at", null)
    .is("revoked_at", null);
  const nowIso = new Date().toISOString();
  const livePending = (pending ?? []).find((r) => r.expires_at > nowIso);
  if (livePending) {
    return { ok: false, error: "invitation already pending for this email" };
  }

  const { raw, hash } = generateInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();

  const { data: insert, error: insErr } = await admin
    .from("invitations")
    .insert({
      business_id: businessId,
      email,
      display_name: displayName,
      role,
      token_hash: hash,
      invited_by: guard.userId,
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (insErr || !insert) {
    return { ok: false, error: insErr?.message ?? "couldn't save invite" };
  }

  try {
    await sendInviteEmail({
      businessId,
      email,
      displayName,
      role,
      rawToken: raw,
      inviterUserId: guard.userId,
    });
  } catch (err) {
    // Roll back the row so the lead can retry without bumping into the
    // "already pending" rejection above.
    await admin.from("invitations").delete().eq("id", insert.id);
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `couldn't send email: ${msg}` };
  }

  await logBillingEvent(businessId, "agent_invited", {
    email,
    role,
    invitation_id: insert.id,
  });

  revalidatePath("/dashboard/settings/team");
  return { ok: true };
}

export async function resendInvite(invitationId: string): Promise<ActionResult> {
  const businessId = await activeBusinessId();
  if (!businessId) return { ok: false, error: "no active business" };
  const guard = await requireRole(businessId, "manager");
  if (!guard.ok) return guard;

  const admin = getServiceClient();
  const { data: row } = await admin
    .from("invitations")
    .select("id, business_id, email, display_name, role, accepted_at, revoked_at, token_hash")
    .eq("id", invitationId)
    .maybeSingle();
  if (!row) return { ok: false, error: "invitation not found" };
  if (row.business_id !== businessId) {
    return { ok: false, error: "invitation belongs to another business" };
  }
  if (row.accepted_at) return { ok: false, error: "already accepted" };
  if (row.revoked_at) return { ok: false, error: "already revoked" };

  // Spec wanted token reuse on resend so old links stay valid, but the
  // raw token is never persisted — we only keep sha256(raw) — so we
  // can't recover it for a second email. Pragmatic compromise: rotate.
  // The previous email's link stops working after this point. Prompt 2
  // step 3 flags this as a follow-up if reuse becomes important.
  const { raw, hash } = generateInviteToken();
  const newExpiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
  const { error: updErr } = await admin
    .from("invitations")
    .update({ token_hash: hash, expires_at: newExpiresAt })
    .eq("id", row.id);
  if (updErr) return { ok: false, error: updErr.message };

  try {
    await sendInviteEmail({
      businessId,
      email: row.email,
      displayName: row.display_name,
      role: row.role === "manager" ? "manager" : "agent",
      rawToken: raw,
      inviterUserId: guard.userId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `couldn't send email: ${msg}` };
  }

  revalidatePath("/dashboard/settings/team");
  return { ok: true };
}

export async function revokeInvite(invitationId: string): Promise<ActionResult> {
  const businessId = await activeBusinessId();
  if (!businessId) return { ok: false, error: "no active business" };
  const guard = await requireRole(businessId, "manager");
  if (!guard.ok) return guard;

  const admin = getServiceClient();
  const { data: row } = await admin
    .from("invitations")
    .select("id, business_id, accepted_at, revoked_at")
    .eq("id", invitationId)
    .maybeSingle();
  if (!row) return { ok: false, error: "invitation not found" };
  if (row.business_id !== businessId) {
    return { ok: false, error: "invitation belongs to another business" };
  }
  if (row.accepted_at) return { ok: false, error: "already accepted" };
  if (row.revoked_at) {
    revalidatePath("/dashboard/settings/team");
    return { ok: true };
  }

  const { error: updErr } = await admin
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", invitationId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath("/dashboard/settings/team");
  return { ok: true };
}

export async function archiveAgent(agentId: string): Promise<ActionResult> {
  const businessId = await activeBusinessId();
  if (!businessId) return { ok: false, error: "no active business" };
  const guard = await requireRole(businessId, "manager");
  if (!guard.ok) return guard;

  const admin = getServiceClient();
  const { data: row } = await admin
    .from("support_agents")
    .select("id, business_id, user_id")
    .eq("id", agentId)
    .maybeSingle();
  if (!row) return { ok: false, error: "agent not found" };
  if (row.business_id !== businessId) {
    return { ok: false, error: "agent belongs to another business" };
  }
  if (row.user_id === guard.userId) {
    return { ok: false, error: "can't archive yourself" };
  }

  const { error: updErr } = await admin
    .from("support_agents")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", agentId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath("/dashboard/settings/team");
  return { ok: true };
}

export async function setOwnDisplayName(displayName: string): Promise<ActionResult> {
  const name = displayName.trim();
  if (name.length < 1 || name.length > DISPLAY_NAME_MAX) {
    return { ok: false, error: `display name must be 1–${DISPLAY_NAME_MAX} chars` };
  }
  const businessId = await activeBusinessId();
  if (!businessId) return { ok: false, error: "no active business" };
  const guard = await requireRole(businessId, "agent");
  if (!guard.ok) return guard;
  if (!guard.agentId) {
    return { ok: false, error: "owners edit their profile in account settings" };
  }

  const admin = getServiceClient();
  const { error: updErr } = await admin
    .from("support_agents")
    .update({ display_name: name })
    .eq("id", guard.agentId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function setOwnAvatarUrl(
  avatarUrl: string | null,
): Promise<ActionResult> {
  const businessId = await activeBusinessId();
  if (!businessId) return { ok: false, error: "no active business" };
  const guard = await requireRole(businessId, "agent");
  if (!guard.ok) return guard;
  if (!guard.agentId) {
    return { ok: false, error: "owners edit their profile in account settings" };
  }

  if (avatarUrl !== null && !/^https?:\/\//.test(avatarUrl)) {
    return { ok: false, error: "avatar URL must be absolute" };
  }

  const admin = getServiceClient();
  const { error: updErr } = await admin
    .from("support_agents")
    .update({ avatar_url: avatarUrl })
    .eq("id", guard.agentId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

// hashInviteToken + getInvitationByToken live in src/lib/invitations.ts
// so they can be imported from the invite acceptance flow without
// dragging in the "use server" wrapper that Next 16 requires for every
// export in a server-actions module.
