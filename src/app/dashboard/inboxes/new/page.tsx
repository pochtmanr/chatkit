import { redirect } from "next/navigation";
import { requireActiveContext } from "@/lib/active-context";
import { getServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/app/dashboard/_components/shared/PageHeader";
import { CreateInboxForm } from "./CreateInboxForm";

export default async function NewInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const ctx = await requireActiveContext();
  const { projectId: preselectedProjectId } = await searchParams;

  const sb = await getServerClient();
  const { data: projects } = await sb
    .from("projects")
    .select("id, name")
    .eq("business_id", ctx.business.id)
    .is("archived_at", null)
    .order("name", { ascending: true });

  if (!projects || projects.length === 0) {
    redirect("/dashboard/settings");
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Inboxes"
        head="Create an"
        accent="inbox"
        description={`A new integration unit for ${ctx.business.name}. Each inbox has its own API key + webhook URL.`}
      />
      <CreateInboxForm
        projects={projects}
        preselectedProjectId={preselectedProjectId ?? projects[0].id}
      />
    </div>
  );
}
