import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

export default function Pricing() {
  return (
    <section id="pricing" className="w-full bg-mist py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-2xl mb-12">
          <p className="text-[14px] font-medium text-deep/60">Pricing</p>
          <h2 className="mt-4 text-4xl sm:text-5xl tracking-tight text-ink leading-[1] font-normal">
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
                  className={`font-serif-italic text-4xl sm:text-5xl tracking-tight leading-none ${
                    p.featured ? "text-white" : "text-deep"
                  }`}
                >
                  {p.name}
                </h3>
                {p.featured && (
                  <span className="shrink-0 text-xs rounded-full bg-white text-ink px-2.5 py-0.5 mt-1">
                    Most popular
                  </span>
                )}
              </div>
              <div className="mt-8 flex items-baseline gap-1">
                <span
                  className={`text-5xl tracking-tight ${
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
                className={`mt-8 self-end inline-flex items-center gap-2 rounded-full pl-5 pr-2 py-1.5 text-sm transition-colors w-fit ${
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
  );
}

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
