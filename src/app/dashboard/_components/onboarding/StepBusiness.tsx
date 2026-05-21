"use client";

import {
  COMPANY_SIZES,
  INDUSTRIES,
  LABELS,
  type CompanySize,
  type Industry,
} from "@/lib/onboarding/enums";
import { Field, Select, SegmentedControl, BackContinue } from "@/app/dashboard/_components/ui/primitives";

export function StepBusiness({
  pending,
  onBack,
  onContinue,
}: {
  pending: boolean;
  onBack: () => void;
  onContinue: (input: {
    name: string;
    companySize: CompanySize;
    industry: Industry;
  }) => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onContinue({
          name: String(fd.get("name") ?? ""),
          companySize: fd.get("companySize") as CompanySize,
          industry: fd.get("industry") as Industry,
        });
      }}
      className="space-y-5"
    >
      <Field
        label="Business name"
        name="name"
        placeholder="Acme Delivery Inc."
        autoComplete="organization"
      />
      <SegmentedControl
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
      <Select
        label="Industry"
        name="industry"
        options={INDUSTRIES}
        labels={LABELS.industry}
      />
      <BackContinue pending={pending} onBack={onBack} />
    </form>
  );
}
