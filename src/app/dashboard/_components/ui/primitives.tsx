"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown } from "lucide-react";

export type DropdownItem = {
  id: string;
  label: string;
  sub?: string;
  group?: string;
  icon?: React.ReactNode;
};

export function Dropdown({
  value,
  items,
  label,
  onChange,
  footer,
}: {
  value: string | null;
  items: DropdownItem[];
  label: string;
  onChange: (id: string) => void;
  footer?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = items.find((i) => i.id === value) ?? items[0];

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const grouped: Array<{ group: string | null; items: DropdownItem[] }> = [];
  for (const item of items) {
    const g = item.group ?? null;
    const last = grouped[grouped.length - 1];
    if (last && last.group === g) last.items.push(item);
    else grouped.push({ group: g, items: [item] });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 rounded-2xl border border-mist bg-white px-3.5 py-2.5 text-left text-[14px] text-ink hover:border-deep/40 transition-colors"
      >
        {current?.icon && (
          <span className="flex-shrink-0">{current.icon}</span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block font-medium truncate">{current?.label ?? "Pick one"}</span>
          {current?.sub && (
            <span className="block text-[12px] text-deep/60 truncate">{current.sub}</span>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-deep/60 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 mt-1.5 z-30 rounded-2xl border border-mist bg-white shadow-xl shadow-ink/5 overflow-hidden animate-[fade-up_140ms_ease-out]"
        >
          <ul className="max-h-[320px] overflow-y-auto py-1">
            {grouped.map(({ group, items: groupItems }, gi) => (
              <li key={gi}>
                {group && (
                  <div className="px-3.5 pt-2.5 pb-1 text-[11px] uppercase tracking-[0.12em] text-deep/50">
                    {group}
                  </div>
                )}
                <ul>
                  {groupItems.map((it) => (
                    <li key={it.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={it.id === value}
                        onClick={() => {
                          onChange(it.id);
                          setOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-3.5 py-2 text-[14px] text-ink hover:bg-mist/40 transition-colors"
                      >
                        {it.icon && <span className="flex-shrink-0">{it.icon}</span>}
                        <span className="flex-1 truncate text-left">{it.label}</span>
                        {it.sub && <span className="text-[12px] text-deep/50">{it.sub}</span>}
                        {it.id === value && <Check className="h-3.5 w-3.5 text-deep" />}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          {footer && <div className="border-t border-mist px-1.5 py-1.5">{footer}</div>}
        </div>
      )}
    </div>
  );
}

export function Field({
  label,
  name,
  type = "text",
  autoComplete,
  placeholder,
  defaultValue,
  required = true,
  maxLength,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  maxLength?: number;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="block">
      <span className="text-[13px] font-medium text-deep/70">{label}</span>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        defaultValue={defaultValue}
        maxLength={maxLength}
        className="mt-1.5 w-full rounded-xl border border-mist bg-white px-4 py-3 text-[15px] text-ink placeholder:text-deep/30 shadow-[0_1px_2px_rgba(11,11,11,0.03)] focus:outline-none focus:border-deep/40 focus:ring-2 focus:ring-deep/10 transition-all"
      />
    </label>
  );
}

export function Select<T extends string>({
  label,
  name,
  options,
  labels,
  defaultValue,
}: {
  label: string;
  name: string;
  options: readonly T[];
  labels: Record<T, string>;
  defaultValue?: T;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="block">
      <span className="text-[13px] font-medium text-deep/70">{label}</span>
      <select
        id={id}
        name={name}
        required
        defaultValue={defaultValue ?? ""}
        className="mt-1.5 w-full rounded-xl border border-mist bg-white px-4 py-3 text-[15px] text-ink shadow-[0_1px_2px_rgba(11,11,11,0.03)] focus:outline-none focus:border-deep/40 focus:ring-2 focus:ring-deep/10 transition-all"
      >
        <option value="" disabled>
          Pick one…
        </option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {labels[opt]}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SegmentedControl<T extends string>({
  label,
  name,
  options,
  labels,
  defaultValue,
}: {
  label: string;
  name: string;
  options: readonly T[];
  labels: Record<T, string>;
  defaultValue?: T;
}) {
  return (
    <fieldset className="block">
      <legend className="text-[13px] font-medium text-deep/70">{label}</legend>
      <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-5 gap-1.5">
        {options.map((opt) => (
          <label
            key={opt}
            className="cursor-pointer rounded-xl border border-mist bg-white px-3 py-2.5 text-center text-[14px] text-ink hover:border-deep/40 has-[:checked]:bg-ink has-[:checked]:text-white has-[:checked]:border-ink transition-colors"
          >
            <input
              type="radio"
              name={name}
              value={opt}
              defaultChecked={opt === defaultValue}
              required
              className="sr-only"
            />
            {labels[opt]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function TileGrid<T extends string>({
  name,
  options,
  labels,
  defaultValue,
}: {
  name: string;
  options: readonly T[];
  labels: Record<T, string>;
  defaultValue?: T | null;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
      {options.map((opt) => (
        <label
          key={opt}
          className="cursor-pointer rounded-2xl border border-mist bg-white px-4 py-3.5 text-[15px] text-ink hover:border-deep/40 hover:bg-mist/30 has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white has-[:checked]:shadow-lg has-[:checked]:shadow-ink/10 transition-all"
        >
          <input
            type="radio"
            name={name}
            value={opt}
            defaultChecked={opt === defaultValue}
            required
            className="sr-only"
          />
          {labels[opt]}
        </label>
      ))}
    </div>
  );
}

export function BackContinue({
  pending,
  onBack,
  continueLabel = "Continue",
  final = false,
}: {
  pending: boolean;
  onBack?: () => void;
  continueLabel?: string;
  final?: boolean;
}) {
  return (
    <div className="mt-8 flex items-center justify-between gap-4">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          disabled={pending}
          className="inline-flex items-center gap-1.5 text-[14px] font-medium text-deep/70 hover:text-ink transition-colors disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      ) : (
        <span />
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-full bg-ink text-white pl-5 pr-2 py-2 text-[15px] font-medium shadow-lg shadow-ink/10 hover:bg-deep transition-colors disabled:opacity-60"
      >
        {pending ? "Saving…" : continueLabel}
        <span className="grid place-items-center h-7 w-7 rounded-full bg-white text-ink">
          {final ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <ArrowRight className="h-3.5 w-3.5" />
          )}
        </span>
      </button>
    </div>
  );
}
