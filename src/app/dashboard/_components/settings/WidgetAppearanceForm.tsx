"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  MessageCircle,
  RotateCcw,
  Upload,
  X,
} from "lucide-react";
import {
  LAUNCHER_ICONS,
  LAUNCHER_ICON_NAMES,
} from "./launcher-icons";
import { WidgetAppearancePreview } from "./WidgetAppearancePreview";
import {
  clearLauncherIcon,
  resetWidgetConfig,
  saveWidgetConfig,
  uploadLauncherIcon,
  type BubbleStyle,
  type ButtonStyle,
  type Roundness,
  type WidgetConfigInput,
} from "@/app/dashboard/_actions/widget-config";

type FormState = WidgetConfigInput;

const ROUNDNESS_LABEL: Record<Roundness, string> = {
  sharp: "Sharp",
  rounded: "Rounded",
  pill: "Pill",
};
const BUTTON_LABEL: Record<ButtonStyle, string> = {
  solid: "Solid",
  outline: "Outline",
  ghost: "Ghost",
};
const BUBBLE_LABEL: Record<BubbleStyle, string> = {
  rounded: "Rounded",
  square: "Square",
  tail: "Tail",
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const GREETING_MAX = 280;

export function WidgetAppearanceForm({
  businessName,
  initial,
}: {
  businessName: string;
  initial: FormState;
}) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(initial);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [iconTab, setIconTab] = useState<"preset" | "upload">(
    state.launcher_icon_url ? "upload" : "preset",
  );

  const greetingLen = (state.greeting_message ?? "").length;
  const hexValid = HEX_RE.test(state.primary_color);

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function onSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await saveWidgetConfig(state);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 1800);
    });
  }

  function onReset() {
    if (
      !confirm(
        "Reset widget appearance to defaults? This clears your saved configuration.",
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await resetWidgetConfig();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setState({
        primary_color: "#0F172A",
        roundness: "rounded",
        button_style: "solid",
        bubble_style: "rounded",
        launcher_icon_preset: "message-circle",
        launcher_icon_url: null,
        greeting_message: null,
      });
      setIconTab("preset");
      router.refresh();
    });
  }

  async function onUpload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadLauncherIcon(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      patch("launcher_icon_url", res.iconUrl);
    } finally {
      setUploading(false);
    }
  }

  async function onClearUpload() {
    patch("launcher_icon_url", null);
    setIconTab("preset");
    // If a row already had an uploaded URL, also clear it server-side so
    // the live widget reverts immediately on save-skip.
    if (initial.launcher_icon_url) {
      startTransition(async () => {
        const res = await clearLauncherIcon();
        if (!res.ok) setError(res.error);
      });
    }
  }

  const cardClass =
    "rounded-2xl bg-white border border-mist/80 p-6 space-y-4";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
      <div className="space-y-6">
        <section className={cardClass}>
          <SectionHeader
            title="Primary color"
            sub="Drives the launcher, send button, and selected highlights."
          />
          <ColorField
            value={state.primary_color}
            onChange={(v) => patch("primary_color", v)}
            invalid={!hexValid}
          />
        </section>

        <section className={cardClass}>
          <SectionHeader
            title="Corner roundness"
            sub="Applied to buttons, the launcher, and panel chrome."
          />
          <Segmented<Roundness>
            value={state.roundness}
            options={["sharp", "rounded", "pill"]}
            labels={ROUNDNESS_LABEL}
            onChange={(v) => patch("roundness", v)}
          />
        </section>

        <section className={cardClass}>
          <SectionHeader
            title="Button style"
            sub="Affects the primary “New conversation” button and the send action."
          />
          <Segmented<ButtonStyle>
            value={state.button_style}
            options={["solid", "outline", "ghost"]}
            labels={BUTTON_LABEL}
            onChange={(v) => patch("button_style", v)}
          />
        </section>

        <section className={cardClass}>
          <SectionHeader
            title="Message bubble"
            sub="How the customer's outgoing message bubbles look."
          />
          <Segmented<BubbleStyle>
            value={state.bubble_style}
            options={["rounded", "square", "tail"]}
            labels={BUBBLE_LABEL}
            onChange={(v) => patch("bubble_style", v)}
          />
        </section>

        <section className={cardClass}>
          <SectionHeader
            title="Launcher icon"
            sub="Pick from a curated set, or upload your own (PNG / WebP / SVG, ≤ 1 MB)."
          />
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <TabButton
              active={iconTab === "preset"}
              onClick={() => setIconTab("preset")}
            >
              Preset
            </TabButton>
            <TabButton
              active={iconTab === "upload"}
              onClick={() => setIconTab("upload")}
            >
              Upload
            </TabButton>
          </div>
          {iconTab === "preset" ? (
            <IconGrid
              value={state.launcher_icon_preset}
              onPick={(name) => {
                patch("launcher_icon_preset", name);
                // Selecting a preset clears any uploaded URL — the
                // widget renders the upload when both are present,
                // and surprising users with the wrong icon is worse
                // than orphaning a storage object.
                if (state.launcher_icon_url) patch("launcher_icon_url", null);
              }}
            />
          ) : (
            <UploadPanel
              uploading={uploading}
              iconUrl={state.launcher_icon_url}
              onPick={onUpload}
              onClear={onClearUpload}
              primaryColor={state.primary_color}
            />
          )}
        </section>

        <section className={cardClass}>
          <SectionHeader
            title="Greeting message"
            sub="Shown above the topic picker. Supports **bold** and [links](https://…)."
          />
          <textarea
            value={state.greeting_message ?? ""}
            onChange={(e) => patch("greeting_message", e.target.value || null)}
            placeholder="Hi! How can we help today?"
            maxLength={GREETING_MAX + 64}
            rows={3}
            className="block w-full rounded-xl border border-mist bg-white px-4 py-3 text-[14px] text-ink placeholder:text-deep/30 shadow-[0_1px_2px_rgba(11,11,11,0.03)] focus:outline-none focus:border-deep/40 focus:ring-2 focus:ring-deep/10"
          />
          <div className="flex items-center justify-between text-[12px] text-deep/60">
            <span>
              Markdown: <code>**bold**</code>, <code>[label](https://…)</code>.
            </span>
            <span
              className={
                greetingLen > GREETING_MAX
                  ? "text-red-600"
                  : "text-deep/60"
              }
            >
              {greetingLen}/{GREETING_MAX}
            </span>
          </div>
        </section>

        {error && (
          <p className="text-[13px] font-medium text-red-700">{error}</p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={pending || uploading || !hexValid || greetingLen > GREETING_MAX}
            onClick={onSave}
            className="inline-flex items-center gap-2 rounded-full bg-ink text-white px-5 py-2.5 text-[14px] font-medium shadow-lg shadow-ink/10 hover:bg-deep transition-colors disabled:opacity-60"
          >
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {pending ? "Saving…" : saved ? "Saved" : "Save changes"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-full bg-white border border-mist text-ink px-4 py-2 text-[13px] font-medium hover:bg-mist/40 transition-colors disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to defaults
          </button>
        </div>
      </div>

      <WidgetAppearancePreview state={state} businessName={businessName} />
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="space-y-1">
      <h2 className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
        {title}
      </h2>
      <p className="text-[13px] text-deep/60">{sub}</p>
    </div>
  );
}

function ColorField({
  value,
  onChange,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  invalid: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="relative inline-flex items-center">
        <input
          type="color"
          value={HEX_RE.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 w-12 h-12 opacity-0 cursor-pointer"
        />
        <span
          className="h-12 w-12 rounded-xl border border-mist shadow-[0_1px_2px_rgba(11,11,11,0.03)]"
          style={{ background: value }}
          aria-hidden
        />
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className={`w-40 rounded-xl border bg-white px-4 py-2.5 text-[14px] font-mono uppercase shadow-[0_1px_2px_rgba(11,11,11,0.03)] focus:outline-none focus:ring-2 focus:ring-deep/10 ${
          invalid ? "border-red-400 text-red-700" : "border-mist text-ink"
        }`}
        placeholder="#0F172A"
      />
      {invalid && (
        <span className="text-[12px] text-red-700">6-digit hex required.</span>
      )}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  labels,
  onChange,
}: {
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`rounded-xl border px-3 py-2.5 text-[13px] font-medium transition-colors ${
              active
                ? "bg-ink border-ink text-white"
                : "bg-white border-mist text-ink hover:border-deep/40"
            }`}
          >
            {labels[opt]}
          </button>
        );
      })}
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[13px] transition-colors ${
        active
          ? "bg-ink text-white"
          : "bg-white border border-mist text-ink hover:bg-mist/40"
      }`}
    >
      {children}
    </button>
  );
}

function IconGrid({
  value,
  onPick,
}: {
  value: string | null;
  onPick: (name: string) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
      {LAUNCHER_ICON_NAMES.map((name) => {
        const Icon = LAUNCHER_ICONS[name];
        const selected = value === name;
        return (
          <button
            key={name}
            type="button"
            onClick={() => onPick(name)}
            aria-pressed={selected}
            title={name}
            className={`flex items-center justify-center h-12 rounded-xl border transition-colors ${
              selected
                ? "bg-ink border-ink text-white"
                : "bg-white border-mist text-ink hover:border-deep/40"
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}

