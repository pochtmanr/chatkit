"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  INBOX_PURPOSES,
  INBOX_AUDIENCES,
  LABELS,
  type InboxPurpose,
  type Audience,
} from "@/lib/onboarding/enums";
import {
  Field,
  Select,
  SegmentedControl,
} from "@/app/dashboard/_components/ui/primitives";
import { createInboxInProject } from "@/app/dashboard/_actions/inboxes";

export function CreateInboxForm({
  projects,
  preselectedProjectId,
}: {
  projects: { id: string; name: string }[];
  preselectedProjectId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const projectLabels = Object.fromEntries(
    projects.map((p) => [p.id, p.name]),
  ) as Record<string, string>;

  function onSubmit(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createInboxInProject({
        projectId: String(fd.get("projectId") ?? ""),
        name: String(fd.get("name") ?? ""),
        purpose: fd.get("purpose") as InboxPurpose,
        audience: fd.get("audience") as Audience,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(
        `/dashboard/inboxes/${res.inboxId}/edit?created=1&key=${encodeURIComponent(res.apiKey)}`,
      );
    });
  }

  return (
    <form action={onSubmit} className="space-y-8 max-w-4xl">
      <section className="rounded-2xl bg-white border border-mist/80 p-6 md:p-8 space-y-6">
        <header className="space-y-1">
          <h2 className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
            Inbox
          </h2>
        </header>

        <Select<string>
          label="Project"
          name="projectId"
          options={projects.map((p) => p.id)}
          labels={projectLabels}
          defaultValue={preselectedProjectId}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Inbox name" name="name" placeholder="Sales · UK" />
        </div>

        <Select<InboxPurpose>
          label="Purpose"
          name="purpose"
          options={INBOX_PURPOSES}
          labels={LABELS.purpose}
        />
        <SegmentedControl<Audience>
          label="Audience"
          name="audience"
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
          href="/dashboard/settings"
          className="rounded-full bg-white border border-mist px-4 py-2 text-[14px] font-medium text-ink hover:bg-mist/40 transition-colors"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-ink text-white px-5 py-2 text-[14px] font-medium hover:bg-deep transition-colors disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create inbox"}
        </button>
      </div>
    </form>
  );
}
