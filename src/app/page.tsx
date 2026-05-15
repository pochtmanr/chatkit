import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Check,
  MessageSquare,
  Webhook,
  ShieldCheck,
  Globe,
  Quote,
  ChevronDown,
  Send,
  Smile,
  Paperclip,
  Search,
} from "lucide-react";
import { InstallTabs } from "./_components/InstallTabs";
import Footer from "./_components/Footer";

export default function LandingPage() {
  return (
    <main className="min-h-dvh bg-white text-ink">
      {/* HERO */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pt-4 sm:pt-6">
        {/* NAVBAR */}
        <nav className="flex items-center justify-between rounded-full bg-mist border border-ink/10 p-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-white border border-zinc-200/80 shadow-sm pl-3 pr-4 py-2 text-sm font-bold tracking-tight text-ink hover:shadow-md transition-shadow"
          >
            <span className="grid place-items-center h-6 w-6 rounded-full bg-ink text-white">
              <MessageSquare className="h-3.5 w-3.5" />
            </span>
            TinyChat
          </Link>

          <div className="hidden md:flex items-center gap-1 text-sm font-medium text-deep">
            <a
              href="#features"
              className="px-4 py-2 rounded-full hover:bg-white hover:shadow-sm transition-all"
            >
              Features
            </a>
            <a
              href="#pricing"
              className="px-4 py-2 rounded-full hover:bg-white hover:shadow-sm transition-all"
            >
              Pricing
            </a>
            <a
              href="#install"
              className="px-4 py-2 rounded-full hover:bg-white hover:shadow-sm transition-all"
            >
              Docs
            </a>
          </div>

          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-ink text-white pl-4 pr-2 py-1 text-sm font-bold hover:bg-deep transition-colors"
          >
            Sign in
            <span className="grid place-items-center h-7 w-7 rounded-full bg-white text-ink">
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        </nav>

        {/* CARDS */}
        <div className="mt-4 sm:mt-6 grid lg:grid-cols-2 gap-4 sm:gap-6 min-h-[calc(100dvh-7rem)] sm:min-h-[calc(100dvh-8rem)]">
          <div className="relative rounded-[2.5rem] bg-mist bg-dotted p-6 sm:p-8 flex flex-col min-h-[65vh] lg:min-h-0 overflow-hidden">
            <div className="max-w-xl mt-auto">
              <h1 className="text-ink leading-[0.95] text-[clamp(2.5rem,4.5vw,4.5rem)] tracking-tight font-normal">
                Customer chat.
                <br />
                <span className="font-serif-italic text-deep">
                  Built into your code<span className="text-zinc-400">.</span>
                </span>
              </h1>

              <div className="mt-8 inline-flex items-center rounded-full bg-white border border-zinc-200/80 shadow-sm p-1.5 pl-5 gap-4">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                    From
                  </span>
                  <span className="text-lg font-bold tracking-tight text-ink">
                    $0
                  </span>
                  <span className="text-xs text-zinc-500">/mo</span>
                </div>
                <Link
                  href="#pricing"
                  className="inline-flex items-center gap-2 rounded-full bg-ink text-white px-4 py-2 text-sm font-bold hover:bg-deep transition-colors"
                >
                  See pricing
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-10">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  Trusted by builders shipping with
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 text-zinc-400">
                  <span className="text-base font-bold tracking-tight">Linear</span>
                  <span className="text-base font-bold tracking-tight">Vercel</span>
                  <span className="text-base font-bold tracking-tight">Supabase</span>
                  <span className="text-base font-bold tracking-tight">Resend</span>
                </div>
              </div>
            </div>
          </div>

          <div className="relative rounded-[2.5rem] min-h-[65vh] lg:min-h-0 overflow-hidden bg-ink">
            <Image
              src="/hero-art.avif"
              alt=""
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />

            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 flex items-end justify-between gap-4">
              <p className="text-white text-sm sm:text-base max-w-xs sm:max-w-sm leading-snug drop-shadow-lg">
                Drop-in support tickets for React Native and web. No SDK to build.
              </p>
              <Link
                href="/signup"
                className="shrink-0 inline-flex items-center gap-2 rounded-full bg-white text-ink px-5 py-3 text-sm font-bold hover:bg-mist transition-colors shadow-lg"
              >
                Get started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* INSTALL / CODE SNIPPET */}
      <section id="install" className="mx-auto max-w-7xl px-4 sm:px-6 py-24">
        <div className="w-full max-w-7xl mx-auto">
          <div className="bg-mist rounded-[48px] border border-mist shadow-sm overflow-hidden">
            <div className="bg-white rounded-[40px] m-2 shadow-sm">
              <div className="p-8 md:p-10 lg:p-12">
                <div className="grid lg:grid-cols-[1fr_2fr] gap-8 lg:gap-12 items-stretch">
                  <div>
                    <p className="text-[14px] font-medium text-deep/60">
                      Install
                    </p>
                    <h2 className="mt-4 font-bold text-4xl sm:text-5xl tracking-tight text-ink leading-[1]">
                      Two lines{" "}
                      <span className="font-serif-italic font-normal text-deep">
                        and you&apos;re live
                        <span className="text-deep/40">.</span>
                      </span>
                    </h2>
                    <p className="mt-5 text-deep/70 leading-relaxed text-[16px] font-normal">
                      One package per platform, one env var, zero backend.
                      Render the widget, paste your API key, and start
                      receiving tickets in your TinyChat inbox.
                    </p>
                    <div className="mt-6 inline-flex items-center gap-2 rounded-lg border border-mist bg-mist/40 px-3 py-2 font-mono text-xs text-deep shadow-sm">
                      <span className="text-deep/40">$</span>
                      npm i @tinychat/react
                    </div>
                  </div>
                  <InstallTabs tabs={INSTALL_TABS} />
                </div>
              </div>
            </div>

            {/* Bottom strip in mist */}
            <div className="px-6 sm:px-12 md:px-16 lg:px-20 py-5 flex flex-col md:flex-row justify-between items-center gap-6 text-[15px]">
              <p className="text-deep/70 font-medium">
                Need more depth? See the full API reference.
              </p>
              <a
                href="#"
                className="inline-flex items-center gap-2 text-deep font-medium hover:text-ink transition-colors"
              >
                API reference
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="w-full bg-mist py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-2xl mb-12">
            <p className="text-[14px] font-medium text-deep/60">Features</p>
            <h2 className="mt-4 font-bold text-4xl sm:text-5xl tracking-tight text-ink leading-[1]">
              Everything you need,{" "}
              <span className="font-serif-italic font-normal text-deep">
                nothing extra<span className="text-deep/40">.</span>
              </span>
            </h2>
            <p className="mt-4 text-deep/70 leading-relaxed text-[16px] font-normal">
              Order chat, support inbox, webhooks, email — one backend, every
              platform.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => {
              // Asymmetric layout at lg+: [1, 2, 2, 1] → row1 1:2, row2 2:1
              const span =
                i === 1 || i === 2 ? "lg:col-span-2" : "lg:col-span-1";
              return (
                <div
                  key={f.title}
                  className={`${span} group relative rounded-[2rem] border border-white bg-white shadow-[0_1px_2px_rgba(11,11,11,0.04)] hover:shadow-[0_16px_40px_rgba(11,11,11,0.2)] hover:-translate-y-1 hover:border-transparent p-8 flex flex-col overflow-hidden transition-all duration-300`}
                >
                  {/* Image background — revealed on hover */}
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-cover bg-center opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    style={{ backgroundImage: `url(${f.bgImage})` }}
                  />
                  {/* Dark overlay for legibility on hover */}
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-ink/55 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  />
                  <div className="relative">
                    <div className="grid place-items-center h-10 w-10 rounded-[10px] bg-deep/10 text-deep transition-colors duration-300 group-hover:bg-white/15 group-hover:text-white">
                      <f.icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-6 font-bold text-[18px] text-ink transition-colors duration-300 group-hover:text-white">
                      {f.title}
                    </h3>
                    <p className="mt-2 text-[15px] text-deep/70 leading-relaxed transition-colors duration-300 group-hover:text-white/85">
                      {f.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-24">
        <div className="max-w-2xl mb-12">
          <p className="text-[14px] font-medium text-deep/60">How it works</p>
          <h2 className="mt-4 font-bold text-4xl sm:text-5xl tracking-tight text-ink leading-[1]">
            From paste to{" "}
            <span className="font-serif-italic font-normal text-deep">
              first ticket<span className="text-deep/40">.</span>
            </span>
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="relative rounded-[2rem] border border-mist bg-white shadow-[0_1px_2px_rgba(11,11,11,0.04)] p-8 overflow-hidden"
            >
              <span
                aria-hidden
                className="absolute top-3 right-6 font-serif-italic text-7xl text-mist select-none pointer-events-none"
              >
                {s.n}
              </span>
              <div className="grid place-items-center h-10 w-10 rounded-[10px] bg-mist/40 border border-mist text-deep">
                <s.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-6 font-bold text-ink text-[18px]">{s.title}</h3>
              <p className="mt-2 text-[15px] text-deep/70 leading-relaxed">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* PRODUCT SHOWCASE */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-24">
        <div className="w-full max-w-7xl mx-auto">
          <div className="bg-deep rounded-[48px] border border-deep shadow-sm overflow-hidden">
            <div className="bg-mist bg-dotted rounded-[40px] m-2 shadow-sm">
              <div className="p-8 md:p-10 lg:p-12">
                <div className="max-w-2xl mx-auto text-center mb-10">
                  <p className="text-[14px] font-medium text-deep/60">
                    Showcase
                  </p>
                  <h2 className="mt-4 font-bold text-4xl sm:text-5xl tracking-tight text-ink leading-[1]">
                    One inbox.{" "}
                    <span className="font-serif-italic font-normal text-deep">
                      Every platform<span className="text-deep/40">.</span>
                    </span>
                  </h2>
                </div>
                <div className="grid lg:grid-cols-[1.6fr_1fr] gap-6 lg:gap-10 items-center">
                  <InboxMockup />
                  <div className="justify-self-center">
                    <PhoneMockup />
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom strip in deep blue */}
            <div className="px-6 sm:px-12 md:px-16 lg:px-20 py-5 flex flex-col md:flex-row justify-between items-center gap-6 text-[15px]">
              <p className="text-white/70 font-medium">
                One backend. Every platform.
              </p>
              <a
                href="#features"
                className="inline-flex items-center gap-2 text-white font-medium hover:text-mist transition-colors"
              >
                See all features
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="w-full bg-mist py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-2xl mb-12">
            <p className="text-[14px] font-medium text-deep/60">Pricing</p>
            <h2 className="mt-4 font-bold text-4xl sm:text-5xl tracking-tight text-ink leading-[1]">
              Two plans
              <span className="font-serif-italic font-normal text-deep">
                , no surprises<span className="text-deep/40">.</span>
              </span>
            </h2>
            <p className="mt-4 text-deep/70 leading-relaxed text-[16px] font-normal">
              Start free. Upgrade when you need it. Cancel anytime.
            </p>
          </div>
          <div className="grid md:grid-cols-[1fr_2fr] gap-4 max-w-7xl mx-auto">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={`rounded-[2rem] border p-8 flex flex-col ${
                  p.featured
                    ? "border-ink bg-ink text-white shadow-[0_12px_32px_rgba(11,11,11,0.18)]"
                    : "border-mist bg-white shadow-[0_1px_2px_rgba(11,11,11,0.04)]"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <h3
                    className={`font-serif-italic font-normal text-4xl sm:text-5xl tracking-tight leading-none ${
                      p.featured ? "text-white" : "text-deep"
                    }`}
                  >
                    {p.name}
                  </h3>
                  {p.featured && (
                    <span className="shrink-0 text-xs font-bold rounded-full bg-white text-ink px-2.5 py-0.5 mt-1">
                      Most popular
                    </span>
                  )}
                </div>
                <div className="mt-8 flex items-baseline gap-1">
                  <span
                    className={`text-5xl font-bold tracking-tight ${
                      p.featured ? "text-white" : "text-ink"
                    }`}
                  >
                    {p.price}
                  </span>
                  {p.period && (
                    <span
                      className={p.featured ? "text-white/60" : "text-deep/60"}
                    >
                      / {p.period}
                    </span>
                  )}
                </div>
                <p
                  className={`mt-2 text-sm ${
                    p.featured ? "text-white/70" : "text-deep/70"
                  }`}
                >
                  {p.tagline}
                </p>
                <ul className="mt-8 space-y-3 text-sm flex-1">
                  {p.features.map((line) => (
                    <li key={line} className="flex items-start gap-2.5">
                      <Check
                        className={`h-4 w-4 mt-0.5 shrink-0 ${
                          p.featured ? "text-white" : "text-deep"
                        }`}
                      />
                      <span
                        className={p.featured ? "text-white/90" : "text-deep"}
                      >
                        {line}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`mt-8 self-end inline-flex items-center gap-2 rounded-full pl-5 pr-2 py-1.5 text-sm font-bold transition-colors w-fit ${
                    p.featured
                      ? "bg-white text-ink hover:bg-mist"
                      : "bg-ink text-white hover:bg-deep"
                  }`}
                >
                  {p.cta}
                  <span
                    className={`grid place-items-center h-9 w-9 rounded-full ${
                      p.featured ? "bg-ink text-white" : "bg-white text-ink"
                    }`}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="w-full bg-deep py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-2xl mb-12">
            <p className="text-[14px] font-medium text-white/60">
              Testimonials
            </p>
            <h2 className="mt-4 font-bold text-4xl sm:text-5xl tracking-tight text-white leading-[1]">
              Devs who shipped support{" "}
              <span className="font-serif-italic font-normal text-mist">
                in an afternoon<span className="text-white/40">.</span>
              </span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className="rounded-2xl border border-white/10 bg-white shadow-[0_8px_24px_rgba(11,11,11,0.12)] p-6 flex flex-col"
              >
                <Quote className="h-6 w-6 text-deep/30" />
                <p className="mt-4 text-deep leading-relaxed text-sm">
                  {t.quote}
                </p>
                <div className="mt-6 flex items-center gap-3 pt-4 border-t border-mist">
                  <div
                    aria-hidden
                    className="grid place-items-center h-10 w-10 rounded-full bg-ink text-white text-xs font-bold"
                  >
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-ink">{t.name}</p>
                    <p className="text-xs text-deep/60">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-24">
        <div className="w-full max-w-7xl mx-auto">
          <div className="bg-mist rounded-[48px] border border-mist shadow-sm overflow-hidden">
            <div className="bg-white rounded-[40px] m-2 shadow-sm">
              <div className="p-8 md:p-10 lg:p-12 grid grid-cols-1 lg:grid-cols-5 gap-12">
                {/* Heading column */}
                <div className="lg:col-span-2 space-y-6">
                  <p className="text-[14px] font-medium text-deep/60">FAQ</p>
                  <h2 className="font-bold text-4xl sm:text-5xl tracking-tight text-ink leading-[1]">
                    Questions{" "}
                    <span className="font-serif-italic font-normal text-deep">
                      answered<span className="text-deep/40">.</span>
                    </span>
                  </h2>
                  <p className="text-deep/70 leading-relaxed text-[16px] font-normal max-w-[320px]">
                    Everything you need to know about TinyChat. Can&apos;t find
                    what you&apos;re looking for? Drop us a line.
                  </p>
                </div>

                {/* Accordion column */}
                <div className="lg:col-span-3">
                  {FAQS.map((f, i) => (
                    <details
                      key={f.q}
                      className={`group ${
                        i !== 0 ? "border-t border-mist" : ""
                      }`}
                    >
                      <summary className="flex items-center justify-between gap-6 cursor-pointer list-none py-5">
                        <span className="text-[16px] font-medium text-ink pr-4">
                          {f.q}
                        </span>
                        <span className="grid place-items-center h-9 w-9 rounded-full border border-mist bg-white shadow-[0_1px_2px_rgba(11,11,11,0.05)] transition-all group-open:bg-ink group-open:border-ink shrink-0">
                          <ChevronDown className="h-4 w-4 text-deep group-open:text-white group-open:rotate-180 transition-transform" />
                        </span>
                      </summary>
                      <p className="pb-5 -mt-1 text-deep/70 leading-relaxed text-[15px] font-normal max-w-[520px]">
                        {f.a}
                      </p>
                    </details>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom strip in mist (matches footer legal bar) */}
            <div className="px-6 sm:px-12 md:px-16 lg:px-20 py-5 flex flex-col md:flex-row justify-between items-center gap-6 text-[15px]">
              <p className="text-deep/70 font-medium">Still have questions?</p>
              <a
                href="#"
                className="inline-flex items-center gap-2 text-deep font-medium hover:text-ink transition-colors"
              >
                Contact support
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-24">
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
            <h2 className="mt-4 font-bold text-4xl sm:text-6xl tracking-tight leading-[1]">
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
                className="inline-flex items-center gap-2 rounded-full bg-white text-ink px-6 py-3 text-sm font-bold hover:bg-mist transition-colors"
              >
                Start free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#install"
                className="inline-flex items-center gap-2 rounded-full border border-white/30 text-white px-6 py-3 text-sm font-bold hover:bg-white/10 transition-colors"
              >
                Read the docs
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <Footer />
    </main>
  );
}

/* ---------------- mockup components ---------------- */

function InboxMockup() {
  return (
    <div className="rounded-2xl bg-white shadow-xl border border-zinc-200 overflow-hidden">
      {/* window chrome */}
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-zinc-100">
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
        <span className="ml-3 text-xs text-zinc-400 font-mono">tinychat.app/inbox</span>
      </div>
      <div className="grid grid-cols-[200px_1fr] sm:grid-cols-[240px_1fr] min-h-[320px]">
        {/* conv list */}
        <div className="border-r border-zinc-100 bg-zinc-50/60">
          <div className="px-4 py-3 border-b border-zinc-100 flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-xs text-zinc-400">Search</span>
          </div>
          <ul>
            {INBOX_ROWS.map((row, i) => (
              <li
                key={row.name}
                className={`flex items-start gap-3 px-4 py-3 border-b border-zinc-100 ${
                  i === 0 ? "bg-white" : ""
                }`}
              >
                <div
                  aria-hidden
                  className="shrink-0 grid place-items-center h-8 w-8 rounded-full bg-ink text-white text-[10px] font-bold"
                >
                  {row.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-ink truncate">
                      {row.name}
                    </p>
                    <span className="text-[10px] text-zinc-400 shrink-0">
                      {row.time}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 truncate mt-0.5">
                    {row.snippet}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        {/* thread */}
        <div className="flex flex-col">
          <div className="px-5 py-3 border-b border-zinc-100 flex items-center gap-3">
            <div
              aria-hidden
              className="grid place-items-center h-7 w-7 rounded-full bg-ink text-white text-[10px] font-bold"
            >
              AM
            </div>
            <div>
              <p className="text-xs font-bold text-ink">Ali Mansoor</p>
              <p className="text-[10px] text-zinc-400">Order #4821 · Active now</p>
            </div>
          </div>
          <div className="flex-1 px-5 py-5 space-y-3 bg-white">
            <div className="flex justify-start">
              <p className="max-w-[80%] rounded-2xl rounded-tl-md bg-mist px-3 py-2 text-xs text-zinc-800">
                Hey, my order is showing delivered but I never got it.
              </p>
            </div>
            <div className="flex justify-start">
              <p className="max-w-[80%] rounded-2xl rounded-tl-md bg-mist px-3 py-2 text-xs text-zinc-800">
                The driver said they left it at the door.
              </p>
            </div>
            <div className="flex justify-end">
              <p className="max-w-[80%] rounded-2xl rounded-tr-md bg-ink text-white px-3 py-2 text-xs">
                Looking into it now — sending you a refund within 5 min.
              </p>
            </div>
          </div>
          <div className="px-4 py-3 border-t border-zinc-100 flex items-center gap-2">
            <Paperclip className="h-3.5 w-3.5 text-zinc-400" />
            <div className="flex-1 rounded-lg bg-zinc-50 border border-zinc-100 px-3 py-1.5 text-xs text-zinc-400">
              Reply…
            </div>
            <button
              aria-hidden
              className="grid place-items-center h-7 w-7 rounded-md bg-ink text-white"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhoneMockup() {
  return (
    <div className="relative rounded-[2.25rem] border-[10px] border-ink bg-zinc-50 w-[240px] h-[480px] shadow-xl overflow-hidden">
      {/* notch */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 h-5 w-20 rounded-full bg-ink z-10" />
      {/* app content placeholder */}
      <div className="absolute inset-0 p-3 pt-10 flex flex-col gap-2">
        <div className="h-3 w-2/3 rounded-full bg-zinc-200" />
        <div className="h-20 rounded-xl bg-zinc-200/60" />
        <div className="h-3 w-1/2 rounded-full bg-zinc-200" />
        <div className="grid grid-cols-2 gap-2 mt-1">
          <div className="h-14 rounded-lg bg-zinc-200/60" />
          <div className="h-14 rounded-lg bg-zinc-200/60" />
        </div>
        <div className="h-3 w-1/3 rounded-full bg-zinc-200" />
        <div className="h-28 rounded-xl bg-zinc-200/60" />
      </div>
      {/* widget bubble */}
      <div className="absolute bottom-4 right-3 grid place-items-center h-12 w-12 rounded-full bg-ink text-white shadow-lg z-10">
        <MessageSquare className="h-5 w-5" />
        <span className="absolute -top-1 -right-1 grid place-items-center h-4 w-4 rounded-full bg-white text-ink text-[9px] font-bold border-2 border-ink">
          2
        </span>
      </div>
      {/* widget panel preview */}
      <div className="absolute bottom-20 right-3 left-3 rounded-2xl bg-white border border-zinc-200 shadow-xl p-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="grid place-items-center h-6 w-6 rounded-full bg-ink text-white">
            <Smile className="h-3 w-3" />
          </div>
          <p className="text-[10px] font-bold text-ink">Support</p>
        </div>
        <p className="rounded-lg bg-mist px-2 py-1.5 text-[10px] text-zinc-800 leading-snug">
          Hey! Anything I can help with?
        </p>
      </div>
    </div>
  );
}

/* ---------------- data ---------------- */

const INSTALL_TABS = [
  {
    label: "Next.js",
    lang: "tsx",
    code: `// app/layout.tsx
import { TinyChat } from "@tinychat/react";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <TinyChat apiKey={process.env.NEXT_PUBLIC_TINYCHAT_KEY} />
      </body>
    </html>
  );
}`,
  },
  {
    label: "React Native",
    lang: "tsx",
    code: `// App.tsx
import { TinyChatProvider } from "@tinychat/react-native";

export default function App() {
  return (
    <TinyChatProvider apiKey={process.env.EXPO_PUBLIC_TINYCHAT_KEY}>
      <RootNavigator />
    </TinyChatProvider>
  );
}`,
  },
  {
    label: "iOS Swift",
    lang: "swift",
    code: `// AppDelegate.swift
import TinyChat

@main
struct MyApp: App {
  init() {
    TinyChat.configure(apiKey: Env.tinychatKey)
  }
  var body: some Scene {
    WindowGroup { ContentView() }
  }
}`,
  },
];

const FEATURES = [
  {
    icon: MessageSquare,
    title: "Order chat",
    body: "Customer ↔ driver group chat per order. Real-time, with typing and read receipts.",
    bgImage: "/hero-art.avif",
  },
  {
    icon: ShieldCheck,
    title: "Support inbox",
    body: "1:1 chat between users and your admins. Email fallback when nobody's online.",
    bgImage: "/hero-art.avif",
  },
  {
    icon: Webhook,
    title: "Webhook + email",
    body: "Push events come through your webhook so you keep control of FCM. Email is on us.",
    bgImage: "/hero-art.avif",
  },
  {
    icon: Globe,
    title: "Web + iOS + Android",
    body: "Drop-in widgets for Next.js, React Native, and Expo. One backend.",
    bgImage: "/hero-art.avif",
  },
];

const STEPS = [
  {
    n: "01",
    icon: Webhook,
    title: "Install the SDK",
    body: "One package for web, one for React Native. No backend setup, no migrations to run.",
  },
  {
    n: "02",
    icon: ShieldCheck,
    title: "Drop in your API key",
    body: "One env var, then mount the widget. It appears on every platform automatically.",
  },
  {
    n: "03",
    icon: MessageSquare,
    title: "Reply from one inbox",
    body: "Use our dashboard or embed it inside your existing admin. Email fallback when nobody is online.",
  },
];

const INBOX_ROWS = [
  { name: "Ali Mansoor", initials: "AM", snippet: "Order showing delivered but…", time: "2m" },
  { name: "Priya Shah", initials: "PS", snippet: "Can I change my address?", time: "12m" },
  { name: "Marcus Reed", initials: "MR", snippet: "Driver hasn't moved in 20…", time: "1h" },
  { name: "Lina Park", initials: "LP", snippet: "Refund request — thanks!", time: "3h" },
];

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "month",
    tagline: "For testing and personal projects.",
    features: [
      "1,000 conversations / month",
      "1 workspace",
      "Email + webhook events",
      "Community support",
    ],
    cta: "Start free",
    featured: false,
  },
  {
    name: "Enterprise",
    price: "$50",
    period: "month",
    tagline: "Everything your team needs to ship.",
    features: [
      "Unlimited conversations",
      "Custom branding + domain",
      "SSO + SCIM",
      "SLA-backed uptime",
      "Priority support",
    ],
    cta: "Get Enterprise",
    featured: true,
  },
];

// placeholder copy — swap with real quotes when collected
const TESTIMONIALS = [
  {
    initials: "MK",
    name: "Maya Kowalski",
    role: "Engineer at GoDelivery",
    quote:
      "We replaced a half-built Zendesk integration with TinyChat in one afternoon. Our drivers and customers talk through it now and we never touched the backend.",
  },
  {
    initials: "DR",
    name: "Dev Rao",
    role: "Founder, Curbside",
    quote:
      "The React Native package is the cleanest support SDK I've ever shipped. Three props and it just works on iOS and Android.",
  },
  {
    initials: "SH",
    name: "Sofia Hernandez",
    role: "CTO at LocalEats",
    quote:
      "We embed their inbox inside our existing admin via the JWT iframe. Our ops team didn't have to learn a new tool.",
  },
];

const FAQS = [
  {
    q: "How does the pricing work?",
    a: "You pay per active conversation, not per agent seat. A conversation is a single thread that stays open for up to 24 hours of inactivity. Unused conversations don't roll over.",
  },
  {
    q: "Where is the data stored?",
    a: "All messages and attachments are stored in EU-hosted Supabase Postgres + S3-compatible storage. We can move you to US infrastructure on Scale plans if you need it for compliance.",
  },
  {
    q: "Do you support SSO and SCIM?",
    a: "Yes — SAML SSO and SCIM provisioning are included on the Scale plan. Growth users can wire up Google OAuth for their team in settings.",
  },
  {
    q: "Can I self-host?",
    a: "Not today. The backend is closed-source and tightly coupled to our managed infrastructure (Supabase + push services). If self-hosting is a hard requirement, let us know — we're tracking demand.",
  },
  {
    q: "How customizable is the widget?",
    a: "Colors, copy, and the icon are all configurable through props. For deeper customization we expose React primitives so you can rebuild the UI entirely while keeping our transport layer.",
  },
  {
    q: "What's your support SLA?",
    a: "Community support on Starter, priority email on Growth (under 24h), and SLA-backed uptime + same-business-day response on Scale.",
  },
];

