"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { getServerClient, getServiceClient } from "@/lib/supabase/server";
import type { TablesUpdate } from "@/lib/supabase/database.types";
import {
  COMPANY_SIZES,
  INDUSTRIES,
  INBOX_PURPOSES,
  INBOX_AUDIENCES,
  type CompanySize,
  type Industry,
  type InboxPurpose,
  type Audience,
} from "@/lib/onboarding/enums";
import { slugWithSuffix, newApiKey } from "@/lib/onboarding/slug";
import { setActiveBusinessAndInbox } from "@/app/dashboard/_actions/active-context";

type Ok<T = unknown> = { ok: true } & T;
type Err = { ok: false; error: string };
type ActionResult<T = unknown> = Ok<T> | Err;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HTTPS_RE = /^https:\/\//i;
const ALLOWED_LOGO_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

export async function updateBusiness(input: {
  businessId: string;
  name?: string;
  industry?: Industry;
  companySize?: CompanySize;
}): Promise<ActionResult> {
  const sb = await getServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "not signed in" };

  const patch: { name?: string; industry?: string; company_size?: string } = {};
  if (input.name !== undefined) {
    const n = input.name.trim();
    if (n.length < 2 || n.length > 60) {
      return { ok: false, error: "name must be 2–60 chars" };
    }
    patch.name = n;
  }
  if (input.industry !== undefined) {
    if (!INDUSTRIES.includes(input.industry)) {
      return { ok: false, error: "invalid industry" };
    }
    patch.industry = input.industry;
  }
  if (input.companySize !== undefined) {
    if (!COMPANY_SIZES.includes(input.companySize)) {
      return { ok: false, error: "invalid company size" };
    }
    patch.company_size = input.companySize;
  }
  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await sb
    .from("businesses")
    .update(patch)
    .eq("id", input.businessId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function addSecondBusiness(input: {
  name: string;
  companySize: CompanySize;
  industry: Industry;
  projectName: string;
  inboxName: string;
  inboxPurpose: InboxPurpose;
  inboxAudience: Audience;
}): Promise<
  ActionResult<{
    businessId: string;
    projectId: string;
    inboxId: string;
    apiKey: string;
  }>
> {
  const sb = await getServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "not signed in" };

  const name = input.name.trim();
  if (name.length < 2 || name.length > 60) {
    return { ok: false, error: "business name must be 2–60 chars" };
  }
  if (!COMPANY_SIZES.includes(input.companySize)) {
    return { ok: false, error: "invalid company size" };
  }
  if (!INDUSTRIES.includes(input.industry)) {
    return { ok: false, error: "invalid industry" };
  }

  const projectName = input.projectName.trim();
  if (projectName.length < 2 || projectName.length > 60) {
    return { ok: false, error: "project name must be 2–60 chars" };
  }

  const inboxName = input.inboxName.trim();
  if (inboxName.length < 2 || inboxName.length > 60) {
    return { ok: false, error: "inbox name must be 2–60 chars" };
  }
  if (!INBOX_PURPOSES.includes(input.inboxPurpose)) {
    return { ok: false, error: "invalid inbox purpose" };
  }
  if (!INBOX_AUDIENCES.includes(input.inboxAudience)) {
    return { ok: false, error: "invalid inbox audience" };
  }

  const { data: business, error: bizErr } = await sb
    .from("businesses")
    .insert({
      owner_user_id: user.id,
      name,
      slug: slugWithSuffix(name, "business"),
      industry: input.industry,
      company_size: input.companySize,
      plan: "starter",
      status: "active",
      onboarding_completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (bizErr || !business) {
    if (
      bizErr?.message.includes("business limit reached") ||
      bizErr?.code === "P0001"
    ) {
      return {
        ok: false,
        error: "You already have the maximum of 2 businesses.",
      };
    }
    return { ok: false, error: bizErr?.message ?? "couldn't create business" };
  }

  const { data: project, error: projErr } = await sb
    .from("projects")
    .insert({
      business_id: business.id,
      name: projectName,
      slug: slugWithSuffix(projectName, "project"),
    })
    .select("id")
    .single();
  if (projErr || !project) {
    return {
      ok: false,
      error: projErr?.message ?? "couldn't create project",
    };
  }

  const apiKey = newApiKey();
  const { data: inbox, error: inboxErr } = await sb
    .from("inboxes")
    .insert({
      project_id: project.id,
      business_id: business.id,
      name: inboxName,
      slug: slugWithSuffix(inboxName, "inbox"),
      purpose: input.inboxPurpose,
      audience: input.inboxAudience,
      api_key: apiKey,
    })
    .select("id")
    .single();
  if (inboxErr || !inbox) {
    if (inboxErr?.message?.toLowerCase().includes("inbox limit reached")) {
      return {
        ok: false,
        error:
          "Inbox limit reached for your plan. Upgrade in Settings → Billing.",
      };
    }
    return {
      ok: false,
      error: inboxErr?.message ?? "couldn't create inbox",
    };
  }

  revalidatePath("/dashboard", "layout");
  return {
    ok: true,
    businessId: business.id,
    projectId: project.id,
    inboxId: inbox.id,
    apiKey,
  };
}

export async function createBusinessFromForm(input: {
  name: string;
  companySize: CompanySize;
  industry: Industry;
  contactEmail?: string | null;
  websiteUrl?: string | null;
  country?: string | null;
  projectName: string;
  inboxName: string;
  inboxPurpose: InboxPurpose;
  inboxAudience: Audience;
}): Promise<
  ActionResult<{
    businessId: string;
    projectId: string;
    inboxId: string;
    apiKey: string;
  }>
> {
  const sb = await getServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "not signed in" };

  const name = input.name.trim();
  if (name.length < 2 || name.length > 60) {
    return { ok: false, error: "business name must be 2–60 chars" };
  }
  if (!COMPANY_SIZES.includes(input.companySize)) {
    return { ok: false, error: "invalid company size" };
  }
  if (!INDUSTRIES.includes(input.industry)) {
    return { ok: false, error: "invalid industry" };
  }

  const country = input.country?.trim() || null;
  if (country && !/^[A-Z]{2}$/.test(country)) {
    return { ok: false, error: "country must be ISO-3166-1 alpha-2" };
  }

  const contactEmail = input.contactEmail?.trim() || null;
  if (contactEmail && !EMAIL_RE.test(contactEmail)) {
    return { ok: false, error: "contact email is invalid" };
  }

  const websiteUrl = input.websiteUrl?.trim() || null;
  if (websiteUrl && !HTTPS_RE.test(websiteUrl)) {
    return { ok: false, error: "website URL must start with https://" };
  }

  const projectName = input.projectName.trim();
  if (projectName.length < 2 || projectName.length > 60) {
    return { ok: false, error: "project name must be 2–60 chars" };
  }

  const inboxName = input.inboxName.trim();
  if (inboxName.length < 2 || inboxName.length > 60) {
    return { ok: false, error: "inbox name must be 2–60 chars" };
  }
  if (!INBOX_PURPOSES.includes(input.inboxPurpose)) {
    return { ok: false, error: "invalid inbox purpose" };
  }
  if (!INBOX_AUDIENCES.includes(input.inboxAudience)) {
    return { ok: false, error: "invalid inbox audience" };
  }

  const { data: business, error: bizErr } = await sb
    .from("businesses")
    .insert({
      owner_user_id: user.id,
      name,
      slug: slugWithSuffix(name, "business"),
      industry: input.industry,
      company_size: input.companySize,
      plan: "free",
      status: "active",
      onboarding_completed_at: new Date().toISOString(),
      contact_email: contactEmail,
      website_url: websiteUrl,
      country,
    })
    .select("id")
    .single();
  if (bizErr || !business) {
    if (
      bizErr?.message.toLowerCase().includes("business limit reached") ||
      bizErr?.code === "P0001"
    ) {
      return {
        ok: false,
        error: "You already have the maximum of 2 businesses.",
      };
    }
    return { ok: false, error: bizErr?.message ?? "couldn't create business" };
  }

  const { data: project, error: projErr } = await sb
    .from("projects")
    .insert({
      business_id: business.id,
      name: projectName,
      slug: slugWithSuffix(projectName, "project"),
    })
    .select("id")
    .single();
  if (projErr || !project) {
    return {
      ok: false,
      error: projErr?.message ?? "couldn't create project",
    };
  }

  const apiKey = newApiKey();
  const { data: inbox, error: inboxErr } = await sb
    .from("inboxes")
    .insert({
      project_id: project.id,
      business_id: business.id,
      name: inboxName,
      slug: slugWithSuffix(inboxName, "inbox"),
      purpose: input.inboxPurpose,
      audience: input.inboxAudience,
      api_key: apiKey,
    })
    .select("id")
    .single();
  if (inboxErr || !inbox) {
    if (inboxErr?.message?.toLowerCase().includes("inbox limit reached")) {
      return {
        ok: false,
        error:
          "Inbox limit reached for your plan. Upgrade in Settings → Billing.",
      };
    }
    return {
      ok: false,
      error: inboxErr?.message ?? "couldn't create inbox",
    };
  }

  await setActiveBusinessAndInbox(business.id, inbox.id);

  revalidatePath("/dashboard", "layout");
  return {
    ok: true,
    businessId: business.id,
    projectId: project.id,
    inboxId: inbox.id,
    apiKey,
  };
}

export async function updateBusinessProfile(input: {
  businessId: string;
  name?: string;
  industry?: Industry;
  companySize?: CompanySize;
  logoUrl?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  websiteUrl?: string | null;
  about?: string | null;
}): Promise<ActionResult> {
  const sb = await getServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "not signed in" };

  const patch: TablesUpdate<"businesses"> = {};

  if (input.name !== undefined) {
    const n = input.name.trim();
    if (n.length < 2 || n.length > 60)
      return { ok: false, error: "name must be 2–60 chars" };
    patch.name = n;
  }
  if (input.industry !== undefined) {
    if (!INDUSTRIES.includes(input.industry))
      return { ok: false, error: "invalid industry" };
    patch.industry = input.industry;
  }
  if (input.companySize !== undefined) {
    if (!COMPANY_SIZES.includes(input.companySize))
      return { ok: false, error: "invalid company size" };
    patch.company_size = input.companySize;
  }

  const cap = (
    raw: string | null | undefined,
    max: number,
    name: string,
  ): string | null | undefined => {
    if (raw === undefined) return undefined;
    if (raw === null) return null;
    const t = raw.trim();
    if (!t) return null;
    if (t.length > max) throw new Error(`${name} exceeds ${max} chars`);
    return t;
  };

  try {
    const setIf = <K extends keyof TablesUpdate<"businesses">>(
      key: K,
      value: string | null | undefined,
    ) => {
      if (value !== undefined) {
        (patch as Record<string, string | null>)[key as string] = value;
      }
    };

    setIf("logo_url", cap(input.logoUrl, 500, "logo URL"));
    setIf("address_line1", cap(input.addressLine1, 200, "address"));
    setIf("address_line2", cap(input.addressLine2, 200, "address"));
    setIf("city", cap(input.city, 100, "city"));
    setIf("region", cap(input.region, 100, "region"));
    setIf("postal_code", cap(input.postalCode, 32, "postal code"));
    setIf("country", cap(input.country, 2, "country"));
    setIf("contact_email", cap(input.contactEmail, 200, "email"));
    setIf("contact_phone", cap(input.contactPhone, 64, "phone"));
    setIf("website_url", cap(input.websiteUrl, 500, "website URL"));
    setIf("about", cap(input.about, 1000, "about"));
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "validation failed",
    };
  }

  if (typeof patch.country === "string" && !/^[A-Z]{2}$/.test(patch.country)) {
    return {
      ok: false,
      error: "country must be ISO-3166-1 alpha-2 (e.g. GB)",
    };
  }
  if (
    typeof patch.contact_email === "string" &&
    !EMAIL_RE.test(patch.contact_email)
  ) {
    return { ok: false, error: "contact email is invalid" };
  }
  if (
    typeof patch.website_url === "string" &&
    !HTTPS_RE.test(patch.website_url)
  ) {
    return { ok: false, error: "website URL must start with https://" };
  }
  if (typeof patch.logo_url === "string" && !HTTPS_RE.test(patch.logo_url)) {
    return { ok: false, error: "logo URL must start with https://" };
  }

  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await sb
    .from("businesses")
    .update(patch)
    .eq("id", input.businessId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function uploadBusinessLogo(
  formData: FormData,
): Promise<ActionResult<{ logoUrl: string }>> {
  const sb = await getServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "not signed in" };

  const businessId = String(formData.get("businessId") ?? "");
  const file = formData.get("file");
  if (!businessId) return { ok: false, error: "missing businessId" };
  if (!(file instanceof File)) return { ok: false, error: "missing file" };
  if (file.size > 5 * 1024 * 1024)
    return { ok: false, error: "logo must be ≤ 5 MB" };
  if (!ALLOWED_LOGO_MIME.has(file.type))
    return { ok: false, error: "logo must be PNG, JPEG, WebP, or SVG" };

  // Ownership check via RLS-aware query — must own the business.
  const { data: biz, error: ownErr } = await sb
    .from("businesses")
    .select("id, logo_url")
    .eq("id", businessId)
    .maybeSingle();
  if (ownErr || !biz) return { ok: false, error: "business not found" };

  const ext = file.name.includes(".")
    ? file.name.split(".").pop()!.toLowerCase()
    : "png";
  const key = `${businessId}/${randomUUID()}.${ext}`;

  const admin = getServiceClient();
  const arrayBuffer = await file.arrayBuffer();
  const { error: upErr } = await admin.storage
    .from("business-logos")
    .upload(key, Buffer.from(arrayBuffer), {
      contentType: file.type,
      upsert: false,
    });
  if (upErr) return { ok: false, error: upErr.message };

  const { data: publicUrl } = admin.storage
    .from("business-logos")
    .getPublicUrl(key);
  const logoUrl = publicUrl.publicUrl;

  const { error: updErr } = await sb
    .from("businesses")
    .update({ logo_url: logoUrl })
    .eq("id", businessId);
  if (updErr) return { ok: false, error: updErr.message };

  if (biz.logo_url) {
    const previousKey = biz.logo_url.split("/business-logos/")[1];
    if (previousKey) {
      void admin.storage.from("business-logos").remove([previousKey]);
    }
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true, logoUrl };
}
