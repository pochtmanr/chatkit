"use client";

import { useEffect, useRef } from "react";
import {
  Bell,
  BookOpen,
  Briefcase,
  Bug,
  Calendar,
  CreditCard,
  Headphones,
  HelpCircle,
  LifeBuoy,
  Mail,
  MessageCircle,
  Package,
  Receipt,
  Shield,
  Truck,
  User,
  type LucideIcon,
} from "lucide-react";
import { hexToRgbA } from "./_lib/color";
import { renderGreetingMarkdown } from "./_lib/markdown";
import type { ButtonStyle } from "./_lib/theme";

export type StartOptionDTO = {
  id: string;
  label: string;
  description: string | null;
  icon: string;
  kind: "support" | "order" | "direct";
  required_skills: string[];
  sort_order: number;
};

// Mirrors src/app/dashboard/_components/settings/start-option-icons.ts.
// The widget bundles separately, so we duplicate the table here rather
// than crossing the dashboard/embed boundary — slugs are stable strings.
const ICONS: Record<string, LucideIcon> = {
  "message-circle": MessageCircle,
  "life-buoy": LifeBuoy,
  "help-circle": HelpCircle,
  package: Package,
  receipt: Receipt,
  "credit-card": CreditCard,
  truck: Truck,
  calendar: Calendar,
  user: User,
  shield: Shield,
  bug: Bug,
  "book-open": BookOpen,
  briefcase: Briefcase,
  headphones: Headphones,
  mail: Mail,
  bell: Bell,
};

function iconFor(name: string): LucideIcon {
  return ICONS[name] ?? MessageCircle;
}

/**
 * Topic grid. Vertical stack when ≤ 3 options; 2-column grid at 4+.
 * Used both as the empty-state body (no overlay) and inside
 * NewConversationButton's overlay.
 *
 * Keyboard:
 *   - Arrow Up/Down move focus through buttons.
 *   - Enter / Space activates the focused button.
 *   - When `autoFocus` is set, the first button receives focus on mount.
 */
export function TopicPicker({
  options,
  primaryColor,
  greeting,
  greetingId,
  onPick,
  autoFocus,
  disabled,
}: {
  options: StartOptionDTO[];
  primaryColor: string;
  greeting?: string | null;
  greetingId?: string;
  // buttonStyle is currently unused — tile styling stays neutral so
  // long topic lists don't drown in saturated buttons. Reserved for
  // future variants; pass it through so callers don't need to know.
  buttonStyle?: ButtonStyle;
  onPick: (id: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const isGrid = options.length >= 4;

  useEffect(() => {
    if (!autoFocus) return;
    const first = listRef.current?.querySelector<HTMLButtonElement>(
      "button[data-topic-button]",
    );
    first?.focus();
  }, [autoFocus]);

  function handleKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const root = listRef.current;
    if (!root) return;
    const buttons = Array.from(
      root.querySelectorAll<HTMLButtonElement>("button[data-topic-button]"),
    );
    const active = document.activeElement as HTMLElement | null;
    const idx = active ? buttons.indexOf(active as HTMLButtonElement) : -1;
    const next =
      e.key === "ArrowDown"
        ? (idx + 1 + buttons.length) % buttons.length
        : (idx - 1 + buttons.length) % buttons.length;
    e.preventDefault();
    buttons[next]?.focus();
  }

  const tintHover = hexToRgbA(primaryColor, 0.08);
  const greetingHtml = greeting ? renderGreetingMarkdown(greeting) : "";

  return (
    <div className="flex flex-col gap-4 p-5" ref={listRef} onKeyDown={handleKey}>
      {greetingHtml && (
        <h2
          id={greetingId}
          className="text-[15px] font-medium text-zinc-900 leading-snug"
          dangerouslySetInnerHTML={{ __html: greetingHtml }}
        />
      )}
      <div
        className={
          isGrid
            ? "grid grid-cols-2 gap-2"
            : "flex flex-col gap-2"
        }
      >
        {options.map((opt) => {
          const Icon = iconFor(opt.icon);
          return (
            <button
              key={opt.id}
              type="button"
              data-topic-button
              disabled={disabled}
              onClick={() => onPick(opt.id)}
              style={
                {
                  // Hover/focus tint is set via CSS var so the rendered
                  // hex stays out of inline style on every paint.
                  "--topic-tint": tintHover,
                } as React.CSSProperties
              }
              className="flex items-start gap-3 w-full text-left rounded-[var(--hl-radius,12px)] border border-zinc-200 bg-white px-3.5 py-3 hover:bg-[var(--topic-tint)] focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:bg-[var(--topic-tint)] disabled:opacity-50 transition-colors"
            >
              <span className="inline-flex items-center justify-center h-9 w-9 rounded-[var(--hl-radius,10px)] bg-zinc-100 text-zinc-700 shrink-0">
                <Icon style={{ width: 20, height: 20 }} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] font-semibold text-zinc-900 truncate">
                  {opt.label}
                </span>
                {opt.description && (
                  <span className="block text-[12px] text-zinc-500 mt-0.5 line-clamp-2">
                    {opt.description}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
