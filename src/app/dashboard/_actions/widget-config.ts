"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getServerClient, getServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/team";
import { isLauncherIcon } from "@/app/dashboard/_components/settings/launcher-icons";

type Ok<T = unknown> = { ok: true } & T;
type Err = { ok: false; error: string };
type ActionResult<T = unknown> = Ok<T> | Err;

export type Roundness = "sharp" | "rounded" | "pill";
export type ButtonStyle = "solid" | "outline" | "ghost";
export type BubbleStyle = "rounded" | "square" | "tail";

export type WidgetConfigInput = {
  primary_color: string;
  roundness: Roundness;
  button_style: ButtonStyle;
  bubble_style: BubbleStyle;
  launcher_icon_preset: string | null;
  launcher_icon_url: string | null;
  greeting_message: string | null;
};

const ROUNDNESS: ReadonlyArray<Roundness> = ["sharp", "rounded", "pill"];
const BUTTON_STYLES: ReadonlyArray<ButtonStyle> = ["solid", "outline", "ghost"];
const BUBBLE_STYLES: ReadonlyArray<BubbleStyle> = ["rounded", "square", "tail"];
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const GREETING_MAX = 280;
const ICON_MAX_BYTES = 1 * 1024 * 1024;
const ICON_MIME = new Set(["image/png", "image/webp", "image/svg+xml"]);

async function activeBusinessId(): Promise<string | null> {
  return (await cookies()).get("chatkit_active_biz")?.value ?? null;
}

function normalizeGreeting(raw: string | null): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: "greeting must be a string" };
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  if (trimmed.length > GREETING_MAX) {
    return { ok: false, error: `greeting must be ≤ ${GREETING_MAX} chars` };
  }
  // Reject markdown beyond **bold** and [label](https://…). Headings,
  // lists, fenced code, images, inline html — all out. The widget's
  // markdown subset only handles the two patterns above; anything else
  // would render as literal characters and surprise the user.
  const stripped = trimmed
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\(https:\/\/[^\s)]+\)/g, "$1");
  if (/[#`<>_*~]|^\s*[-*+]\s/m.test(stripped)) {
    return {
      ok: false,
      error: "greeting only supports **bold** and [label](https://…) links",
    };
  }
  // Validate every link is https — we already covered that in the
  // strip regex, but the user might paste `[x](http://…)` which would
  // survive stripping and end up in the markdown renderer as a raw
  // bracket. Reject explicitly.
  if (/\[[^\]]+\]\((?!https:\/\/)[^)]+\)/.test(trimmed)) {
    return { ok: false, error: "greeting links must use https://" };
  }
  return { ok: true, value: trimmed };
}

