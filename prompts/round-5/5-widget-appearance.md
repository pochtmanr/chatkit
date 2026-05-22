# 5 — Widget appearance: branding, theming, greeting

Read `AGENTS.md` and `0-shared.md` before starting. Depends on
prompt 2 — `/embed/customer` exists and accepts `pk` + JWT.

## Goal

Give tenants real visual control over the customer widget:

- **Primary color** (hex; default `#0F172A`).
- **Corner roundness** (`sharp` / `rounded` / `pill`).
- **Button style** (`solid` / `outline` / `ghost`).
- **Message bubble style** (`rounded` / `square` / `tail`).
- **Launcher icon** (upload to a public bucket, or pick from a
  preset library of ~16 lucide icons).
- **Greeting message** (≤ 280 chars; shown above topic picker).

These all live on `widget_config` (one row per business, spec in
`0-shared.md §3.4`). Settings page at
`/dashboard/settings/widget-appearance`. Widget reads the config
in its server component and injects CSS variables.

After this prompt: the launcher on greenflagged.com matches the
configured color and icon; topic picker uses the configured
roundness/button style; the greeting message appears above the
topic buttons.

---

## Step 0 — Pre-flight

```bash
cat AGENTS.md
grep -n 'widget_config' src/lib/supabase/database.types.ts   # typed after prompt 1
ls src/app/embed/customer/                                    # renamed in prompt 2
ls src/app/dashboard/_components/ui/BusinessLogoUploader.tsx  # template for icon upload
ls supabase/migrations/                                        # 0025 applied
```

Read `node_modules/next/dist/docs/` on Storage / public buckets
and `revalidatePath` before writing.

---

## Step 1 — Storage bucket for launcher icons

If the round-3 `logos` bucket pattern exists
(`BusinessLogoUploader.tsx`), reuse it. Add a new public bucket
`widget-icons` with the same policy: public read, write
RLS-scoped to `auth.uid() = (storage path's first segment)`.
Path layout: `<business_id>/<filename>`.

If creating the bucket via Supabase MCP isn't straightforward,
fold the bucket creation into migration `0025_round5_keys_and_widget.sql`
(prompt 1 owns that file; coordinate). Bucket spec:

```sql
insert into storage.buckets (id, name, public)
values ('widget-icons', 'widget-icons', true)
on conflict (id) do nothing;

-- Reuse the policy idiom from the existing logos bucket:
-- - Anyone can SELECT (public read).
-- - Owners can INSERT/UPDATE/DELETE files where the path's
--   first segment is their business_id and they own that
--   business.
```

Don't reinvent — copy the policy SQL from the `logos` bucket
migration verbatim, substituting `widget-icons`.

---

## Step 2 — Settings page route

Create `src/app/dashboard/settings/widget-appearance/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requireRole } from "@/lib/team";
import { getServiceClient } from "@/lib/supabase/server";
import { WidgetAppearanceForm } from "@/app/dashboard/_components/settings/WidgetAppearanceForm";

const DEFAULTS = {
  primary_color: "#0F172A",
  roundness: "rounded" as const,
  button_style: "solid" as const,
  bubble_style: "rounded" as const,
  launcher_icon_url: null,
  launcher_icon_preset: "message-circle",
  greeting_message: null,
};

export default async function Page() {
  const c = await cookies();
  const businessId = c.get("chatkit_active_biz")?.value;
  if (!businessId) redirect("/dashboard");
  const guard = await requireRole(businessId, "owner");
  if (!guard.ok) redirect("/dashboard");

  const svc = getServiceClient();
  const { data: row } = await svc
    .from("widget_config")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  // Row may not exist yet — surface defaults; first save creates it.
  const config = row ?? { business_id: businessId, ...DEFAULTS };

  return <WidgetAppearanceForm businessId={businessId} initial={config} />;
}
```

Nav entry (`NavMenu.tsx`):

```ts
{ href: "/dashboard/settings/widget-appearance", label: "Widget appearance", icon: Palette, roles: ["owner"] },
```

