"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListPlus } from "lucide-react";
import {
  createStartOption,
  reorderStartOptions,
} from "@/app/dashboard/_actions/start-options";
import { IconPicker } from "./IconPicker";
import { SkillChipsEditor } from "./SkillChipsEditor";
import { StartOptionRow, type StartOptionRowData } from "./StartOptionRow";

export function StartOptionsSection({
  inboxId,
  inboxName,
  multipleInboxes,
  options,
}: {
  inboxId: string;
  inboxName: string;
  multipleInboxes: boolean;
  options: StartOptionRowData[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Local mirror of `options` so reorder reflects immediately; server
  // revalidates the list on save.
  const [local, setLocal] = useState(options);

  // New-option form state.
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("message-circle");
  const [kind, setKind] = useState<"support" | "order" | "direct">("support");
  const [skills, setSkills] = useState<string[]>([]);

  const sorted = useMemo(
    () => [...local].sort((a, b) => a.sort_order - b.sort_order),
    [local],
  );

  function resetForm() {
    setLabel("");
    setDescription("");
    setIcon("message-circle");
    setKind("support");
    setSkills([]);
  }

  function onCreate() {
    setError(null);
    startTransition(async () => {
      const res = await createStartOption({
        inboxId,
        label,
        description: description.trim() || null,
        icon,
        kind,
        required_skills: skills,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      resetForm();
      setShowCreate(false);
      router.refresh();
    });
  }

  function onMove(id: string, direction: -1 | 1) {
    const idx = sorted.findIndex((o) => o.id === id);
    if (idx === -1) return;
    const swap = idx + direction;
    if (swap < 0 || swap >= sorted.length) return;

    const next = [...sorted];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setLocal(next.map((o, i) => ({ ...o, sort_order: i })));

    startTransition(async () => {
      const res = await reorderStartOptions({ ids: next.map((o) => o.id) });
      if (!res.ok) {
        setError(res.error);
        setLocal(options);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-[14px] font-medium text-deep/60">Widget</p>
        <h1 className="text-3xl sm:text-4xl tracking-tight text-ink leading-[1] font-normal">
          Start{" "}
          <span className="font-serif-italic font-normal text-deep">
            options<span className="text-deep/40">.</span>
          </span>
        </h1>
        <p className="text-deep/70 leading-relaxed text-[15px] font-normal max-w-[640px]">
          These appear in your widget&apos;s{" "}
          <span className="font-medium text-ink">+ New conversation</span>{" "}
          picker. Each option creates a new conversation routed by skill —
          for example, &quot;Billing&quot; goes to an agent with the{" "}
          <code className="rounded bg-mist/60 px-1 text-[13px]">billing</code>{" "}
          skill.
        </p>
        {multipleInboxes && (
          <p className="text-[12px] text-deep/50 max-w-[640px]">
            Showing options for{" "}
            <span className="font-medium text-deep/80">{inboxName}</span>. This
            is your default inbox; multi-inbox configuration arrives in round 6.
          </p>
        )}
      </header>

      <section className="rounded-2xl bg-white border border-mist/80 overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-mist">
          <div>
            <h2 className="text-[16px] font-medium text-ink">Topics</h2>
            <p className="text-[13px] text-deep/60 mt-0.5">
              Reorder with the arrows. The order here is the order in the widget.
            </p>
          </div>
          {!showCreate && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-full bg-ink text-white px-4 py-2 text-[13px] font-medium hover:bg-deep transition-colors"
            >
              <ListPlus className="h-3.5 w-3.5" />
              Add option
            </button>
          )}
        </div>

        {showCreate && (
          <div className="px-5 py-4 bg-mist/20 border-b border-mist space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-[13px] font-medium text-deep/70">Label</span>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  maxLength={60}
                  placeholder='e.g. "Refund request"'
                  className="mt-1.5 w-full rounded-xl border border-mist bg-white px-4 py-2.5 text-[14px] text-ink placeholder:text-deep/30 focus:outline-none focus:border-deep/40 focus:ring-2 focus:ring-deep/10"
                />
              </label>
              <label className="block">
                <span className="text-[13px] font-medium text-deep/70">Kind</span>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as typeof kind)}
                  className="mt-1.5 w-full rounded-xl border border-mist bg-white px-4 py-2.5 text-[14px] text-ink focus:outline-none focus:border-deep/40 focus:ring-2 focus:ring-deep/10"
                >
                  <option value="support">Support</option>
                  <option value="order">Order</option>
                  <option value="direct">Direct</option>
                </select>
              </label>
            </div>
            <label className="block">
              <span className="text-[13px] font-medium text-deep/70">Description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={240}
                rows={2}
                placeholder="One-liner shown under the label."
                className="mt-1.5 w-full rounded-xl border border-mist bg-white px-4 py-2.5 text-[14px] text-ink placeholder:text-deep/30 focus:outline-none focus:border-deep/40 focus:ring-2 focus:ring-deep/10"
              />
            </label>
            <div>
              <span className="text-[13px] font-medium text-deep/70 block mb-1.5">
                Icon
              </span>
              <IconPicker value={icon} onChange={setIcon} disabled={pending} />
            </div>
            <div>
              <span className="text-[13px] font-medium text-deep/70 block mb-1.5">
                Required skills
              </span>
              <SkillChipsEditor value={skills} onChange={setSkills} disabled={pending} />
              <p className="text-[12px] text-deep/50 mt-1">
                Conversations route to agents with all of these skills. Leave
                empty to route to any agent.
              </p>
            </div>
            {error && <p className="text-[13px] text-red-700">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  resetForm();
                  setError(null);
                }}
                disabled={pending}
                className="rounded-full bg-white border border-mist px-4 py-2 text-[13px] font-medium text-ink hover:bg-mist/40 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onCreate}
                disabled={pending || !label.trim()}
                className="rounded-full bg-ink text-white px-5 py-2 text-[13px] font-medium hover:bg-deep disabled:opacity-60"
              >
                Add option
              </button>
            </div>
          </div>
        )}

        <ul className="divide-y divide-mist">
          {sorted.map((opt, i) => (
            <li key={opt.id}>
              <StartOptionRow
                option={opt}
                isFirst={i === 0}
                isLast={i === sorted.length - 1}
                onMove={onMove}
              />
            </li>
          ))}
          {sorted.length === 0 && (
            <li className="px-5 py-6 text-[13px] text-deep/60">
              No options yet — add one to get started.
            </li>
          )}
        </ul>
      </section>

      {error && !showCreate && (
        <p className="text-[13px] text-red-700">{error}</p>
      )}
    </div>
  );
}
