"use client";

// NOTE: TeamSettings.tsx ships a near-identical inline `SkillsEditor` for
// agent skills. Round 6 should factor that out and reuse this component;
// for now we duplicate the chip UI deliberately (prompt 4 instruction).
import { useState } from "react";
import { Plus, X } from "lucide-react";

const SKILL_INPUT_MAX = 32;

function normalize(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function SkillChipsEditor({
  value,
  onChange,
  max = 8,
  disabled,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add() {
    const slug = normalize(draft);
    if (!slug) return;
    if (value.includes(slug)) {
      setDraft("");
      return;
    }
    if (value.length >= max) {
      setError(`at most ${max} skills`);
      return;
    }
    setDraft("");
    setError(null);
    onChange([...value, slug]);
  }

  function remove(slug: string) {
    onChange(value.filter((s) => s !== slug));
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((s) => (
        <span
          key={s}
          className="inline-flex items-center gap-1 rounded-full bg-mist/60 text-deep px-2 py-0.5 text-[11.5px] font-medium"
        >
          {s}
          <button
            type="button"
            onClick={() => remove(s)}
            disabled={disabled}
            aria-label={`Remove skill ${s}`}
            className="rounded-full p-0.5 hover:bg-mist/80 disabled:opacity-50"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <form
        className="inline-flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, SKILL_INPUT_MAX))}
          placeholder="add skill"
          maxLength={SKILL_INPUT_MAX}
          disabled={disabled || value.length >= max}
          className="rounded-full border border-mist bg-white px-2.5 py-0.5 text-[11.5px] text-ink placeholder:text-deep/40 focus:outline-none focus:ring-1 focus:ring-ink/20 disabled:opacity-50 w-[110px]"
        />
        <button
          type="submit"
          disabled={disabled || !draft.trim()}
          aria-label="Add skill"
          className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-ink text-white hover:bg-deep transition-colors disabled:opacity-50"
        >
          <Plus className="h-2.5 w-2.5" />
        </button>
      </form>
      {error && (
        <span className="text-[11px] text-red-700 ml-1" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