---

## Step 3 — Server actions

Create `src/app/dashboard/_actions/widget-config.ts`. Mirror the
`mcp-keys.ts` pattern.

```ts
"use server";

type WidgetConfigInput = {
  primary_color: string;
  roundness: "sharp" | "rounded" | "pill";
  button_style: "solid" | "outline" | "ghost";
  bubble_style: "rounded" | "square" | "tail";
  launcher_icon_preset: string | null;
  launcher_icon_url: string | null;
  greeting_message: string | null;
};

export async function saveWidgetConfig(input: WidgetConfigInput): Promise<ActionResult>;
export async function clearLauncherIcon(): Promise<ActionResult>;
export async function resetWidgetConfig(): Promise<ActionResult>;
```

Behavior:

- `requireRole(businessId, 'owner')`.
- `primary_color`: must match `/^#[0-9a-fA-F]{6}$/`. Normalize to
  lowercase. Reject 3-digit and 8-digit forms — keep it simple.
- `roundness`, `button_style`, `bubble_style`: enum-checked.
- `launcher_icon_preset`: when non-null, must be in the
  allowlist (`src/app/dashboard/_components/settings/launcher-icons.ts`
  — same 16 lucide names as the start-options icon picker plus
  variants: `message-circle`, `message-square`, `headphones`,
  `life-buoy`, `help-circle`, `mail`, `bell`, `phone`, `sparkles`,
  …). Reject unknown.
- `launcher_icon_url`: when non-null, must be a URL under the
  `widget-icons` bucket for the active business. Reject any
  other host or any path whose first segment ≠ business_id.
- `greeting_message`: trim, ≤ 280 chars. Allow markdown bold
  (`**…**`) and links (`[label](https://…)` with https-only)
  — render those server-side in the widget. Reject other markdown.
- Upsert: insert if no row, update otherwise. `updated_at` set
  to `now()`.
- `revalidatePath('/dashboard/settings/widget-appearance')`.
- Also `revalidatePath('/embed/customer')` so a fresh iframe
  load picks up the new config without a manual cache bust.

`clearLauncherIcon` sets the URL field to null (does not delete
the storage object — keep it for one-click revert; storage GC is
a round 6 chore). `resetWidgetConfig` deletes the row entirely so
the next load shows defaults.

---

## Step 4 — `WidgetAppearanceForm.tsx`

Client component. Mirror the `BusinessProfileForm.tsx` structure
— this is the form pattern the repo uses for tenant config.

Layout (single column, top to bottom):

1. **Primary color** — hex input + live color swatch. Below the
   input, a small "Live preview" card on the right side (sticky)
   showing a mock launcher + topic button using the current
   values.
2. **Corner roundness** — segmented control: `Sharp` /
   `Rounded` / `Pill`. Render with a tiny icon per option.
3. **Button style** — segmented control: `Solid` / `Outline`
   / `Ghost`.
4. **Message bubble style** — segmented control: `Rounded` /
   `Square` / `Tail`. (The "tail" variant has the classic chat
   bubble pointer.)
5. **Launcher icon** — two-tab section:
   - **Preset**: 4×4 grid of lucide icons. Click to select.
   - **Upload**: file input + uploader (≤ 1 MB; PNG/SVG/WebP).
     Uses the existing `BusinessLogoUploader.tsx` pattern.
     Successful upload writes the bucket URL into form state.
     A "Remove custom icon" button reverts to the preset.
6. **Greeting message** — textarea, 280 char counter, markdown
   hint below ("Supports **bold** and [links](https://...)").
7. **Save** + **Reset to defaults** buttons at the bottom. Reset
   confirms before calling `resetWidgetConfig`.

Live preview pane:

- Sticky on the right (desktop). Collapses to the top on mobile.
- Shows a mock 320×420 widget panel rendering:
  - Header with business name.
  - Greeting message (markdown-rendered).
  - Three sample topic buttons with the configured icon /
    roundness / button style.
  - One sample bubble in the configured style.
  - Floating launcher with the chosen icon / color / roundness.
