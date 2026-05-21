"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getServerClient, getServiceClient } from "@/lib/supabase/server";

type Ok<T = unknown> = { ok: true } & T;
type Err = { ok: false; error: string };
type ActionResult<T = unknown> = Ok<T> | Err;

/** Normalise + validate a user-entered origin. Browsers normalise
 *  origins to `scheme://host[:port]` with no trailing slash; the
 *  CSP / Origin header check requires an exact match, so we coerce
 *  to that form here too. */
function normaliseOrigin(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.protocol === "http:" && u.hostname !== "localhost" && !u.hostname.endsWith(".localhost") && u.hostname !== "127.0.0.1") {
      // http:// only allowed for localhost — anything else is a likely typo.
      return null;
    }
    // URL.origin already strips path / query / fragment and lowercases the host.
    return u.origin;
  } catch {
    return null;
  }
}

async function assertOwner(businessId: string): Promise<{ ok: true } | Err> {
  const sb = await getServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "not signed in" };
  const { data, error } = await sb
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (error || !data) return { ok: false, error: "not authorised" };
  return { ok: true };
}

export async function addAllowedOrigin(input: {
  businessId: string;
  origin: string;
}): Promise<ActionResult<{ origin: string }>> {
  const auth = await assertOwner(input.businessId);
  if (!("ok" in auth) || !auth.ok) return auth;

  const origin = normaliseOrigin(input.origin);
  if (!origin) {
    return { ok: false, error: "invalid origin — use https://example.com" };
  }

  const service = getServiceClient();
  const { data: existing, error: readErr } = await service
    .from("businesses")
    .select("allowed_origins")
    .eq("id", input.businessId)
    .single();
  if (readErr || !existing) return { ok: false, error: readErr?.message ?? "not found" };

  const current = Array.isArray(existing.allowed_origins) ? existing.allowed_origins : [];
  if (current.includes(origin)) return { ok: true, origin };

  const next = [...current, origin];
  const { error: writeErr } = await service
    .from("businesses")
    .update({ allowed_origins: next })
    .eq("id", input.businessId);
  if (writeErr) return { ok: false, error: writeErr.message };

  revalidatePath("/dashboard/settings/business");
  return { ok: true, origin };
}

export async function removeAllowedOrigin(input: {
  businessId: string;
  origin: string;
}): Promise<ActionResult> {
  const auth = await assertOwner(input.businessId);
  if (!("ok" in auth) || !auth.ok) return auth;

  const service = getServiceClient();
  const { data: existing, error: readErr } = await service
    .from("businesses")
    .select("allowed_origins")
    .eq("id", input.businessId)
    .single();
  if (readErr || !existing) return { ok: false, error: readErr?.message ?? "not found" };

  const current = Array.isArray(existing.allowed_origins) ? existing.allowed_origins : [];
  const next = current.filter((o: string) => o !== input.origin);
  if (next.length === current.length) return { ok: true };

  const { error: writeErr } = await service
    .from("businesses")
    .update({ allowed_origins: next })
    .eq("id", input.businessId);
  if (writeErr) return { ok: false, error: writeErr.message };

  revalidatePath("/dashboard/settings/business");
  return { ok: true };
}

/** Verify that chatkit will accept an iframe from `origin` for this
 *  business. Picks the business's first active inbox, then fetches
 *  /embed/widget?key=<that inbox's api_key> with Origin: <origin>.
 *  A clean 200 means: the row is saved, the CSP middleware will set
 *  frame-ancestors correctly, and the page's own verifyEmbedKey
 *  agrees the origin is allowed.
 *
 *  This is a server-to-server fetch, so it doesn't go through any
 *  browser CSP — but if it fails, the browser will fail too. If it
 *  succeeds, the only remaining variable is whether the host page
 *  itself loads the iframe (which is on the host's end). */
export async function testAllowedOrigin(input: {
  businessId: string;
  origin: string;
}): Promise<ActionResult<{ status: number; detail?: string }>> {
  const auth = await assertOwner(input.businessId);
  if (!("ok" in auth) || !auth.ok) return auth;

  const origin = normaliseOrigin(input.origin);
  if (!origin) return { ok: false, error: "invalid origin" };

  const service = getServiceClient();
  const { data: inbox, error: inboxErr } = await service
    .from("inboxes")
    .select("api_key")
    .eq("business_id", input.businessId)
    .is("archived_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (inboxErr || !inbox) {
    return { ok: false, error: "no active inbox — create one before testing" };
  }

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return { ok: false, error: "couldn't resolve own host" };
  const widgetUrl = `${proto}://${host}/embed/widget?key=${encodeURIComponent(inbox.api_key)}`;

  let res: Response;
  try {
    res = await fetch(widgetUrl, {
      method: "GET",
      headers: { Origin: origin, Referer: `${origin}/` },
      redirect: "manual",
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "fetch failed",
    };
  }

  if (res.status !== 200) {
    return { ok: true, status: res.status, detail: `chatkit returned ${res.status}` };
  }
  const body = await res.text();
  if (body.includes("Auth failed:")) {
    // Surface the reason chatkit's auth path rejected — usually "origin not allowed".
    const match = body.match(/Auth failed:\s*([^<]+)/);
    return {
      ok: true,
      status: 200,
      detail: match ? `auth rejected: ${match[1].trim()}` : "auth rejected",
    };
  }
  return { ok: true, status: 200, detail: "iframe should load" };
}
