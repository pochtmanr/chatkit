import { notFound } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { requireActiveContext } from "@/lib/active-context";
import { PageHeader } from "@/app/dashboard/_components/shared/PageHeader";
import { BusinessProfileForm } from "@/app/dashboard/_components/settings/BusinessProfileForm";
import type { Business } from "@/lib/businesses";

export default async function EditBusinessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  await requireActiveContext();
  const { id } = await params;
  const { created } = await searchParams;

  const sb = await getServerClient();
  const { data: business } = await sb
    .from("businesses")
    .select(
      `id, name, slug, plan, status, industry, company_size, onboarding_completed_at, logo_url, address_line1, address_line2, city, region, postal_code, country, contact_email, contact_phone, website_url, about`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!business) notFound();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workspace"
        head="Edit"
        accent="business"
        description={`Profile, logo, address, and contact info for ${business.name}.`}
      />
      {created && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-[14px] text-emerald-800">
          Business created. Fill in the rest of the profile when you have time.
        </div>
      )}
      <BusinessProfileForm business={business as Business} />
    </div>
  );
}
