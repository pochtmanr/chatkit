import Link from "next/link";
import { ArrowRight, Check, MessageSquare, Webhook, ShieldCheck, Globe } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="min-h-dvh bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="sticky top-0 z-10 backdrop-blur bg-white/70 dark:bg-zinc-950/70 border-b border-zinc-200/60 dark:border-zinc-800/60">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-semibold tracking-tight">
            HolyLabs <span className="text-zinc-400">·</span> Chat
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <a href="#features" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">Features</a>
            <a href="#pricing" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">Pricing</a>
            <Link href="/login" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">Sign in</Link>
            <Link href="/signup" className="rounded-lg bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white px-3 py-1.5 hover:opacity-90">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 pt-24 pb-16 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 dark:border-zinc-800 px-3 py-1 text-xs text-zinc-600 dark:text-zinc-400">
          v0.1 · Drop-in chat for delivery & marketplace apps
        </span>
        <h1 className="mt-6 text-5xl sm:text-6xl font-semibold tracking-tight leading-[1.05]">
          Add chat to your delivery app
          <br />
          <span className="text-zinc-400">in an afternoon.</span>
        </h1>
        <p className="mt-6 text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
          A floating widget for web and mobile. Order chats, support, FAQ, and
          email notifications — without spinning up your own backend.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white px-5 py-3 font-medium hover:opacity-90"
          >
            Start free <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#features"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-700 px-5 py-3 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            See features
          </a>
        </div>
        <p className="mt-4 text-sm text-zinc-500">
          1,000 conversations / month free · No credit card required
        </p>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6"
            >
              <f.icon className="h-5 w-5 text-zinc-500" />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-6 py-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-semibold tracking-tight">Pricing that scales with you</h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Pay per conversation, not per agent. Cancel anytime.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`rounded-2xl border p-6 flex flex-col ${
                p.featured
                  ? "border-zinc-900 dark:border-zinc-100"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <div className="flex items-baseline justify-between">
                <h3 className="font-semibold">{p.name}</h3>
                {p.featured && (
                  <span className="text-xs rounded-full bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white px-2 py-0.5">
                    Most popular
                  </span>
                )}
              </div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-semibold">{p.price}</span>
                {p.period && <span className="text-zinc-500">/ {p.period}</span>}
              </div>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{p.tagline}</p>
              <ul className="mt-6 space-y-2 text-sm">
                {p.features.map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={`mt-6 inline-flex items-center justify-center rounded-xl px-4 py-2 font-medium ${
                  p.featured
                    ? "bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white"
                    : "border border-zinc-300 dark:border-zinc-700"
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-6 py-10 text-sm text-zinc-500 border-t border-zinc-200/60 dark:border-zinc-800/60">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span>© {new Date().getFullYear()} HolyLabs</span>
          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-zinc-900 dark:hover:text-zinc-100">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-zinc-900 dark:hover:text-zinc-100">
              Get started
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

const FEATURES = [
  {
    icon: MessageSquare,
    title: "Order chat",
    body: "Customer ↔ driver group chat per order. Real-time, with typing and read receipts.",
  },
  {
    icon: ShieldCheck,
    title: "Support inbox",
    body: "1:1 chat between users and your admins. Email fallback when nobody's online.",
  },
  {
    icon: Webhook,
    title: "Webhook + email",
    body: "Push events come through your webhook so you keep control of FCM. Email is on us.",
  },
  {
    icon: Globe,
    title: "Web + iOS + Android",
    body: "Drop-in widgets for Next.js, React Native, and Expo. One backend.",
  },
];

const PLANS = [
  {
    name: "Starter",
    price: "$0",
    period: "month",
    tagline: "For testing and personal projects.",
    features: ["1,000 conversations / month", "1 workspace", "Email + webhook events", "Community support"],
    cta: "Start free",
    featured: false,
  },
  {
    name: "Growth",
    price: "$99",
    period: "month",
    tagline: "For businesses with regular volume.",
    features: [
      "10,000 conversations / month",
      "Custom branding",
      "Priority email support",
      "$0.03 per extra conversation",
    ],
    cta: "Start Growth",
    featured: true,
  },
  {
    name: "Scale",
    price: "$499",
    period: "month",
    tagline: "For high-volume marketplaces.",
    features: [
      "100,000 conversations / month",
      "SSO + SCIM",
      "SLA-backed uptime",
      "$0.01 per extra conversation",
    ],
    cta: "Talk to us",
    featured: false,
  },
];
