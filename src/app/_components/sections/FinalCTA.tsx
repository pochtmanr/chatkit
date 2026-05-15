import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function FinalCTA() {
  return (
    <section className="relative bg-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-dotted-mist [mask-image:radial-gradient(ellipse_60%_70%_at_center,_black_0%,_transparent_85%)] [-webkit-mask-image:radial-gradient(ellipse_60%_70%_at_center,_black_0%,_transparent_85%)]"
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pb-24">
        <div className="relative rounded-[2.5rem] bg-ink text-white px-8 sm:px-16 py-16 sm:py-20 overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        />
        <div className="relative max-w-2xl mx-auto text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">
            Ready?
          </p>
          <h2 className="mt-4 text-4xl sm:text-6xl tracking-tight leading-[1] font-normal">
            Ship support{" "}
            <span className="font-serif-italic font-normal text-zinc-300">
              in an afternoon<span className="text-zinc-500">.</span>
            </span>
          </h2>
          <p className="mt-6 text-zinc-300 leading-relaxed">
            Pay per conversation. No agent fees. Cancel anytime.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full bg-white text-ink px-6 py-3 text-sm hover:bg-mist transition-colors"
            >
              Start free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#install"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 text-white px-6 py-3 text-sm hover:bg-white/10 transition-colors"
            >
              Read the docs
            </a>
          </div>
        </div>
      </div>
      </div>
    </section>
  );
}
