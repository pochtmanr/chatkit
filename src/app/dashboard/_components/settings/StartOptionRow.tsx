"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Pencil, Power, Trash2 } from "lucide-react";
import {
  deleteStartOption,
  toggleStartOptionActive,
  updateStartOption,
} from "@/app/dashboard/_actions/start-options";
import { StartOptionIcon } from "./StartOptionIcon";
import { IconPicker } from "./IconPicker";
import { SkillChipsEditor } from "./SkillChipsEditor";

export type StartOptionRowData = {
  id: string;
  label: string;
  description: string | null;
  icon: string;
  kind: "support" | "order" | "direct";
  required_skills: string[];
  sort_order: number;
  is_active: boolean;
};

export function StartOptionRow({
  option,
  isFirst,
  isLast,
  onMove,
}: {
  option: StartOptionRowData;
  isFirst: boolean;
  isLast: boolean;
  onMove: (id: string, direction: -1 | 1) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(option.label);
  const [description, setDescription] = useState(option.description ?? "");
  const [icon, setIcon] = useState(option.icon);
  const [kind, setKind] = useState<typeof option.kind>(option.kind);
  const [skills, setSkills] = useState(option.required_skills);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await updateStartOption({
        id: option.id,
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
      setEditing(false);
    });
  }

  function cancel() {
    setLabel(option.label);
    setDescription(option.description ?? "");
    setIcon(option.icon);
    setKind(option.kind);
    setSkills(option.required_skills);
    setError(null);
    setEditing(false);
  }

  function toggleActive() {
    startTransition(async () => {
      const res = await toggleStartOptionActive({
        id: option.id,
        is_active: !option.is_active,
      });
      if (!res.ok) setError(res.error);
    });
  }

  function remove() {
    if (!confirm(`Delete "${option.label}"? Existing conversations keep working.`)) return;
    startTransition(async () => {
      const res = await deleteStartOption({ id: option.id });
      if (!res.ok) setError(res.error);
    });
  }

  if (editing) {
    return (
      <div className="px-5 py-4 space-y-4 bg-mist/20">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-[13px] font-medium text-deep/70">Label</span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={60}
              className="mt-1.5 w-full rounded-xl border border-mist bg-white px-4 py-2.5 text-[14px] text-ink focus:outline-none focus:border-deep/40 focus:ring-2 focus:ring-deep/10"
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
            className="mt-1.5 w-full rounded-xl border border-mist bg-white px-4 py-2.5 text-[14px] text-ink focus:outline-none focus:border-deep/40 focus:ring-2 focus:ring-deep/10"
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
            Conversations route to agents with all of these skills. Leave empty
            to route to any agent.
          </p>
        </div>
        {error && <p className="text-[13px] text-red-700">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={cancel}
            disabled={pending}
            className="rounded-full bg-white border border-mist px-4 py-2 text-[13px] font-medium text-ink hover:bg-mist/40 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending || !label.trim()}
            className="rounded-full bg-ink text-white px-5 py-2 text-[13px] font-medium hover:bg-deep disabled:opacity-60"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        option.is_active
          ? "px-5 py-3.5 flex items-start gap-4"
          : "px-5 py-3.5 flex items-start gap-4 opacity-50"
      }
    >
      <div className="flex flex-col gap-0.5 pt-0.5">
        <button
          type="button"
          onClick={() => onMove(option.id, -1)}
          disabled={isFirst || pending}
          aria-label="Move up"
          className="text-deep/50 hover:text-ink disabled:opacity-30"
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onMove(option.id, 1)}
          disabled={isLast || pending}
          aria-label="Move down"
          className="text-deep/50 hover:text-ink disabled:opacity-30"
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="h-8 w-8 rounded-lg bg-mist/60 flex items-center justify-center text-deep shrink-0">
        <StartOptionIcon name={option.icon} className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[14px] font-medium text-ink">{option.label}</span>
          <span className="inline-flex items-center rounded-full bg-mist/60 text-deep/70 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide">
            {option.kind}
          </span>
          {option.required_skills.map((s) => (
            <span
              key={s}
              className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[11px] font-medium"
            >
              {s}
            </span>
          ))}
          {!option.is_active && (
            <span className="inline-flex items-center rounded-full bg-mist text-deep/60 border border-mist px-2 py-0.5 text-[11px]">
              Disabled
            </span>
          )}
        </div>
        {option.description && (
          <p className="text-[13px] text-deep/70 mt-1 truncate">
            {option.description}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setEditing(true)}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-full border border-mist bg-white px-3 py-1.5 text-[12px] font-medium text-ink hover:bg-mist/40 disabled:opacity-60"
        >
          <Pencil className="h-3 w-3" />
          Edit
        </button>
        <button
          type="button"
          onClick={toggleActive}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-full border border-mist bg-white px-3 py-1.5 text-[12px] font-medium text-ink hover:bg-mist/40 disabled:opacity-60"
        >
          <Power className="h-3 w-3" />
          {option.is_active ? "Disable" : "Enable"}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[12px] font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
        >
          <Trash2 className="h-3 w-3" />
          Delete
        </button>
      </div>
      {error && (
        <p className="text-[12px] text-red-700 w-full" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
