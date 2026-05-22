"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getServerClient, getServiceClient } from "@/lib/supabase/server";

const BIZ_COOKIE = "chatkit_active_biz";
const INBOX_COOKIE = "chatkit_active_inbox";
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

type Ok = { ok: true };
type Err = { ok: false; error: string };
type ActionResult = Ok | Err;

export async function setActiveBusiness(businessId: string): Promise<ActionResult> {
  const sb = await getServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "not signed in" };

  // The dashboard's RLS-scoped read covers owners; agents are out of
  // its policy, so fall through to the service client and validate via
  // the support_agents membership.
  const admin = getServiceClient();
  const { data: business } = await admin
    .from("businesses")
    .select("id, owner_user_id")
    .eq("id", businessId)
    .maybeSingle();
  if (!business) return { ok: false, error: "business not found" };

  if (business.owner_user_id !== user.id) {
    const { data: agentRow } = await admin
      .from("support_agents")
      .select("id")
      .eq("business_id", businessId)
      .eq("user_id", user.id)
      .is("archived_at", null)
      .not("accepted_at", "is", null)
      .maybeSingle();
    if (!agentRow) return { ok: false, error: "forbidden" };
  }

  const { data: firstInbox } = await admin
    .from("inboxes")
    .select("id")
    .eq("business_id", businessId)
    .is("archived_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const store = await cookies();
  store.set(BIZ_COOKIE, business.id, COOKIE_OPTS);
  if (firstInbox) store.set(INBOX_COOKIE, firstInbox.id, COOKIE_OPTS);
  revalidatePath("/dashboard", "layout");
  revalidatePath("/workbench", "layout");
  return { ok: true };
}

export async function setActiveBusinessAndInbox(
  businessId: string,
  inboxId: string,
): Promise<ActionResult> {
  const sb = await getServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "not signed in" };

  const store = await cookies();
  store.set(BIZ_COOKIE, businessId, COOKIE_OPTS);
  store.set(INBOX_COOKIE, inboxId, COOKIE_OPTS);
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function setActiveInbox(inboxId: string): Promise<ActionResult> {
  const sb = await getServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "not signed in" };

  const store = await cookies();
  const bizId = store.get(BIZ_COOKIE)?.value;
  if (!bizId) return { ok: false, error: "no active business" };

  const { data: inbox } = await sb
    .from("inboxes")
    .select("id, business_id")
    .eq("id", inboxId)
    .is("archived_at", null)
    .maybeSingle();
  if (!inbox || inbox.business_id !== bizId) {
    return { ok: false, error: "inbox not in active business" };
  }

  store.set(INBOX_COOKIE, inbox.id, COOKIE_OPTS);
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
