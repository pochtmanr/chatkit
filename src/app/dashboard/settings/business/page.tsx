import Link from "next/link";
import { requireActiveContext } from "@/lib/active-context";
import { getServerClient } from "@/lib/supabase/server";
import { BusinessProfileForm } from "@/app/dashboard/_components/settings/BusinessProfileForm";
import { ProjectsList } from "@/app/dashboard/_components/settings/ProjectsList";
import { InboxesList } from "@/app/dashboard/_components/settings/InboxesList";
import { AllowedOriginsCard } from "@/app/dashboard/_components/settings/AllowedOriginsCard";
import type { Business } from "@/lib/businesses";

export default async function SettingsBusinessPage({
  searchParams,
}: {
  searchParams: Promise<{ capReached?: string }>;
}) {
  const ctx = await requireActiveContext();
  const { capReached } = await searchParams;

  // Re-fetch the active business with profile columns. ctx already has them,
  // but stay explicit so this page survives any future trimming of the
  // active-context payload.
  const sb = await getServerClient();
  const { data: business } = await sb
    .from("businesses")
    .select(
      `
      id, owner_user_id, name, slug, industry, company_size, plan, status,
      onboarding_completed_at, logo_url, address_line1, address_line2,
      city, region, postal_code, country, contact_email, contact_phone,
      website_url, about, allowed_origins
    `,
    )
    .eq("id", ctx.business.id)
    .single();
  if (!business) return null;

  return (
    <div className="space-y-10">
      {capReached && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-[14px] text-amber-900">
          You&apos;re at the 2-business limit. Contact us if you need more.
        </div>
      )}

      {ctx.businesses.length < 2 && (
        <div className="flex items-center justify-between rounded-2xl border border-mist/80 bg-white p-5">
          <div>
            <p className="text-[14px] text-ink font-medium">
              Need another business?
            </p>
            <p className="text-[12px] text-deep/60">
              You can have up to two.
            </p>
          </div>
          <Link
            href="/dashboard/businesses/new"
            className="rounded-full bg-ink text-white px-4 py-2 text-[14px] font-medium hover:bg-deep transition-colors"
          >
            + Add business
          </Link>
        </div>
      )}

      <BusinessProfileForm business={business as Business} />

      <AllowedOriginsCard
        businessId={business.id}
        origins={(business as Business).allowed_origins ?? []}
      />

      <ProjectsList groups={ctx.groups} />

      <InboxesList groups={ctx.groups} />
    </div>
  );
}
