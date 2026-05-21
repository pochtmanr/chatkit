"use client";

import { useState, useTransition } from "react";
import {
  COMPANY_SIZES,
  INDUSTRIES,
  LABELS,
  type CompanySize,
  type Industry,
} from "@/lib/onboarding/enums";
import {
  Field,
  Select,
  SegmentedControl,
} from "@/app/dashboard/_components/ui/primitives";
import { updateBusinessProfile } from "@/app/dashboard/_actions/businesses";
import { BusinessLogoUploader } from "@/app/dashboard/_components/ui/BusinessLogoUploader";
import type { Business } from "@/lib/businesses";

export function BusinessProfileForm({ business }: { business: Business }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function save(formData: FormData) {
    startTransition(async () => {
      const res = await updateBusinessProfile({
        businessId: business.id,
        name: String(formData.get("name") ?? ""),
        companySize: formData.get("companySize") as CompanySize,
        industry: formData.get("industry") as Industry,
        addressLine1: pick(formData, "addressLine1"),
        addressLine2: pick(formData, "addressLine2"),
        city: pick(formData, "city"),
        region: pick(formData, "region"),
        postalCode: pick(formData, "postalCode"),
        country: pick(formData, "country")?.toUpperCase() ?? null,
        contactEmail: pick(formData, "contactEmail"),
        contactPhone: pick(formData, "contactPhone"),
        websiteUrl: pick(formData, "websiteUrl"),
        about: pick(formData, "about"),
      });
      if (!res.ok) return setError(res.error);
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <form action={save} className="space-y-8">
      {/* Identity ------------------------------------------------ */}
      <section className="rounded-2xl bg-white border border-mist/80 p-6 md:p-8 space-y-6">
        <div className="space-y-1">
          <h2 className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
            Identity
          </h2>
          <p className="text-[13px] text-deep/60">
            Shown in the sidebar and on internal screens.
          </p>
        </div>

        <BusinessLogoUploader
          businessId={business.id}
          logoUrl={business.logo_url}
          businessName={business.name}
        />

        <div className="grid gap-4 md:grid-cols-2 max-w-3xl">
          <Field
            label="Business name"
            name="name"
            defaultValue={business.name}
            placeholder="Acme Delivery Inc."
          />
          <Field
            label="Website"
            name="websiteUrl"
            defaultValue={business.website_url ?? ""}
            placeholder="https://acme.example"
            required={false}
          />
        </div>
        <SegmentedControl<CompanySize>
          label="Team size"
          name="companySize"
          options={COMPANY_SIZES}
          labels={
            Object.fromEntries(
              COMPANY_SIZES.map((s) => [s, s]),
            ) as Record<CompanySize, string>
          }
          defaultValue={(business.company_size as CompanySize) ?? undefined}
        />
        <Select<Industry>
          label="Industry"
          name="industry"
          options={INDUSTRIES}
          labels={LABELS.industry}
          defaultValue={(business.industry as Industry) ?? undefined}
        />
      </section>

      {/* Address ------------------------------------------------- */}
      <section className="rounded-2xl bg-white border border-mist/80 p-6 md:p-8 space-y-6">
        <div className="space-y-1">
          <h2 className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
            Address
          </h2>
          <p className="text-[13px] text-deep/60">
            For invoices and on-file records.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 max-w-3xl">
          <Field
            label="Address line 1"
            name="addressLine1"
            defaultValue={business.address_line1 ?? ""}
            required={false}
          />
          <Field
            label="Address line 2"
            name="addressLine2"
            defaultValue={business.address_line2 ?? ""}
            required={false}
          />
          <Field
            label="City"
            name="city"
            defaultValue={business.city ?? ""}
            required={false}
          />
          <Field
            label="State / region"
            name="region"
            defaultValue={business.region ?? ""}
            required={false}
          />
          <Field
            label="Postal code"
            name="postalCode"
            defaultValue={business.postal_code ?? ""}
            required={false}
          />
          <Field
            label="Country (ISO code)"
            name="country"
            maxLength={2}
            defaultValue={business.country ?? ""}
            placeholder="GB"
            required={false}
          />
        </div>
      </section>

      {/* Contact ------------------------------------------------- */}
      <section className="rounded-2xl bg-white border border-mist/80 p-6 md:p-8 space-y-6">
        <div className="space-y-1">
          <h2 className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
            Contact
          </h2>
          <p className="text-[13px] text-deep/60">
            How customers + partners reach you outside the widget.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 max-w-3xl">
          <Field
            label="Contact email"
            type="email"
            name="contactEmail"
            defaultValue={business.contact_email ?? ""}
            required={false}
          />
          <Field
            label="Contact phone"
            name="contactPhone"
            defaultValue={business.contact_phone ?? ""}
            required={false}
          />
        </div>
      </section>

      {/* About --------------------------------------------------- */}
      <section className="rounded-2xl bg-white border border-mist/80 p-6 md:p-8 space-y-3">
        <div className="space-y-1">
          <h2 className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
            About
          </h2>
          <p className="text-[13px] text-deep/60">
            Short blurb shown internally. Max 1000 characters.
          </p>
        </div>
        <textarea
          name="about"
          defaultValue={business.about ?? ""}
          maxLength={1000}
          rows={4}
          className="w-full rounded-xl border border-mist bg-white px-4 py-3 text-[14px] focus:outline-none focus:border-deep/40 focus:ring-2 focus:ring-deep/10 max-w-3xl"
        />
      </section>

      {/* Save bar ----------------------------------------------- */}
      <div className="flex items-center justify-end gap-3">
        {error && (
          <p className="text-[13px] font-medium text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-ink text-white px-5 py-2 text-[14px] font-medium hover:bg-deep transition-colors disabled:opacity-60"
        >
          {pending ? "Saving…" : saved ? "Saved" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function pick(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}
