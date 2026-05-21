import { requireActiveContext } from "@/lib/active-context";
import { LABELS } from "@/lib/onboarding/enums";
import { InboxKeyCard } from "./InboxKeyCard";

export default async function ApiKeysPage() {
  const ctx = await requireActiveContext();

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-[14px] font-medium text-deep/60">Integration keys</p>
        <h1 className="text-3xl sm:text-4xl tracking-tight text-ink leading-[1] font-normal">
          Your secret{" "}
          <span className="font-serif-italic font-normal text-deep">
            keys<span className="text-deep/40">.</span>
          </span>
        </h1>
        <p className="text-deep/70 leading-relaxed text-[15px] font-normal max-w-[640px]">
          Each inbox has its own{" "}
          <code className="rounded bg-mist/60 px-1 text-[13px]">pk_live_…</code>{" "}
          key. Embed the right one in the right surface so conversations land
          where you expect.
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
        <div className="space-y-8">
          {ctx.groups.map((g) => (
            <section key={g.project.id} className="space-y-3">
              <h2 className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
                {g.project.name}
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {g.inboxes.map((ib) => (
                  <InboxKeyCard
                    key={ib.id}
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
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <aside className="rounded-2xl bg-white border border-mist/80 shadow-[0_1px_2px_rgba(11,11,11,0.04)] p-6 space-y-3">
        <h2 className="text-[16px] font-medium text-ink">How to use</h2>
        <pre className="rounded-xl bg-ink text-white/90 font-mono text-[12px] px-4 py-3 overflow-x-auto">
{`import { initChatSDK } from "@holylabs/chat-sdk-web";

initChatSDK({
  apiKey: "pk_live_…", // ← copy from the inbox above
});`}
        </pre>
        <p className="text-[13px] text-deep/60">
          Treat keys like passwords. If you suspect a key is leaked, rotate it
          from the red icon — the old key stops working immediately.
        </p>
      </aside>
    </div>
  );
}
