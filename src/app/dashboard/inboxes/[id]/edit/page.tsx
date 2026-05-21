import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { requireActiveContext } from "@/lib/active-context";
import { getServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/app/dashboard/_components/shared/PageHeader";
import { InboxEditPanels } from "./InboxEditPanels";

export default async function EditInboxPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; key?: string }>;
}) {
  await requireActiveContext();
  const { id } = await params;
  const { created, key } = await searchParams;

  const sb = await getServerClient();
  const { data: inbox } = await sb
    .from("inboxes")
    .select(
      "id, business_id, project_id, name, slug, purpose, audience, api_key, webhook_url, archived_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!inbox) notFound();

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host =
    h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const chatAdminHost = `${proto}://${host}`;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Inboxes"
        head="Edit"
        accent="inbox"
        description={`Profile, key, webhook, and embed snippet for ${inbox.name}.`}
      />
      {created && key && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-[14px] text-emerald-800 space-y-2">
          <p>
            <strong>Inbox created.</strong> Copy the API key below now — it&apos;s
            the only time it&apos;s shown in full from this redirect.
          </p>
          <code className="block rounded-lg bg-white border border-emerald-200 px-3 py-2 font-mono text-[13px] text-ink overflow-x-auto">
            {key}
          </code>
        </div>
      )}
      <InboxEditPanels inbox={inbox} chatAdminHost={chatAdminHost} />
    </div>
  );
}
