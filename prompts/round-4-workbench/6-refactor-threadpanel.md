# 6 — Refactor: split `ThreadPanel.tsx` and audit the 600-line cap

Read `AGENTS.md` and `0-shared.md` before starting. **Run this
prompt LAST** — after prompts 1–5 have been merged. Prompt 1's
visitor-side agent identity header edit lives in
`ThreadPanel.tsx`; splitting before it merges creates pointless
conflict.

## Goal

1. Split `src/app/embed/widget/ThreadPanel.tsx` (currently 635
   lines, was already over the cap before round 4) into four
   files, each ≤ 250 lines.
2. Sweep the rest of the repo for any file > 600 lines that
   round 4 touched (or didn't touch but crossed the threshold
   incidentally) and bring it under.
3. Add a CI check or pre-commit hook (optional — see step 4)
   so the cap is enforced going forward.

This prompt does **not** add features. Pure refactor — every
behavioural test that passed before still passes after.

---

## Step 1 — Read the file end-to-end first

```bash
wc -l src/app/embed/widget/ThreadPanel.tsx
```

Confirm the line count. If it's already ≤ 600 (e.g. prompt 1's
header edit was tiny and someone fixed it earlier), the
mandatory split is moot — but still scan for other offenders
in step 3.

Map the file's logical regions:

```
Region                              Lines (approx)
─────────────────────────────────────────────────
1. Imports + types                  ~30
2. Hooks: data fetching             ~120
3. Hooks: realtime subscription     ~60
4. Hooks: composer state            ~50
5. Effects: scroll, focus, etc.     ~50
6. Render: header (incl. round-4)   ~40
7. Render: message list             ~140
8. Render: composer + attachments   ~120
9. Render: status pill, etc.        ~25
```

(Numbers are sketches — confirm by reading.)

---

## Step 2 — Target split

Four files. Same directory.

### `useThreadConversation.ts` (≤ 220 lines)

Owns regions 2 + 3 + parts of 5 (data-fetch effects). Exports:

```ts
export interface UseThreadConversationResult {
  conversation: ConversationEnvelope | null;
  messages: MessageRow[];
  loading: boolean;
  error: Error | null;
  send(content: string, attachments?: File[]): Promise<void>;
  markRead(): void;
  refetch(): void;
}

export function useThreadConversation(
  conversationId: string | null,
  apiKey: string,
): UseThreadConversationResult;
```

Internal: the realtime subscription, the optimistic
update logic, the message pagination handler — all the
"data" concerns.

### `ThreadMessages.tsx` (≤ 200 lines)

Owns region 7. A pure-ish view component:

```tsx
export function ThreadMessages({
  messages,
  loadingOlder,
  onLoadOlder,
  agentName,        // round-4: passed in, used for outbound bubble alignment
}: {
  messages: MessageRow[];
  loadingOlder: boolean;
  onLoadOlder: () => void;
  agentName: string | null;
}): JSX.Element;
```

Move attachment rendering helpers into a sibling
`ThreadAttachment.tsx` only if `ThreadMessages.tsx` would
otherwise exceed 200 lines. Don't over-split.

### `ThreadComposer.tsx` (≤ 180 lines)

Owns regions 4 + 8. Exposes:

```tsx
export function ThreadComposer({
  onSend,
  disabled,
  placeholder,
}: {
  onSend: (content: string, attachments?: File[]) => Promise<void>;
  disabled: boolean;
  placeholder?: string;
}): JSX.Element;
```

### `ThreadPanel.tsx` (≤ 200 lines after refactor)

What remains: header (region 6), state plumbing, layout
wrappers, and stitching the three pieces above. The mental
model is "controller component."

If after the split `ThreadPanel.tsx` is still > 200 lines,
extract `ThreadPanelHeader.tsx` (region 6) as a fifth file.
Don't pre-emptively split unless needed.

---

## Step 3 — Sweep for other offenders

```bash
find src -type f \( -name '*.tsx' -o -name '*.ts' \) \
  -not -path '*/node_modules/*' \
  -exec wc -l {} + | awk '$1 > 600 { print $1, $2 }' | sort -rn
```

Address every file in the output. Strategy by file:

