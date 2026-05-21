"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getServerClient } from "@/lib/supabase/server";

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

  const { data: business } = await sb
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .maybeSingle();
  if (!business) return { ok: false, error: "business not found" };

  const { data: firstInbox } = await sb
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
