import { redirect } from "next/navigation";
import { requireActiveContext } from "@/lib/active-context";
import { getServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/team";
import { seedDefaultStartOptions } from "@/app/dashboard/_actions/start-options";
import { StartOptionsSection } from "@/app/dashboard/_components/settings/StartOptionsSection";

export const dynamic = "force-dynamic";

export default async function SettingsStartOptionsPage() {
  const ctx = await requireActiveContext();
  const guard = await requireRole(ctx.business.id, "owner");
  if (!guard.ok) redirect("/dashboard/settings");

  const admin = getServiceClient();
  const { data: inboxes } = await admin
    .from("inboxes")
    .select("id, name")
    .eq("business_id", ctx.business.id)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  const defaultInbox = inboxes?.[0];
  if (!defaultInbox) {
    return (
      <div className="rounded-2xl border border-dashed border-mist bg-white/50 p-12 text-center">
        <p className="text-[15px] text-ink">No inbox yet.</p>
        <p className="text-[13px] text-deep/60 mt-1">
          Create an inbox first — start options are scoped per inbox.
        </p>
      </div>
    );
  }

  let { data: options } = await admin
    .from("conversation_start_options")
    .select("id, label, description, icon, kind, required_skills, sort_order, is_active")
    .eq("inbox_id", defaultInbox.id)
    .order("sort_order", { ascending: true });

  // First-visit seed: drop three sensible defaults so the empty state
  // doesn't greet new owners with a blank slate. Re-read after seeding so
  // the section gets the persisted rows (with real ids/sort_order).
  if (!options || options.length === 0) {
    const seed = await seedDefaultStartOptions(ctx.business.id, defaultInbox.id);
    if (seed.ok) {
      const { data: seeded } = await admin
        .from("conversation_start_options")
        .select("id, label, description, icon, kind, required_skills, sort_order, is_active")
        .eq("inbox_id", defaultInbox.id)
        .order("sort_order", { ascending: true });
      options = seeded ?? [];
    } else {
      options = [];
    }
  }

  const multipleInboxes = (inboxes?.length ?? 0) > 1;

  return (
    <StartOptionsSection
      inboxId={defaultInbox.id}
      inboxName={defaultInbox.name}
      multipleInboxes={multipleInboxes}
      options={(options ?? []).map((o) => ({
        id: o.id,
        label: o.label,
        description: o.description,
        icon: o.icon,
        kind: o.kind as "support" | "order" | "direct",
        required_skills: o.required_skills,
        sort_order: o.sort_order,
        is_active: o.is_active,
      }))}
    />
  );
}
