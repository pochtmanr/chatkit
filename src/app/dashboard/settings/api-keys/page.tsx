import { requireActiveContext } from "@/lib/active-context";
import { getServiceClient } from "@/lib/supabase/server";
import { LABELS } from "@/lib/onboarding/enums";
import { PublishableKeyCard } from "@/app/dashboard/_components/settings/PublishableKeyCard";
import { ServerSecretCard } from "@/app/dashboard/_components/settings/ServerSecretCard";

type ServerSecretRow = {
  id: string;
  server_secret_hash: string | null;
  server_secret_rotated_at: string | null;
};

export default async function ApiKeysSettingsPage() {
  const ctx = await requireActiveContext();
  const inboxIds = ctx.groups.flatMap((g) => g.inboxes.map((i) => i.id));

  // Fetch server-secret state per inbox. The Inbox shape from
  // active-context doesn't carry the secret columns — they were added in
  // 0025 and we don't want active-context to fan out unnecessarily.
  const secretsByInbox = new Map<string, { prefix: string | null; rotatedAt: string | null }>();
  if (inboxIds.length > 0) {
    const admin = getServiceClient();
    const { data } = await admin
      .from("inboxes")
      .select("id, server_secret_hash, server_secret_rotated_at")
      .in("id", inboxIds);
    for (const row of (data ?? []) as ServerSecretRow[]) {
      // The raw key prefix isn't stored — but a key that exists shows
      // as "sk_live_…" with the masked tail. We display a sentinel
      // "sk_live_" prefix since that's all the user needs to recognize.
      secretsByInbox.set(row.id, {
        prefix: row.server_secret_hash ? "sk_live_" : null,
        rotatedAt: row.server_secret_rotated_at,
      });
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-[14px] font-medium text-deep/60">Integration keys</p>
        <h1 className="text-3xl sm:text-4xl tracking-tight text-ink leading-[1] font-normal">
          API{" "}
          <span className="font-serif-italic font-normal text-deep">
            keys<span className="text-deep/40">.</span>
          </span>
        </h1>
        <p className="text-deep/70 leading-relaxed text-[15px] font-normal max-w-[640px]">
          Each inbox has two keys.{" "}
          <code className="rounded bg-mist/60 px-1 text-[13px]">pk_live_…</code>{" "}
          is safe to embed in browsers — it bootstraps the widget.{" "}
          <code className="rounded bg-mist/60 px-1 text-[13px]">sk_live_…</code>{" "}
          stays on your backend and mints widget JWTs via{" "}
          <code className="rounded bg-mist/60 px-1 text-[13px]">
            POST /api/v1/widget-tokens
          </code>
          .
        </p>
      </header>

      {ctx.groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-mist bg-white/50 p-12 text-center">
          <p className="text-[15px] text-ink">No inboxes yet.</p>
          <p className="text-[13px] text-deep/60 mt-1">
            Add one from the inbox switcher in the sidebar.
          </p>
        </div>
      ) : (
        ctx.groups.map((g) => (
          <section key={g.project.id} className="space-y-3">
            <h2 className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
              {g.project.name}
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {g.inboxes.map((ib) => {
                const sec = secretsByInbox.get(ib.id);
                return (
                  <div key={ib.id} className="space-y-3">
                    <PublishableKeyCard
                      inboxId={ib.id}
                      inboxName={ib.name}
                      audience={
                        LABELS.audience[ib.audience as keyof typeof LABELS.audience] ??
                        ib.audience
                      }
                      purpose={
                        LABELS.purpose[ib.purpose as keyof typeof LABELS.purpose] ??
                        ib.purpose
                      }
                      initialApiKey={ib.api_key}
                    />
                    <ServerSecretCard
                      inboxId={ib.id}
                      inboxName={ib.name}
                      hasSecret={!!sec?.prefix}
                      prefix={sec?.prefix ?? null}
                      rotatedAt={sec?.rotatedAt ?? null}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      <aside className="rounded-2xl bg-white border border-mist/80 shadow-[0_1px_2px_rgba(11,11,11,0.04)] p-6 space-y-3">
        <h2 className="text-[16px] font-medium text-ink">How to use</h2>
        <pre className="rounded-xl bg-ink text-white/90 font-mono text-[12px] px-4 py-3 overflow-x-auto">
{`// Host backend (mint a JWT for the signed-in user):
POST /api/v1/widget-tokens
Authorization: Bearer sk_live_…
Content-Type: application/json

{ "user_id": "host_user_uuid", "allowed_kinds": ["support"] }

// Browser (host page) — render the iframe with the minted token:
<iframe
  src="https://chat-admin.holylabs.io/embed/customer?key=pk_live_…&token=<JWT>"
  …
></iframe>

// Coming in v0.6: a drop-in React provider wraps the fetch + iframe + handshake.`}
        </pre>
        <p className="text-[13px] text-deep/60">
          Treat <code>sk_live_</code> keys like database passwords. If one
          leaks, rotate it from the card above — the previous key keeps
          minting for 24 hours, then stops. Full install walkthrough:{" "}
          <a
            href="/dashboard/docs/install"
            className="underline text-deep hover:text-ink"
          >
            Docs → Install
          </a>
          .
        </p>
      </aside>
    </div>
  );
}
