"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { requireActiveContext } from "@/lib/active-context";
import { getServerClient, getServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/team";

type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

const ALLOWED_AVATAR_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 2 * 1024 * 1024;

const SKILL_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;
const MAX_SKILLS_PER_AGENT = 16;

/**
 * Uploads an agent's avatar to the `avatars` bucket at
 * `<user_id>/<uuid>.<ext>` and updates `avatar_url` on every
 * non-archived support_agents row owned by the caller — a human
 * who is an agent for several businesses sees the same avatar
 * everywhere.
 */
export async function uploadAgentAvatar(
  formData: FormData,
): Promise<ActionResult<{ avatarUrl: string }>> {
  const sb = await getServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "not signed in" };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "missing file" };
  if (file.size > MAX_BYTES)
    return { ok: false, error: "avatar must be ≤ 2 MB" };
  if (!ALLOWED_AVATAR_MIME.has(file.type))
    return { ok: false, error: "avatar must be PNG, JPEG, or WebP" };

  const ext = file.name.includes(".")
    ? file.name.split(".").pop()!.toLowerCase()
    : "png";
  const key = `${user.id}/${randomUUID()}.${ext}`;

  const admin = getServiceClient();
  const arrayBuffer = await file.arrayBuffer();
  const { error: upErr } = await admin.storage
    .from("avatars")
    .upload(key, Buffer.from(arrayBuffer), {
      contentType: file.type,
      upsert: false,
    });
  if (upErr) return { ok: false, error: upErr.message };

  const { data: publicUrl } = admin.storage.from("avatars").getPublicUrl(key);
  const avatarUrl = publicUrl.publicUrl;

  // Collect previous avatar paths so we can clean them up after the
  // update succeeds — leaves the bucket tidy when an agent re-uploads.
  const { data: existing } = await admin
    .from("support_agents")
    .select("avatar_url")
    .eq("user_id", user.id)
    .is("archived_at", null);
  const previousKeys = new Set<string>();
  (existing ?? []).forEach((row) => {
    if (!row.avatar_url) return;
    const k = row.avatar_url.split("/avatars/")[1];
    if (k && k !== key) previousKeys.add(k);
  });

  const { error: updErr } = await admin
    .from("support_agents")
    .update({ avatar_url: avatarUrl })
    .eq("user_id", user.id)
    .is("archived_at", null);
  if (updErr) return { ok: false, error: updErr.message };

  if (previousKeys.size > 0) {
    void admin.storage.from("avatars").remove(Array.from(previousKeys));
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true, avatarUrl };
}

/**
 * Owner/manager-only: replace the skills array on a support_agents row.
 *
 * Skills are normalized + validated against `SKILL_PATTERN` (lower-kebab,
 * 1–32 chars). Empty array is fine (clears all skills). Caller may only
 * edit agents that belong to the active business.
 */
export async function setAgentSkills(input: {
  agentId: string;
  skills: string[];
}): Promise<ActionResult> {
  const ctx = await requireActiveContext();
  const guard = await requireRole(ctx.business.id, "manager");
  if (!guard.ok) return { ok: false, error: "forbidden" };

  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const raw of input.skills) {
    if (typeof raw !== "string") {
      return { ok: false, error: "invalid skill" };
    }
    const slug = raw
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
    if (!slug) continue;
    if (!SKILL_PATTERN.test(slug)) {
      return {
        ok: false,
        error: `skill "${raw}" must be lowercase letters, digits, or hyphens (≤ 32 chars)`,
      };
    }
    if (seen.has(slug)) continue;
    seen.add(slug);
    normalized.push(slug);
  }
  if (normalized.length > MAX_SKILLS_PER_AGENT) {
    return { ok: false, error: `at most ${MAX_SKILLS_PER_AGENT} skills per agent` };
  }

  const admin = getServiceClient();
  const { error } = await admin
    .from("support_agents")
    .update({ skills: normalized })
    .eq("id", input.agentId)
    .eq("business_id", ctx.business.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings/team");
  return { ok: true };
}