- All values come from form state, not from the saved row —
  changes preview before save.
- No mock conversation list; this is purely visual.

Use the existing color system. Don't pull in a new color picker
library; a `<input type="color">` plus a hex text field is
sufficient.

---

## Step 5 — Inject the config into the widget

Open `src/app/embed/customer/page.tsx` (created/renamed in
prompt 2). Load `widget_config` server-side and pass to
`WidgetShell` as a prop.

```tsx
const { data: widgetCfg } = await svc
  .from("widget_config")
  .select("*")
  .eq("business_id", session.businessId)
  .maybeSingle();

const cfg = { ...DEFAULTS, ...(widgetCfg ?? {}) };
```

Render a `<style>` tag at the top of the document body that
defines CSS variables from the config (do this in `layout.tsx`
since `<style>` is shared):

```tsx
// src/app/embed/customer/layout.tsx (extend, don't replace)
import { headers } from "next/headers";
import { loadWidgetConfig } from "@/lib/widget-config";

export default async function Layout({ children }: { children: ReactNode }) {
  // Resolve the inbox/business from the `?key=` query param via the
  // same path as page.tsx. (Layout doesn't receive searchParams in
  // Next.js 16 — read from headers/cookies if available, otherwise
  // pass values down via context from page.tsx by rendering the
  // <style> block inside page.tsx instead of layout. Verify against
  // node_modules/next/dist/docs/.)
  …
  return (
    <html>
      <body className="bg-transparent">
        <style>{`
          :root {
            --hl-primary: ${cfg.primary_color};
            --hl-primary-tint: ${tint(cfg.primary_color, 0.08)};
            --hl-radius: ${roundnessToRadius(cfg.roundness)};
            --hl-button-style: ${cfg.button_style};
            --hl-bubble-style: ${cfg.bubble_style};
          }
        `}</style>
        {children}
      </body>
    </html>
  );
}
```

Map the enums to concrete values in `src/app/embed/customer/_lib/theme.ts`:

