"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { TopicPicker, type StartOptionDTO } from "./TopicPicker";
import { buttonStyles, type ButtonStyle } from "./_lib/theme";

/**
 * "+ New conversation" button at the top of the conversation list, and
 * the modal-in-iframe overlay it toggles. Backdrop click closes. Escape
 * closes. Focus trap cycles through the topic buttons; arrow-key nav
 * lives inside TopicPicker.
 *
 * The widget is the world — we don't need a portal, just absolute
 * positioning inside the panel body.
 */
export function NewConversationButton({
  options,
  primaryColor,
  greeting,
  buttonStyle = "solid",
  onPick,
  disabled,
}: {
  options: StartOptionDTO[];
  primaryColor: string;
  greeting?: string | null;
  buttonStyle?: ButtonStyle;
  onPick: (optionId: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      } else if (e.key === "Tab") {
        const root = overlayRef.current;
        if (!root) return;
        const focusable = root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function handlePick(id: string) {
    setOpen(false);
    onPick(id);
  }

  const triggerStyle = buttonStyles(buttonStyle, primaryColor, "var(--hl-radius)");

  return (
    <>
      <div className="px-3 py-2 border-b border-zinc-200 bg-white">
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled || options.length === 0}
          onClick={() => setOpen(true)}
          style={triggerStyle}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-[13px] font-medium hover:brightness-110 active:brightness-95 disabled:opacity-50 transition"
        >
          <Plus className="h-3.5 w-3.5" />
          New conversation
        </button>
      </div>

      {open && (
        <div className="absolute inset-0 z-10">
          <button
            type="button"
            aria-label="Close picker"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-zinc-950/30"
          />
          <div
            ref={overlayRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={greeting ? titleId : undefined}
            className="absolute inset-x-3 bottom-3 top-3 rounded-2xl bg-white shadow-xl border border-zinc-200 overflow-hidden flex flex-col"
          >
            <TopicPicker
              options={options}
              primaryColor={primaryColor}
              greeting={greeting}
              greetingId={titleId}
              buttonStyle={buttonStyle}
              onPick={handlePick}
              autoFocus
              disabled={disabled}
            />
          </div>
        </div>
      )}
    </>
  );
}