function UploadPanel({
  iconUrl,
  uploading,
  onPick,
  onClear,
  primaryColor,
}: {
  iconUrl: string | null;
  uploading: boolean;
  onPick: (file: File) => void;
  onClear: () => void;
  primaryColor: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <div
        className="h-16 w-16 rounded-2xl grid place-items-center overflow-hidden"
        style={{ background: primaryColor }}
      >
        {iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={iconUrl} alt="Custom launcher icon" className="h-8 w-8" />
        ) : (
          <MessageCircle className="h-6 w-6 text-white/90" />
        )}
        {uploading && (
          <div className="absolute inset-0 grid place-items-center bg-ink/30">
            <Loader2 className="h-4 w-4 text-white animate-spin" />
          </div>
        )}
      </div>
      <div className="flex flex-col items-start gap-2">
        <label className="inline-flex items-center gap-2 rounded-full bg-white border border-mist px-4 py-2 text-[13px] font-medium text-ink hover:bg-mist/40 transition-colors cursor-pointer">
          <Upload className="h-3.5 w-3.5" />
          {iconUrl ? "Replace icon" : "Upload icon"}
          <input
            type="file"
            accept="image/png,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPick(f);
              e.target.value = "";
            }}
          />
        </label>
        {iconUrl && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 text-[12px] text-deep/70 hover:text-ink"
          >
            <X className="h-3 w-3" />
            Remove custom icon
          </button>
        )}
      </div>
    </div>
  );
}

