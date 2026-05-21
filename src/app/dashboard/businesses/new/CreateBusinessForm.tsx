"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  COMPANY_SIZES,
  INDUSTRIES,
  INBOX_PURPOSES,
  INBOX_AUDIENCES,
  LABELS,
  type CompanySize,
  type Industry,
  type InboxPurpose,
  type Audience,
} from "@/lib/onboarding/enums";
import {
  Field,
  Select,
  SegmentedControl,
} from "@/app/dashboard/_components/ui/primitives";
import { createBusinessFromForm } from "@/app/dashboard/_actions/businesses";

export function CreateBusinessForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createBusinessFromForm({
        name: String(fd.get("name") ?? ""),
        companySize: fd.get("companySize") as CompanySize,
        industry: fd.get("industry") as Industry,
        contactEmail: String(fd.get("contactEmail") ?? "") || null,
        websiteUrl: String(fd.get("websiteUrl") ?? "") || null,
        country: String(fd.get("country") ?? "").toUpperCase() || null,
        projectName: String(fd.get("projectName") ?? ""),
        inboxName: String(fd.get("inboxName") ?? ""),
        inboxPurpose: fd.get("inboxPurpose") as InboxPurpose,
        inboxAudience: fd.get("inboxAudience") as Audience,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/dashboard/businesses/${res.businessId}/edit?created=1`);
    });
  }

  return (
    <form action={onSubmit} className="space-y-8 max-w-4xl">
      <section className="rounded-2xl bg-white border border-mist/80 p-6 md:p-8 space-y-6">
        <header className="space-y-1">
          <h2 className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
            Business
          </h2>
          <p className="text-[13px] text-deep/60">
            What we call this workspace internally.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Business name"
            name="name"
            placeholder="Acme Delivery Inc."
          />
          <Field
            label="Country (ISO code)"
            name="country"
            maxLength={2}
            placeholder="GB"
            required={false}
          />
        </div>

        <SegmentedControl<CompanySize>
          label="Team size"
          name="companySize"
          options={COMPANY_SIZES}
          labels={
            Object.fromEntries(COMPANY_SIZES.map((s) => [s, s])) as Record<
              CompanySize,
              string
            >
          }
        />

        <Select<Industry>
          label="Industry"
          name="industry"
          options={INDUSTRIES}
          labels={LABELS.industry}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Contact email"
            type="email"
            name="contactEmail"
            required={false}
          />
          <Field
            label="Website"
            name="websiteUrl"
            placeholder="https://…"
            required={false}
          />
        </div>
      </section>

      <section className="rounded-2xl bg-white border border-mist/80 p-6 md:p-8 space-y-6">
        <header className="space-y-1">
          <h2 className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
            Default project + inbox
          </h2>
          <p className="text-[13px] text-deep/60">
            Every business needs at least one inbox. You can rename or split
            later.
          </p>
        </header>
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Project name"
            name="projectName"
            defaultValue="Workspace"
          />
          <Field label="Inbox name" name="inboxName" defaultValue="Main" />
        </div>
        <Select<InboxPurpose>
          label="Inbox purpose"
          name="inboxPurpose"
          options={INBOX_PURPOSES}
          labels={LABELS.purpose}
        />
        <SegmentedControl<Audience>
          label="Audience"
          name="inboxAudience"
          options={INBOX_AUDIENCES}
          labels={LABELS.audience}
        />
      </section>

      <div className="flex items-center justify-end gap-3">
        {error && (
          <p className="text-[13px] font-medium text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            {error}
          </p>
        )}
        <Link
          href="/dashboard"
          className="rounded-full bg-white border border-mist px-4 py-2 text-[14px] font-medium text-ink hover:bg-mist/40 transition-colors"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-ink text-white px-5 py-2 text-[14px] font-medium hover:bg-deep transition-colors disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create business"}
        </button>
      </div>
    </form>
  );
}
