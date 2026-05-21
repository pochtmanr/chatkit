"use client";

import { Field, BackContinue } from "@/app/dashboard/_components/ui/primitives";

export function StepProject({
  pending,
  onBack,
  onContinue,
}: {
  pending: boolean;
  onBack: () => void;
  onContinue: (input: { name: string; description?: string }) => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onContinue({
          name: String(fd.get("name") ?? ""),
          description: String(fd.get("description") ?? ""),
        });
      }}
      className="space-y-5"
    >
      <Field
        label="Project name"
        name="name"
        placeholder="Customer support"
        autoComplete="off"
      />
      <label className="block">
        <span className="text-[13px] font-medium text-deep/70">
          Description (optional)
        </span>
        <textarea
          name="description"
          rows={3}
          maxLength={280}
          placeholder="e.g. All conversations from the customer-facing apps live here."
          className="mt-1.5 w-full rounded-xl border border-mist bg-white px-4 py-3 text-[15px] text-ink placeholder:text-deep/30 shadow-[0_1px_2px_rgba(11,11,11,0.03)] focus:outline-none focus:border-deep/40 focus:ring-2 focus:ring-deep/10 transition-all resize-none"
        />
      </label>

      <p className="text-[13px] text-deep/50 leading-relaxed">
        A project groups related inboxes. A delivery company might use one
        project for{" "}
        <em className="font-serif-italic">logistics</em>{" "}
        (couriers + warehouse inboxes) and another for{" "}
        <em className="font-serif-italic">customers</em>.
      </p>

      <BackContinue pending={pending} onBack={onBack} />
    </form>
  );
}