```ts
export function roundnessToRadius(r: "sharp"|"rounded"|"pill"): string {
  return r === "sharp" ? "2px" : r === "pill" ? "9999px" : "12px";
}

export function tint(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return `rgba(15,23,42,${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${alpha})`;
}
```

Then rewrite the existing Tailwind class strings in:

- `WidgetShell.tsx` (the FAB and the panel chrome).
- `ConversationList.tsx` (the `+ New conversation` button +
  topic picker buttons).
- `ThreadComposer.tsx` (send button).
- `ThreadMessages.tsx` (outbound message bubble).

…to use the CSS variables. Example:

```tsx
// before
<button className="… bg-red-600 hover:bg-red-500 rounded-full …">

// after
<button
  className="…"
  style={{
    background: "var(--hl-primary)",
    borderRadius: "var(--hl-radius)",
  }}
>
```

For `button_style`:

- `solid`  → `background: var(--hl-primary); color: white;`
- `outline` → `background: transparent; color: var(--hl-primary); border: 1px solid var(--hl-primary);`
- `ghost`  → `background: var(--hl-primary-tint); color: var(--hl-primary); border: none;`

Implement these three variants with a small helper component
`Button.tsx` in `src/app/embed/customer/_components/Button.tsx`
that reads `--hl-button-style` from CSS via a `data-variant`
attribute and applies the right rules. Avoid runtime-style
switching — drive it through CSS so the variants are diff-able
in DevTools.

For `bubble_style`:

- `rounded` → `border-radius: var(--hl-radius)`
- `square`  → `border-radius: 2px`
- `tail`    → `border-radius: var(--hl-radius)` plus an inline
  `::before` pseudo-element triangle in the outbound color (for
  the customer-side bubbles). Keep the SVG approach simple: a
  tiny inline SVG `<svg>` triangle absolutely positioned.

For the launcher icon:

- If `launcher_icon_url` is set, render `<img>` with that URL
  (set `width=24 height=24` to avoid CLS).
- Otherwise look up `launcher_icon_preset` in the same lucide
  map the dashboard uses, render the lucide-react component.
- Fall back to `MessageCircle` if neither is set.

Greeting message render: a tiny markdown subset in
`src/app/embed/customer/_lib/markdown.ts`. Parse only:

- `**text**` → `<strong>text</strong>`
- `[label](https://url)` → `<a href="url" target="_blank" rel="noopener noreferrer">label</a>` (https only)

Escape everything else. Keep the parser under 60 lines. Tests
welcome but optional.

---

## Step 6 — Caching strategy

Widget config is read once per iframe load in `page.tsx`. That's
fine — the page is a server component and Next.js will re-render
on revalidation. The `revalidatePath('/embed/customer')` from
the save action ensures the next iframe load shows the new
config.

Do not add a client-side fetch for config — it's not needed,
adds a round-trip, and would require a public endpoint we
otherwise don't have.

---

## Step 7 — Verification

```bash
# 1. Dashboard form round-trip
# Open /dashboard/settings/widget-appearance as an owner.
# - Confirm defaults shown if no row exists.
# - Change primary color to #8b5cf6 (violet). Save. Reload — value
#   persists.
# - Switch roundness to "Pill". Save. Reload.
# - Upload a custom 24×24 PNG to the launcher. Confirm the URL is
#   under <project>.supabase.co/storage/.../widget-icons/<biz>/...
# - Write a greeting: "Hi! How can we help? **Try Billing** for
#   invoices."

# 2. Widget reflection (greenflagged)
# Reload greenflagged signed in. Open widget.
# - Launcher uses the violet color, pill shape, custom icon.
# - Topic picker rounded per config. Buttons style per config.
# - Greeting shown above the topic buttons, with **Try Billing**
#   bolded.

# 3. Live preview matches reality
# Side-by-side the dashboard preview pane and the real greenflagged
# launcher. Color, roundness, icon, greeting should match exactly.

# 4. Reset
# Click "Reset to defaults" in dashboard. Confirm row deleted.
# Reload widget — back to the default dark color, rounded
# corners, lucide MessageCircle launcher, no greeting.

# 5. Validation
# Try saving with primary_color="purple" → rejected (must be hex).
# Try saving with greeting_message longer than 280 chars →
# rejected.
# Try saving with launcher_icon_preset="random-thing" → rejected.
# Try saving with a launcher_icon_url pointing at a different
# bucket → rejected.

# 6. Auth scoping (regression)
# Confirm a non-owner agent visiting /dashboard/settings/widget-appearance
# is redirected by requireRole.
```

Document each step in the PR.

---

## Step 8 — Out of scope

- **Dark mode / theme switching.** Round 6.
- **Custom fonts.** Round 6.
- **Launcher position toggle** (bottom-left vs bottom-right).
  Round 6.
- **Per-inbox config.** Round 5 ties `widget_config` to
  `business_id`; if a business has multiple inboxes, they share
  branding. Round 6 splits per-inbox.
- **Per-option icons override.** The icon on each start option
  (prompt 4) is separate from the launcher icon (this prompt).
  Both exist; round 5 does not unify them.

---

## Definition of done

- [ ] `widget-icons` storage bucket exists with the same RLS
      pattern as `logos`.
- [ ] `widget_config` table from migration 0025 is in use.
- [ ] `/dashboard/settings/widget-appearance` lets owners edit
      all six fields; live preview reflects unsaved changes.
- [ ] Saving + reload survives a refresh on greenflagged.
- [ ] CSS variables drive every themed element of the widget
      (FAB, panel chrome, topic picker, composer button, bubbles).
- [ ] Validation: bad hex, oversize greeting, unknown preset,
      wrong-bucket URL all rejected with clear errors.
- [ ] `wc -l` ≤ 600 on every touched/created file.
- [ ] Greenflagged end-to-end visual check passes (screenshot
      in PR).

End the PR description with: screenshots of the dashboard form
and the greenflagged launcher in two distinct color/roundness
configurations.
