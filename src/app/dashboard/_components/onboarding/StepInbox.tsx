"use client";

import {
  INBOX_PURPOSES,
  INBOX_AUDIENCES,
  LABELS,
  type InboxPurpose,
  type Audience,
} from "@/lib/onboarding/enums";
import { Field, Select, BackContinue } from "@/app/dashboard/_components/ui/primitives";

export function StepInbox({
  pending,
  onBack,
  onContinue,
}: {
  pending: boolean;
  onBack: () => void;
  onContinue: (input: {
    name: string;
    purpose: InboxPurpose;
    audience: Audience;
  }) => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onContinue({
          name: String(fd.get("name") ?? ""),
          purpose: fd.get("purpose") as InboxPurpose,
          audience: fd.get("audience") as Audience,
        });
      }}
      className="space-y-5"
    >
      <Field
        label="Inbox name"
        name="name"
        placeholder="Customer support"
        autoComplete="off"
      />
      <Select
        label="What's it for?"
        name="purpose"
        options={INBOX_PURPOSES}
        labels={LABELS.purpose}
      />
      <Select
        label="Who does it serve?"
        name="audience"
        options={INBOX_AUDIENCES}
        labels={LABELS.audience}
      />

      <p className="text-[13px] text-deep/50 leading-relaxed">
        We&apos;ll generate an API key and webhook slot for this inbox. Embed it
        on the customer page or wire it into the courier app — anywhere the
        conversation should land here.
      </p>

      <BackContinue
        pending={pending}
        onBack={onBack}
        continueLabel="Finish"
        final
      />
    </form>
  );
}