- **Pages** (`src/app/**/page.tsx`) — extract render sections
  to sibling `_components/*.tsx` files. Pages routinely
  collect helper functions that belong elsewhere.
- **Server actions** (`src/app/dashboard/_actions/*.ts`) —
  group related actions into sibling files
  (e.g. `webhooks.ts` → `webhooks/secret.ts`,
  `webhooks/events.ts`, `webhooks/test.ts`, `webhooks/index.ts`
  re-exporting).
- **`tenant-webhook.ts`** — if prompt 5 already split it,
  nothing to do here.
- **Library modules** (`src/lib/*.ts`) — split by domain
  concern.

Do **not** move code across module boundaries that changes
import paths for callers without checking the callers compile.
After every split, run `pnpm typecheck`.

---

## Step 4 — Optional but recommended: cap check in CI

Add a script `scripts/check-line-cap.sh`:

```bash
#!/usr/bin/env bash
set -e
LIMIT=600
OFFENDERS=$(find src supabase -type f \
  \( -name '*.ts' -o -name '*.tsx' -o -name '*.sql' \) \
  -not -path '*/node_modules/*' \
  -exec wc -l {} + | awk -v lim=$LIMIT '$1 > lim { print $1, $2 }' | sort -rn)
if [[ -n "$OFFENDERS" ]]; then
  echo "Files exceeding $LIMIT lines:"
  echo "$OFFENDERS"
  exit 1
fi
echo "All files within $LIMIT-line cap."
```

Wire it as a `pnpm` script:

```json
"scripts": {
  "check:line-cap": "bash scripts/check-line-cap.sh"
}
```

Don't add it to a pre-commit hook in this prompt without the
founder's nod — pre-commit hooks affect workflow and the
founder hasn't asked for one. Mention the script in the PR
description so the founder can wire it into CI (Vercel build
command, GitHub Actions, whatever they use) at their leisure.

If the founder prefers no script, skip step 4 entirely — the
core deliverable is the split, not the enforcement.

---

## Step 5 — Acceptance

1. `pnpm typecheck` clean.
2. `pnpm lint` clean.
3. `pnpm dev` and load the FAB widget on greenflagged.xyz
   (`pk_live_45f4942f494ae8a94da8aca3`):
   - Widget opens.
   - History loads.
   - Sending a message works.
   - Attachment upload works (if supported by current
     widget).
   - Scroll-up loads older messages.
   - Realtime updates when a new inbound message arrives
     from another browser session.
   - Agent identity header displays correctly when the
     conversation is assigned (from prompt 1 + 4).
4. `scripts/check-line-cap.sh` exits 0 (if you added the
   script).
5. `wc -l src/app/embed/widget/*.{ts,tsx}` — every file
   ≤ 600, ideally ≤ 250.
6. `git diff --stat src/app/embed/widget/` — the diff is
   purely structural; no behavioural code introduced or
   removed. Sanity-check by reviewing the diff manually.

`wc -l` final:

```bash
wc -l \
  src/app/embed/widget/ThreadPanel.tsx \
  src/app/embed/widget/ThreadMessages.tsx \
  src/app/embed/widget/ThreadComposer.tsx \
  src/app/embed/widget/useThreadConversation.ts \
  $(find src supabase -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.sql' \) \
    -not -path '*/node_modules/*' \
    -exec wc -l {} + | awk '$1 > 600 { print $2 }')
```

The second part should print nothing (no files over 600).

---

## Out of scope

- Feature changes to the widget — none. Pure refactor.
- Stylistic rewrites unrelated to the split.
- Refactoring `src/app/dashboard/**` files that are under
  the cap but feel "too long" — leave them alone.

---

## Round 4 done

After this prompt merges, round 4 is complete. The next
brief (round 5) lives in `prompts/round-5-*-brief.md` — the
deferred items list at the end of the round 4 README is the
starter agenda:

- Realtime presence channel for live agent status.
- Skill-based routing.
- Multi-agent collaboration / notes / @mentions.
- OAuth (Google) for agents.
- Off-hours auto-reply / out-of-office mode.

When you write the round 5 brief, follow the same format as
`prompts/round-3-brief.md` and `prompts/round-4-workbench-brief.md`.
