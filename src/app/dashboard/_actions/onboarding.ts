"use server";

import { revalidatePath } from "next/cache";
import { getServerClient } from "@/lib/supabase/server";
import {
  PROFILE_ROLES,
  COMPANY_SIZES,
  INDUSTRIES,
  INBOX_PURPOSES,
  INBOX_AUDIENCES,
  type ProfileRole,
  type CompanySize,
  type Industry,
  type InboxPurpose,
  type Audience,
} from "@/lib/onboarding/enums";
import { slugWithSuffix, newApiKey } from "@/lib/onboarding/slug";

type Ok<T = unknown> = { ok: true } & T;
type Err = { ok: false; error: string };
type ActionResult<T = unknown> = Ok<T> | Err;

function err(message: string): Err {
  return { ok: false, error: message };
}

function trimName(raw: unknown, field: string, max = 60): string | Err {
  if (typeof raw !== "string") return err(`${field} is required`);
  const value = raw.trim();
  if (value.length < 2) return err(`${field} must be at least 2 characters`);
  if (value.length > max) return err(`${field} must be at most ${max} characters`);
  return value;
}

async function requireUserId(): Promise<string | Err> {
  const sb = await getServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err("not signed in");
  return user.id;
}

export async function saveProfileRole(role: ProfileRole): Promise<ActionResult> {
  if (!PROFILE_ROLES.includes(role)) return err("invalid role");
  const userId = await requireUserId();
  if (typeof userId !== "string") return userId;

  // Upsert so the user can change their answer if they bounce out of the
  // modal and come back.
  const sb = await getServerClient();
  const { error } = await sb
    .from("profiles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id" });
  if (error) return err(error.message);
  return { ok: true };
}

export async function createBusiness(input: {
  name: string;
  companySize: CompanySize;
  industry: Industry;
}): Promise<ActionResult<{ businessId: string }>> {
  const name = trimName(input.name, "Business name");
  if (typeof name !== "string") return name;
  if (!COMPANY_SIZES.includes(input.companySize)) return err("invalid company size");
  if (!INDUSTRIES.includes(input.industry)) return err("invalid industry");

  const userId = await requireUserId();
  if (typeof userId !== "string") return userId;

  const sb = await getServerClient();
  const { data, error } = await sb
    .from("businesses")
    .insert({
      owner_user_id: userId,
      name,
      slug: slugWithSuffix(name, "business"),
      industry: input.industry,
      company_size: input.companySize,
      plan: "starter",
      status: "active",
    })
    .select("id")
    .single();
  if (error) {
    // The DB trigger raises P0001 'business limit reached'.
    if (error.message.includes("business limit reached") || error.code === "P0001") {
      return err("You already have the maximum of 2 businesses on this account.");
    }
    return err(error.message);
  }
  return { ok: true, businessId: data.id };
}

export async function createProject(input: {
  businessId: string;
  name: string;
  description?: string;
}): Promise<ActionResult<{ projectId: string }>> {
  const name = trimName(input.name, "Project name");
  if (typeof name !== "string") return name;
  const description =
    typeof input.description === "string"
      ? input.description.trim().slice(0, 280) || null
      : null;

  const userId = await requireUserId();
  if (typeof userId !== "string") return userId;

  // RLS verifies ownership; an attempt to insert under a foreign
  // business_id returns null from .select(...).single().
  const sb = await getServerClient();
  const { data, error } = await sb
    .from("projects")
    .insert({
      business_id: input.businessId,
      name,
      slug: slugWithSuffix(name, "project"),
      description,
    })
    .select("id")
    .single();
  if (error || !data) return err(error?.message ?? "couldn't create project");
  return { ok: true, projectId: data.id };
}

export async function createInbox(input: {
  projectId: string;
  name: string;
  purpose: InboxPurpose;
  audience: Audience;
}): Promise<ActionResult<{ inboxId: string; apiKey: string }>> {
  const name = trimName(input.name, "Inbox name");
  if (typeof name !== "string") return name;
  if (!INBOX_PURPOSES.includes(input.purpose)) return err("invalid purpose");
  if (!INBOX_AUDIENCES.includes(input.audience)) return err("invalid audience");

  const userId = await requireUserId();
  if (typeof userId !== "string") return userId;

  // Look up the parent project to capture business_id (denorm column).
  // RLS guarantees the user owns this project.
  const sb = await getServerClient();
  const { data: project, error: projErr } = await sb
    .from("projects")
    .select("id, business_id")
    .eq("id", input.projectId)
    .maybeSingle();
  if (projErr || !project) return err("project not found");

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
      return err(
        "Inbox limit reached for your plan. Upgrade in Settings → Billing.",
      );
    }
    return err(error?.message ?? "couldn't create inbox");
  }
  return { ok: true, inboxId: data.id, apiKey: data.api_key };
}

export async function completeOnboarding(businessId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (typeof userId !== "string") return userId;

  const sb = await getServerClient();
  const { error } = await sb
    .from("businesses")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", businessId)
    .eq("owner_user_id", userId);
  if (error) return err(error.message);

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
