"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/team";
import { isStartOptionIcon } from "@/app/dashboard/_components/settings/start-option-icons";

type Ok<T = unknown> = { ok: true } & T;
type Err = { ok: false; error: string };
type ActionResult<T = unknown> = Ok<T> | Err;

export type StartOptionKind = "support" | "order" | "direct";

const ALLOWED_KINDS: ReadonlyArray<StartOptionKind> = ["support", "order", "direct"];
const SKILL_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;
const MAX_SKILLS = 8;
const LABEL_MIN = 1;
const LABEL_MAX = 60;
const DESCRIPTION_MAX = 240;

type StartOptionInput = {
  inboxId: string;
  label: string;
  description: string | null;
  icon: string;
  kind: StartOptionKind;
  required_skills: string[];
};

async function activeBusinessId(): Promise<string | null> {
  return (await cookies()).get("chatkit_active_biz")?.value ?? null;
}

function isKind(value: unknown): value is StartOptionKind {
  return typeof value === "string" && (ALLOWED_KINDS as readonly string[]).includes(value);
}

function normalizeLabel(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length < LABEL_MIN || trimmed.length > LABEL_MAX) return null;
  return trimmed;
}

function normalizeDescription(raw: unknown): { ok: true; value: string | null } | { ok: false } {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false };
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  if (trimmed.length > DESCRIPTION_MAX) return { ok: false };
  return { ok: true, value: trimmed };
}

function normalizeSkills(raw: unknown): { ok: true; value: string[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: "required_skills must be an array" };
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") return { ok: false, error: "required_skills must be strings" };
    const slug = entry
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
    if (!slug) continue;
    if (!SKILL_PATTERN.test(slug)) {
      return { ok: false, error: `skill "${entry}" must be lowercase letters, digits, or hyphens (≤ 32 chars)` };
    }
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
  }
  if (out.length > MAX_SKILLS) {
    return { ok: false, error: `at most ${MAX_SKILLS} required skills per option` };
  }
  return { ok: true, value: out };
}

/** Confirm the inbox belongs to the caller's active business. Returns
 *  the business id on success so the caller doesn't need to look it
 *  up twice. */
async function assertInboxBelongsToBusiness(
  inboxId: string,
  businessId: string,
): Promise<boolean> {
  const admin = getServiceClient();
  const { data } = await admin
    .from("inboxes")
    .select("id")
    .eq("id", inboxId)
    .eq("business_id", businessId)
    .is("archived_at", null)
    .maybeSingle();
  return !!data;
}

