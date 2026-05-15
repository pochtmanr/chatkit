import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { PlatformTabs } from "./_components/PlatformTabs";

export const metadata: Metadata = {
  title: "SDK reference — TinyChat",
  description:
    "Install and integrate TinyChat on Next.js, React Native, iOS, Android, or any web page in under 5 minutes.",
};

export default function SdkPage() {
  return (
    <>
      {/* ─── Hero band: mist + dotted, page heading ─── */}
      <section className="relative bg-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-dotted-mist [mask-image:radial-gradient(ellipse_60%_70%_at_center,_black_0%,_transparent_85%)] [-webkit-mask-image:radial-gradient(ellipse_60%_70%_at_center,_black_0%,_transparent_85%)]"
        />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-28 sm:pt-32 pb-12 sm:pb-16">
          <div className="max-w-3xl">
            <p className="text-[14px] font-medium text-deep/60">
              SDK reference
            </p>
            <h1 className="mt-4 text-4xl sm:text-6xl tracking-tight text-ink leading-[1] font-normal">
              Drop us in.{" "}
              <span className="font-serif-italic text-deep">
                Ship in an afternoon
                <span className="text-deep/40">.</span>
              </span>
            </h1>
            <p className="mt-5 text-deep/70 leading-relaxed text-[16px]">
              One package per platform, one env var, zero backend. Pick your
              stack — every snippet below is copy-paste ready.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2 text-[13px] text-deep/60">
              <span className="rounded-full bg-white/80 border border-deep/15 px-3 py-1 font-mono text-xs text-deep shadow-sm">
                Next.js / Web
              </span>
              <span className="rounded-full bg-white/80 border border-deep/15 px-3 py-1 font-mono text-xs text-deep shadow-sm">
                React Native
              </span>
              <span className="rounded-full bg-white/80 border border-deep/15 px-3 py-1 font-mono text-xs text-deep shadow-sm">
                iOS Swift
              </span>
              <span className="rounded-full bg-white/80 border border-deep/15 px-3 py-1 font-mono text-xs text-deep shadow-sm">
                Android
              </span>
              <span className="rounded-full bg-white/80 border border-deep/15 px-3 py-1 font-mono text-xs text-deep shadow-sm">
                Vanilla JS
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Platform tabs + per-platform docs ─── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
        <PlatformTabs />
      </section>

      {/* ─── End-of-page CTA: link to /api-reference ─── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-24">
        <div className="w-full max-w-7xl mx-auto">
          <div className="bg-mist rounded-[48px] border border-mist shadow-sm overflow-hidden">
            <div className="bg-white rounded-[40px] m-2 shadow-sm">
              <div className="p-8 md:p-10 lg:p-12 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div>
                  <p className="text-[14px] font-medium text-deep/60">
                    Need the raw HTTP API?
                  </p>
                  <h2 className="mt-3 text-3xl sm:text-4xl tracking-tight text-ink leading-tight font-normal">
                    Same surface,{" "}
                    <span className="font-serif-italic text-deep">
                      just a fetch away
                      <span className="text-deep/40">.</span>
                    </span>
                  </h2>
                  <p className="mt-3 text-deep/70 leading-relaxed text-[15px] max-w-xl">
                    The SDKs are thin wrappers over the REST surface — anything
                    they do, you can do directly with a request from your
                    server.
                  </p>
                </div>
                <Link
                  href="/api-reference"
                  className="group inline-flex items-center gap-2 rounded-full bg-ink text-white pl-5 pr-2 py-2 text-[15px] shadow-lg shadow-ink/10 hover:bg-deep transition-colors shrink-0"
                >
                  API reference
                  <span className="grid place-items-center h-7 w-7 rounded-full bg-white text-ink transition-transform group-hover:translate-x-0.5">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              </div>
            </div>

            <div className="px-6 sm:px-12 md:px-16 lg:px-20 py-5 flex flex-col md:flex-row justify-between items-center gap-6 text-[15px]">
              <p className="text-deep/70 font-medium">
                Embedding on a static site? Use the Vanilla JS snippet above.
              </p>
              <Link
                href="/support"
                className="inline-flex items-center gap-2 text-deep font-medium hover:text-ink transition-colors"
              >
                See it live on /support
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
