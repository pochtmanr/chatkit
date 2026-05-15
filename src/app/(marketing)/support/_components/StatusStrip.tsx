import { ArrowRight } from "lucide-react";

export function StatusStrip() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-24">
      <div className="rounded-2xl border border-mist bg-white px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[0_1px_2px_rgba(11,11,11,0.04)]">
        <div className="flex items-center gap-2 text-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-deep">All systems operational</span>
        </div>
        <a
          href="https://status.tinychat.dev"
          target="_blank"
          rel="noreferrer noopener"
          className="text-sm text-deep font-medium hover:text-ink transition-colors inline-flex items-center gap-1"
        >
          Status page <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </section>
  );
}
