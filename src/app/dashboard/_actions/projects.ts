"use server";

import { revalidatePath } from "next/cache";
import { getServerClient } from "@/lib/supabase/server";
import { slugWithSuffix } from "@/lib/onboarding/slug";

type Ok<T = unknown> = { ok: true } & T;
type Err = { ok: false; error: string };
type ActionResult<T = unknown> = Ok<T> | Err;

export async function createProjectAction(input: {
  businessId: string;
  name: string;
  description?: string;
}): Promise<ActionResult<{ projectId: string }>> {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 60) {
    return { ok: false, error: "name must be 2–60 chars" };
  }

  const sb = await getServerClient();
  const { data, error } = await sb
    .from("projects")
    .insert({
      business_id: input.businessId,
      name,
      slug: slugWithSuffix(name, "project"),
      description: input.description?.trim().slice(0, 280) || null,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "couldn't create project" };
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true, projectId: data.id };
}

export async function renameProject(input: {
  projectId: string;
  name: string;
}): Promise<ActionResult> {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 60) {
    return { ok: false, error: "name must be 2–60 chars" };
  }

  const sb = await getServerClient();
  const { error } = await sb
    .from("projects")
    .update({ name })
    .eq("id", input.projectId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function archiveProject(projectId: string): Promise<ActionResult> {
  const sb = await getServerClient();
  const now = new Date().toISOString();

  // Supabase JS doesn't expose explicit txns to the anon role, but two
  // sequential updates are fine — RLS scopes both, and the
  // partial-failure window is acceptable for v0.x.
  const { error: pErr } = await sb
    .from("projects")
    .update({ archived_at: now })
    .eq("id", projectId);
  if (pErr) return { ok: false, error: pErr.message };

  const { error: iErr } = await sb
    .from("inboxes")
    .update({ archived_at: now })
    .eq("project_id", projectId)
    .is("archived_at", null);
  if (iErr) return { ok: false, error: iErr.message };

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
