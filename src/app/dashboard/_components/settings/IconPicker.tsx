"use client";

import { START_OPTION_ICONS, START_OPTION_ICON_NAMES } from "./start-option-icons";

export function IconPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (icon: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-8 gap-1.5">
      {START_OPTION_ICON_NAMES.map((name) => {
        const Icon = START_OPTION_ICONS[name];
        const active = name === value;
        return (
          <button
            key={name}
            type="button"
            disabled={disabled}
            onClick={() => onChange(name)}
            aria-label={name}
            aria-pressed={active}
            className={
              active
                ? "inline-flex items-center justify-center h-8 w-8 rounded-lg bg-ink text-white"
                : "inline-flex items-center justify-center h-8 w-8 rounded-lg bg-white border border-mist text-deep hover:bg-mist/40 disabled:opacity-50"
            }
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
