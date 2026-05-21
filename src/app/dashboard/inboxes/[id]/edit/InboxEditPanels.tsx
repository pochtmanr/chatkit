"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Field,
  Select,
  SegmentedControl,
} from "@/app/dashboard/_components/ui/primitives";
import {
  INBOX_PURPOSES,
  INBOX_AUDIENCES,
  LABELS,
  type InboxPurpose,
  type Audience,
} from "@/lib/onboarding/enums";
import {
  renameInbox,
  archiveInbox,
  rotateInboxApiKey,
  saveInboxWebhook,
  testInboxWebhook,
} from "@/app/dashboard/_actions/inboxes";
import { EmbedSnippets } from "@/app/dashboard/settings/EmbedSnippets";

type Inbox = {
  id: string;
  business_id: string;
  project_id: string;
  name: string;
  purpose: string;
  audience: string;
  api_key: string;
  webhook_url: string | null;
  archived_at: string | null;
};

export function InboxEditPanels({
  inbox,
  chatAdminHost,
}: {
  inbox: Inbox;
  chatAdminHost: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [revealedKey, setRevealedKey] = useState(false);
  const [apiKey, setApiKey] = useState(inbox.api_key);
  const [savedWebhookUrl, setSavedWebhookUrl] = useState(
    inbox.webhook_url ?? "",
  );
  const [webhookUrl, setWebhookUrl] = useState(inbox.webhook_url ?? "");
  const [webhookSaved, setWebhookSaved] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: number | null;
    body: string;
  } | null>(null);
  const webhookId = useId();

  function saveProfile(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await renameInbox({
        inboxId: inbox.id,
        name: String(fd.get("name") ?? ""),
        purpose: fd.get("purpose") as InboxPurpose,
        audience: fd.get("audience") as Audience,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 1500);
    });
  }

  function onRotate() {
    if (
      !confirm(
        "Rotate this inbox's API key? The old key stops working immediately.",
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await rotateInboxApiKey(inbox.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setApiKey(res.apiKey);
      setRevealedKey(true);
    });
  }

  function onSaveWebhook() {
    setError(null);
    setTestResult(null);
    startTransition(async () => {
      const url = webhookUrl.trim();
      const res = await saveInboxWebhook({
        inboxId: inbox.id,
        url: url || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSavedWebhookUrl(url);
      setWebhookSaved(true);
      setTimeout(() => setWebhookSaved(false), 1500);
    });
  }

  function onTestWebhook() {
    setError(null);
    setTestResult(null);
    startTransition(async () => {
      const res = await testInboxWebhook(inbox.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setTestResult({ status: res.status, body: res.body });
    });
  }

  function onArchive() {
    if (
      !confirm(
        "Archive this inbox? Conversations stay readable but no new messages will land.",
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await archiveInbox(inbox.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/dashboard/settings");
    });
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <form
        action={saveProfile}
        className="rounded-2xl bg-white border border-mist/80 p-6 md:p-8 space-y-6"
      >
        <header className="flex items-baseline justify-between">
          <h2 className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
            Profile
          </h2>
          {profileSaved && (
            <span className="text-[12px] text-emerald-700">Saved</span>
          )}
        </header>
        <Field label="Inbox name" name="name" defaultValue={inbox.name} />
        <Select<InboxPurpose>
          label="Purpose"
          name="purpose"
          options={INBOX_PURPOSES}
          labels={LABELS.purpose}
          defaultValue={inbox.purpose as InboxPurpose}
        />
        <SegmentedControl<Audience>
          label="Audience"
          name="audience"
          options={INBOX_AUDIENCES}
          labels={LABELS.audience}
          defaultValue={inbox.audience as Audience}
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-ink text-white px-5 py-2 text-[14px] font-medium hover:bg-deep transition-colors disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save profile"}
          </button>
        </div>
      </form>

      <section className="rounded-2xl bg-white border border-mist/80 p-6 md:p-8 space-y-4">
        <header>
          <h2 className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
            API key
          </h2>
        </header>
        <div className="flex items-center gap-3">
          <code className="flex-1 rounded-xl bg-ink text-white/90 font-mono text-[13px] px-4 py-3 overflow-x-auto">
            {revealedKey ? apiKey : "•".repeat(24)}
          </code>
          <button
            type="button"
            onClick={() => setRevealedKey((v) => !v)}
            className="rounded-full bg-white border border-mist px-4 py-2 text-[14px] font-medium text-ink hover:bg-mist/40 transition-colors"
          >
            {revealedKey ? "Hide" : "Reveal"}
          </button>
          <button
            type="button"
            onClick={onRotate}
            disabled={pending}
            className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-[14px] font-medium text-red-700 hover:bg-red-100 transition-colors disabled:opacity-60"
          >
            Rotate
          </button>
        </div>
      </section>

      <section className="rounded-2xl bg-white border border-mist/80 p-6 md:p-8 space-y-4">
        <header className="flex items-baseline justify-between">
          <h2 className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
            Webhook
          </h2>
          {webhookSaved && (
            <span className="text-[12px] text-emerald-700">Saved</span>
          )}
        </header>
        <label htmlFor={webhookId} className="block">
          <span className="text-[13px] font-medium text-deep/70">
            Webhook URL
          </span>
          <input
            id={webhookId}
            type="url"
            name="webhook"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://…"
            className="mt-1.5 w-full rounded-xl border border-mist bg-white px-4 py-3 text-[15px] text-ink placeholder:text-deep/30 shadow-[0_1px_2px_rgba(11,11,11,0.03)] focus:outline-none focus:border-deep/40 focus:ring-2 focus:ring-deep/10 transition-all"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onTestWebhook}
            disabled={!savedWebhookUrl || pending}
            className="rounded-full bg-white border border-mist px-4 py-2 text-[14px] font-medium text-ink hover:bg-mist/40 transition-colors disabled:opacity-60"
          >
            Send test
          </button>
          <button
            type="button"
            onClick={onSaveWebhook}
            disabled={pending}
            className="rounded-full bg-ink text-white px-5 py-2 text-[14px] font-medium hover:bg-deep transition-colors disabled:opacity-60"
          >
            Save webhook
          </button>
        </div>
        {testResult && (
          <pre className="text-[12px] bg-mist/40 p-3 rounded-xl whitespace-pre-wrap font-mono">
            {testResult.status ?? "n/a"} · {testResult.body.slice(0, 400)}
          </pre>
        )}
      </section>

      <section className="rounded-2xl bg-white border border-mist/80 p-6 md:p-8 space-y-4">
        <header>
          <h2 className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
            Embed snippet
          </h2>
        </header>
        <EmbedSnippets
          inboxId={inbox.id}
          apiKey={apiKey}
          defaultHost={chatAdminHost}
        />
      </section>

      <section className="rounded-2xl border border-red-200 bg-red-50/40 p-6 md:p-8 space-y-3">
        <header>
          <h2 className="text-[14px] font-medium text-red-800">
            Archive inbox
          </h2>
        </header>
        <p className="text-[13px] text-red-700/80">
          Archiving hides the inbox from switchers and tab lists. Conversations
          remain readable; new messages stop landing. Contact us to restore.
        </p>
        <button
          type="button"
          onClick={onArchive}
          disabled={pending}
          className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-4 py-2 text-[14px] font-medium text-red-700 hover:bg-red-100 transition-colors disabled:opacity-60"
        >
          Archive this inbox
        </button>
      </section>

      {error && (
        <p className="text-[13px] font-medium text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <Link
          href="/dashboard/settings"
          className="text-[14px] font-medium text-deep/70 hover:text-ink transition-colors"
        >
          Back to settings
        </Link>
      </div>
    </div>
  );
}
