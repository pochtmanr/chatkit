"use server";

import { revalidatePath } from "next/cache";
import { getServerClient } from "@/lib/supabase/server";
import { fireInboxTestWebhook } from "@/lib/tenant-webhook";
import { slugWithSuffix, newApiKey } from "@/lib/onboarding/slug";
import {
  INBOX_PURPOSES,
  INBOX_AUDIENCES,
  type InboxPurpose,
  type Audience,
} from "@/lib/onboarding/enums";

type Ok<T = unknown> = { ok: true } & T;
type Err = { ok: false; error: string };
type ActionResult<T = unknown> = Ok<T> | Err;

export async function rotateInboxApiKey(
  inboxId: string,
): Promise<ActionResult<{ apiKey: string }>> {
  const sb = await getServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "not signed in" };

  const { data: existing } = await sb
    .from("inboxes")
    .select("id")
    .eq("id", inboxId)
    .is("archived_at", null)
    .maybeSingle();
  if (!existing) return { ok: false, error: "inbox not found" };

  const apiKey = newApiKey();
  const { error } = await sb
    .from("inboxes")
    .update({ api_key: apiKey })
    .eq("id", inboxId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings/api-keys");
  return { ok: true, apiKey };
}

export async function saveInboxWebhook(input: {
  inboxId: string;
  url: string | null;
}): Promise<ActionResult> {
  const sb = await getServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "not signed in" };

  const normalized = input.url?.trim();
  const url = normalized && normalized.length > 0 ? normalized : null;

  if (url) {
    try {
      new URL(url);
    } catch {
      return { ok: false, error: "must be a valid URL" };
    }
  }

  const { data: existing } = await sb
    .from("inboxes")
    .select("id")
    .eq("id", input.inboxId)
    .is("archived_at", null)
    .maybeSingle();
  if (!existing) return { ok: false, error: "inbox not found" };

  const { error } = await sb
    .from("inboxes")
    .update({ webhook_url: url })
    .eq("id", input.inboxId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/webhooks");
  return { ok: true };
}

export async function testInboxWebhook(
  inboxId: string,
): Promise<ActionResult<{ status: number | null; body: string }>> {
  const sb = await getServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "not signed in" };

  const { data: inbox } = await sb
    .from("inboxes")
    .select("id, webhook_url")
    .eq("id", inboxId)
    .is("archived_at", null)
    .maybeSingle();
  if (!inbox) return { ok: false, error: "inbox not found" };
  if (!inbox.webhook_url) {
    return { ok: false, error: "no webhook URL configured" };
  }

  const result = await fireInboxTestWebhook(inboxId);
  revalidatePath("/dashboard/webhooks");
  if (result.ok) {
    return { ok: true, status: result.status, body: result.body };
  }
  if (result.status !== null) {
    return { ok: true, status: result.status, body: result.body ?? "" };
  }
  return { ok: false, error: result.error };
}

export async function renameInbox(input: {
  inboxId: string;
  name: string;
  purpose?: InboxPurpose;
  audience?: Audience;
}): Promise<ActionResult> {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 60) {
    return { ok: false, error: "name must be 2–60 chars" };
  }

  const patch: { name: string; purpose?: string; audience?: string } = { name };
  if (input.purpose !== undefined) {
    if (!INBOX_PURPOSES.includes(input.purpose)) {
      return { ok: false, error: "invalid purpose" };
    }
    patch.purpose = input.purpose;
  }
  if (input.audience !== undefined) {
    if (!INBOX_AUDIENCES.includes(input.audience)) {
      return { ok: false, error: "invalid audience" };
    }
    patch.audience = input.audience;
  }

  const sb = await getServerClient();
  const { error } = await sb
    .from("inboxes")
    .update(patch)
    .eq("id", input.inboxId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function archiveInbox(inboxId: string): Promise<ActionResult> {
  const sb = await getServerClient();

  const { data: inbox } = await sb
    .from("inboxes")
    .select("id, business_id")
    .eq("id", inboxId)
    .maybeSingle();
  if (!inbox) return { ok: false, error: "inbox not found" };

  // Refuse to archive the last active inbox in a business — the active
  // context falls over without one.
  const { count } = await sb
    .from("inboxes")
    .select("id", { count: "exact", head: true })
    .eq("business_id", inbox.business_id)
    .is("archived_at", null);
  if ((count ?? 0) <= 1) {
    return {
      ok: false,
      error: "can't archive the only active inbox — create another first",
    };
  }

  const { error } = await sb
    .from("inboxes")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", inboxId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function createInboxInProject(input: {
  projectId: string;
  name: string;
  purpose: InboxPurpose;
  audience: Audience;
}): Promise<ActionResult<{ inboxId: string; apiKey: string }>> {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 60) {
    return { ok: false, error: "name must be 2–60 chars" };
  }
  if (!INBOX_PURPOSES.includes(input.purpose)) {
    return { ok: false, error: "invalid purpose" };
  }
  if (!INBOX_AUDIENCES.includes(input.audience)) {
    return { ok: false, error: "invalid audience" };
  }

  const sb = await getServerClient();
  const { data: project } = await sb
    .from("projects")
    .select("id, business_id")
    .eq("id", input.projectId)
    .is("archived_at", null)
    .maybeSingle();
  if (!project) return { ok: false, error: "project not found" };

  const apiKey = newApiKey();
  const { data, error } = await sb
    .from("inboxes")
    .insert({
      project_id: project.id,
      business_id: project.business_id,
      name,
      slug: slugWithSuffix(name, "inbox"),
      purpose: input.purpose,
      audience: input.audience,
      api_key: apiKey,
    })
    .select("id, api_key")
    .single();
  if (error || !data) {
    if (error?.message?.toLowerCase().includes("inbox limit reached")) {
      return {
        ok: false,
        error:
          "Inbox limit reached for your plan. Upgrade in Settings → Billing.",
      };
    }
    return { ok: false, error: error?.message ?? "couldn't create inbox" };
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true, inboxId: data.id, apiKey: data.api_key };
}