function expectedIconHostFragment(): string {
  // The public URL Supabase storage hands us looks like
  //   <SUPABASE_URL>/storage/v1/object/public/widget-icons/<biz>/<file>
  // We assert the URL starts with the project's public URL and the
  // bucket segment matches.
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/widget-icons/`;
}

function normalizeIconUrl(raw: string | null, businessId: string): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: "icon URL must be a string" };
  const prefix = expectedIconHostFragment();
  if (!prefix || !raw.startsWith(prefix)) {
    return { ok: false, error: "icon URL must point at the widget-icons bucket" };
  }
  const rest = raw.slice(prefix.length);
  const firstSegment = rest.split("/")[0];
  if (firstSegment !== businessId) {
    return { ok: false, error: "icon URL must belong to this business" };
  }
  return { ok: true, value: raw };
}

export async function saveWidgetConfig(input: WidgetConfigInput): Promise<ActionResult> {
  const businessId = await activeBusinessId();
  if (!businessId) return { ok: false, error: "no active business" };
  const guard = await requireRole(businessId, "owner");
  if (!guard.ok) return guard;

  if (typeof input.primary_color !== "string" || !HEX_RE.test(input.primary_color)) {
    return { ok: false, error: "primary color must be a 6-digit hex (#RRGGBB)" };
  }
  const primaryColor = input.primary_color.toLowerCase();

  if (!(ROUNDNESS as readonly string[]).includes(input.roundness)) {
    return { ok: false, error: "invalid roundness" };
  }
  if (!(BUTTON_STYLES as readonly string[]).includes(input.button_style)) {
    return { ok: false, error: "invalid button style" };
  }
  if (!(BUBBLE_STYLES as readonly string[]).includes(input.bubble_style)) {
    return { ok: false, error: "invalid bubble style" };
  }

  let launcher_icon_preset: string | null = null;
  if (input.launcher_icon_preset !== null) {
    if (typeof input.launcher_icon_preset !== "string" || !isLauncherIcon(input.launcher_icon_preset)) {
      return { ok: false, error: "unknown launcher icon preset" };
    }
    launcher_icon_preset = input.launcher_icon_preset;
  }

  const iconUrlCheck = normalizeIconUrl(input.launcher_icon_url, businessId);
  if (!iconUrlCheck.ok) return iconUrlCheck;

  const greeting = normalizeGreeting(input.greeting_message);
  if (!greeting.ok) return greeting;

  const admin = getServiceClient();
  const { error } = await admin
    .from("widget_config")
    .upsert(
      {
        business_id: businessId,
        primary_color: primaryColor,
        roundness: input.roundness,
        button_style: input.button_style,
        bubble_style: input.bubble_style,
        launcher_icon_preset,
        launcher_icon_url: iconUrlCheck.value,
        greeting_message: greeting.value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id" },
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings/widget-appearance");
  revalidatePath("/embed/customer");
  return { ok: true };
}

export async function clearLauncherIcon(): Promise<ActionResult> {
  const businessId = await activeBusinessId();
  if (!businessId) return { ok: false, error: "no active business" };
  const guard = await requireRole(businessId, "owner");
  if (!guard.ok) return guard;

  const admin = getServiceClient();
  const { error } = await admin
    .from("widget_config")
    .update({ launcher_icon_url: null, updated_at: new Date().toISOString() })
    .eq("business_id", businessId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings/widget-appearance");
  revalidatePath("/embed/customer");
  return { ok: true };
}

export async function resetWidgetConfig(): Promise<ActionResult> {
  const businessId = await activeBusinessId();
  if (!businessId) return { ok: false, error: "no active business" };
  const guard = await requireRole(businessId, "owner");
  if (!guard.ok) return guard;

  const admin = getServiceClient();
  const { error } = await admin
    .from("widget_config")
    .delete()
    .eq("business_id", businessId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings/widget-appearance");
  revalidatePath("/embed/customer");
  return { ok: true };
}

export async function uploadLauncherIcon(
  formData: FormData,
): Promise<ActionResult<{ iconUrl: string }>> {
  const sb = await getServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "not signed in" };

  const businessId = await activeBusinessId();
  if (!businessId) return { ok: false, error: "no active business" };
  const guard = await requireRole(businessId, "owner");
  if (!guard.ok) return guard;

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "missing file" };
  if (file.size > ICON_MAX_BYTES) return { ok: false, error: "icon must be ≤ 1 MB" };
  if (!ICON_MIME.has(file.type)) {
    return { ok: false, error: "icon must be PNG, WebP, or SVG" };
  }

  const ext = file.name.includes(".")
    ? file.name.split(".").pop()!.toLowerCase()
    : file.type === "image/svg+xml"
      ? "svg"
      : file.type === "image/webp"
        ? "webp"
        : "png";
  const key = `${businessId}/${randomUUID()}.${ext}`;

  const admin = getServiceClient();
  const arrayBuffer = await file.arrayBuffer();
  const { error: upErr } = await admin.storage
    .from("widget-icons")
    .upload(key, Buffer.from(arrayBuffer), {
      contentType: file.type,
      upsert: false,
    });
  if (upErr) return { ok: false, error: upErr.message };

  const { data: publicUrl } = admin.storage
    .from("widget-icons")
    .getPublicUrl(key);
  return { ok: true, iconUrl: publicUrl.publicUrl };
}
