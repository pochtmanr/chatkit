import { redirect } from "next/navigation";
import { requireActiveContext } from "@/lib/active-context";
import { getServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/team";
import { WidgetAppearanceForm } from "@/app/dashboard/_components/settings/WidgetAppearanceForm";

export const dynamic = "force-dynamic";

const DEFAULTS = {
  primary_color: "#0F172A",
  roundness: "rounded",
  button_style: "solid",
  bubble_style: "rounded",
  launcher_icon_url: null,
  launcher_icon_preset: "message-circle",
  greeting_message: null,
} as const;

export default async function SettingsWidgetAppearancePage() {
  const ctx = await requireActiveContext();
  const guard = await requireRole(ctx.business.id, "owner");
  if (!guard.ok) redirect("/dashboard/settings");

  const admin = getServiceClient();
  const { data: row } = await admin
    .from("widget_config")
    .select("*")
    .eq("business_id", ctx.business.id)
    .maybeSingle();

  const config = {
    primary_color: row?.primary_color ?? DEFAULTS.primary_color,
    roundness: (row?.roundness ?? DEFAULTS.roundness) as "sharp" | "rounded" | "pill",
    button_style: (row?.button_style ?? DEFAULTS.button_style) as "solid" | "outline" | "ghost",
    bubble_style: (row?.bubble_style ?? DEFAULTS.bubble_style) as "rounded" | "square" | "tail",
    launcher_icon_preset: row?.launcher_icon_preset ?? DEFAULTS.launcher_icon_preset,
    launcher_icon_url: row?.launcher_icon_url ?? null,
    greeting_message: row?.greeting_message ?? null,
  };

  return (
    <WidgetAppearanceForm
      businessName={ctx.business.name}
      initial={config}
    />
  );
}