export async function createStartOption(
  input: StartOptionInput,
): Promise<ActionResult<{ id: string }>> {
  const businessId = await activeBusinessId();
  if (!businessId) return { ok: false, error: "no active business" };
  const guard = await requireRole(businessId, "owner");
  if (!guard.ok) return guard;

  if (!(await assertInboxBelongsToBusiness(input.inboxId, businessId))) {
    return { ok: false, error: "inbox not found" };
  }

  const label = normalizeLabel(input.label);
  if (!label) return { ok: false, error: `label must be ${LABEL_MIN}–${LABEL_MAX} chars` };

  const description = normalizeDescription(input.description);
  if (!description.ok) return { ok: false, error: `description must be ≤ ${DESCRIPTION_MAX} chars` };

  if (!isStartOptionIcon(input.icon)) return { ok: false, error: "unknown icon" };
  if (!isKind(input.kind)) return { ok: false, error: "invalid kind" };

  const skills = normalizeSkills(input.required_skills);
  if (!skills.ok) return { ok: false, error: skills.error };

  const admin = getServiceClient();

  const { data: maxRow } = await admin
    .from("conversation_start_options")
    .select("sort_order")
    .eq("inbox_id", input.inboxId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = (maxRow?.sort_order ?? -1) + 1;

  const { data, error } = await admin
    .from("conversation_start_options")
    .insert({
      business_id: businessId,
      inbox_id: input.inboxId,
      label,
      description: description.value,
      icon: input.icon,
      kind: input.kind,
      required_skills: skills.value,
      sort_order: nextSort,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "create failed" };

  revalidatePath("/dashboard/settings/start-options");
  return { ok: true, id: data.id };
}

export async function updateStartOption(
  input: { id: string } & Partial<StartOptionInput>,
): Promise<ActionResult> {
  const businessId = await activeBusinessId();
  if (!businessId) return { ok: false, error: "no active business" };
  const guard = await requireRole(businessId, "owner");
  if (!guard.ok) return guard;

  const admin = getServiceClient();
  const { data: existing } = await admin
    .from("conversation_start_options")
    .select("id, business_id, inbox_id")
    .eq("id", input.id)
    .maybeSingle();
  if (!existing || existing.business_id !== businessId) {
    return { ok: false, error: "not found" };
  }

  const patch: {
    updated_at: string;
    label?: string;
    description?: string | null;
    icon?: string;
    kind?: StartOptionKind;
    required_skills?: string[];
  } = { updated_at: new Date().toISOString() };

  if (input.label !== undefined) {
    const label = normalizeLabel(input.label);
    if (!label) return { ok: false, error: `label must be ${LABEL_MIN}–${LABEL_MAX} chars` };
    patch.label = label;
  }
  if (input.description !== undefined) {
    const desc = normalizeDescription(input.description);
    if (!desc.ok) return { ok: false, error: `description must be ≤ ${DESCRIPTION_MAX} chars` };
    patch.description = desc.value;
  }
  if (input.icon !== undefined) {
    if (!isStartOptionIcon(input.icon)) return { ok: false, error: "unknown icon" };
    patch.icon = input.icon;
  }
  if (input.kind !== undefined) {
    if (!isKind(input.kind)) return { ok: false, error: "invalid kind" };
    patch.kind = input.kind;
  }
  if (input.required_skills !== undefined) {
    const skills = normalizeSkills(input.required_skills);
    if (!skills.ok) return { ok: false, error: skills.error };
    patch.required_skills = skills.value;
  }

  const { error } = await admin
    .from("conversation_start_options")
    .update(patch)
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings/start-options");
  return { ok: true };
}

export async function reorderStartOptions(
  input: { ids: string[] },
): Promise<ActionResult> {
  const businessId = await activeBusinessId();
  if (!businessId) return { ok: false, error: "no active business" };
  const guard = await requireRole(businessId, "owner");
  if (!guard.ok) return guard;

  if (!Array.isArray(input.ids) || input.ids.length === 0) {
    return { ok: false, error: "ids required" };
  }

  const admin = getServiceClient();
  const { data: rows } = await admin
    .from("conversation_start_options")
    .select("id, inbox_id")
    .in("id", input.ids);
  if (!rows || rows.length !== input.ids.length) {
    return { ok: false, error: "some options not found" };
  }
  const inboxId = rows[0].inbox_id;
  if (!rows.every((r) => r.inbox_id === inboxId)) {
    return { ok: false, error: "options span multiple inboxes" };
  }
  if (!(await assertInboxBelongsToBusiness(inboxId, businessId))) {
    return { ok: false, error: "forbidden" };
  }

  // Supabase JS doesn't expose multi-row updates with different values,
  // so we issue one statement per id. The set is small (≤ ~20 options).
  const now = new Date().toISOString();
  for (let i = 0; i < input.ids.length; i++) {
    const { error } = await admin
      .from("conversation_start_options")
      .update({ sort_order: i, updated_at: now })
      .eq("id", input.ids[i]);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard/settings/start-options");
  return { ok: true };
}

export async function deleteStartOption(input: { id: string }): Promise<ActionResult> {
  const businessId = await activeBusinessId();
  if (!businessId) return { ok: false, error: "no active business" };
  const guard = await requireRole(businessId, "owner");
  if (!guard.ok) return guard;

  const admin = getServiceClient();
  const { error } = await admin
    .from("conversation_start_options")
    .delete()
    .eq("id", input.id)
    .eq("business_id", businessId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings/start-options");
  return { ok: true };
}

export async function toggleStartOptionActive(
  input: { id: string; is_active: boolean },
): Promise<ActionResult> {
  const businessId = await activeBusinessId();
  if (!businessId) return { ok: false, error: "no active business" };
  const guard = await requireRole(businessId, "owner");
  if (!guard.ok) return guard;

  const admin = getServiceClient();
  const { error } = await admin
    .from("conversation_start_options")
    .update({ is_active: input.is_active, updated_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("business_id", businessId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings/start-options");
  return { ok: true };
}

/**
 * First-visit seed: drop three sensible defaults into a fresh inbox.
 * Caller must guarantee the inbox has zero options — this helper is a
 * pure insert and won't dedupe if invoked twice.
 *
 * Routing-aware: the "billing" / "orders" skills here line up with the
 * skill tokens advertised on the team page so a freshly seeded
 * business immediately demonstrates assignment-by-skill.
 */
export async function seedDefaultStartOptions(
  businessId: string,
  inboxId: string,
): Promise<ActionResult> {
  const guard = await requireRole(businessId, "owner");
  if (!guard.ok) return guard;
  if (!(await assertInboxBelongsToBusiness(inboxId, businessId))) {
    return { ok: false, error: "inbox not found" };
  }

  const admin = getServiceClient();
  const defaults = [
    {
      business_id: businessId,
      inbox_id: inboxId,
      label: "Support",
      description: "General questions or feedback.",
      icon: "life-buoy",
      kind: "support" as const,
      required_skills: [],
      sort_order: 0,
    },
    {
      business_id: businessId,
      inbox_id: inboxId,
      label: "Billing",
      description: "Questions about charges or invoices.",
      icon: "credit-card",
      kind: "support" as const,
      required_skills: ["billing"],
      sort_order: 1,
    },
    {
      business_id: businessId,
      inbox_id: inboxId,
      label: "Order issue",
      description: "Problems with a delivery or product.",
      icon: "package",
      kind: "support" as const,
      required_skills: ["orders"],
      sort_order: 2,
    },
  ];
  const { error } = await admin.from("conversation_start_options").insert(defaults);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings/start-options");
  return { ok: true };
}
