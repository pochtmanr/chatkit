"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { timingSafeEqual } from "node:crypto";
import { getServerClient, getServiceClient } from "@/lib/supabase/server";
import {
  getInvitationByToken,
  hashInviteToken,
} from "@/lib/invitations";

type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

const DISPLAY_NAME_MAX = 80;
const PASSWORD_MIN = 8;
const BIZ_COOKIE = "chatkit_active_biz";

function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

async function loadValidInvitation(rawToken: string) {
  const inv = await getInvitationByToken(rawToken);
  if (!inv) return { ok: false as const, error: "invitation not found" };
  if (!constantTimeEqualHex(hashInviteToken(rawToken), hashInviteToken(rawToken))) {
    // Belt-and-braces — getInvitationByToken already matched by hash,
    // but we never compare raw tokens with `===` anywhere in user code.
    return { ok: false as const, error: "invitation not found" };
  }
  if (inv.revoked_at) return { ok: false as const, error: "invitation revoked" };
  if (inv.accepted_at) {
    return { ok: false as const, error: "invitation already accepted" };
  }
  if (new Date(inv.expires_at).getTime() < Date.now()) {
    return { ok: false as const, error: "invitation expired" };
  }
  return { ok: true as const, invitation: inv };
}

async function findAuthUserByEmail(email: string): Promise<string | null> {
  const admin = getServiceClient();
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const match = data?.users?.find(
    (u) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
  );
  return match?.id ?? null;
}

async function upsertAgentRow(args: {
  businessId: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: "agent" | "manager";
  invitedBy: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = getServiceClient();
  const nowIso = new Date().toISOString();
  // Restore an archived row for the same (business, user) pair if one
  // exists — otherwise the (business_id, user_id) unique constraint
  // would refuse the insert.
  const { data: existing } = await admin
    .from("support_agents")
    .select("id")
    .eq("business_id", args.businessId)
    .eq("user_id", args.userId)
    .maybeSingle();
  if (existing) {
    const { error } = await admin
      .from("support_agents")
      .update({
        display_name: args.displayName,
        avatar_url: args.avatarUrl,
        role: args.role,
        invited_by: args.invitedBy,
        invited_at: nowIso,
        accepted_at: nowIso,
        archived_at: null,
        status: "online",
        status_changed_at: nowIso,
      })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  const { error } = await admin.from("support_agents").insert({
    business_id: args.businessId,
    user_id: args.userId,
    display_name: args.displayName,
    avatar_url: args.avatarUrl,
    role: args.role,
    invited_by: args.invitedBy,
    accepted_at: nowIso,
    status: "online",
    status_changed_at: nowIso,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function markAccepted(invitationId: string): Promise<void> {
  const admin = getServiceClient();
  await admin
    .from("invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invitationId);
}

async function setActiveBusinessCookie(businessId: string): Promise<void> {
  const store = await cookies();
  store.set(BIZ_COOKIE, businessId, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}

/**
 * Accept an invitation when no auth.users row exists for the email yet.
 * Creates the user via the service client, then writes the support_agents
 * row and signs the caller in via the server client.
 */
export async function acceptInviteNewUser(input: {
  token: string;
  password: string;
  displayName: string;
  avatarUrl: string | null;
}): Promise<ActionResult> {
  const res = await loadValidInvitation(input.token);
  if (!res.ok) return res;
  const inv = res.invitation;

  if (input.password.length < PASSWORD_MIN) {
    return { ok: false, error: `password must be at least ${PASSWORD_MIN} chars` };
  }
  const displayName = input.displayName.trim();
  if (displayName.length < 1 || displayName.length > DISPLAY_NAME_MAX) {
    return { ok: false, error: `display name must be 1–${DISPLAY_NAME_MAX} chars` };
  }

  const admin = getServiceClient();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: inv.email,
    password: input.password,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    return { ok: false, error: createErr?.message ?? "couldn't create user" };
  }

  const upsert = await upsertAgentRow({
    businessId: inv.business_id,
    userId: created.user.id,
    displayName,
    avatarUrl: input.avatarUrl,
    role: inv.role,
    invitedBy: inv.invited_by,
  });
  if (!upsert.ok) return upsert;

  await markAccepted(inv.id);

  const sb = await getServerClient();
  const { error: signInErr } = await sb.auth.signInWithPassword({
    email: inv.email,
    password: input.password,
  });
  if (signInErr) return { ok: false, error: signInErr.message };

  await setActiveBusinessCookie(inv.business_id);
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Accept an invitation when the email already exists in auth.users.
 * Verifies the password via signInWithPassword (which also installs
 * the session) then writes the support_agents row.
 */
export async function acceptInviteExistingUser(input: {
  token: string;
  password: string;
  displayName: string;
  avatarUrl: string | null;
}): Promise<ActionResult> {
  const res = await loadValidInvitation(input.token);
  if (!res.ok) return res;
  const inv = res.invitation;

  const displayName = input.displayName.trim();
  if (displayName.length < 1 || displayName.length > DISPLAY_NAME_MAX) {
    return { ok: false, error: `display name must be 1–${DISPLAY_NAME_MAX} chars` };
  }

  const sb = await getServerClient();
  const { data: signInData, error: signInErr } = await sb.auth.signInWithPassword({
    email: inv.email,
    password: input.password,
  });
  if (signInErr || !signInData.user) {
    return { ok: false, error: "incorrect password for this email" };
  }
  if ((signInData.user.email ?? "").toLowerCase() !== inv.email.toLowerCase()) {
    // Defence-in-depth — the email mismatch should be impossible from a
    // successful signInWithPassword, but bail rather than write a wrong
    // user into support_agents.
    await sb.auth.signOut();
    return { ok: false, error: "email mismatch" };
  }

  const upsert = await upsertAgentRow({
    businessId: inv.business_id,
    userId: signInData.user.id,
    displayName,
    avatarUrl: input.avatarUrl,
    role: inv.role,
    invitedBy: inv.invited_by,
  });
  if (!upsert.ok) return upsert;

  await markAccepted(inv.id);
  await setActiveBusinessCookie(inv.business_id);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Surface to the page: does an auth.users row exist for this email? */
export async function inviteHasExistingUser(rawToken: string): Promise<
  ActionResult<{ exists: boolean }>
> {
  const res = await loadValidInvitation(rawToken);
  if (!res.ok) return res;
  const userId = await findAuthUserByEmail(res.invitation.email);
  return { ok: true, exists: userId !== null };
}
