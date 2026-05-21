import { ArrowRight, ChevronDown } from "lucide-react";

export default function FAQ() {
  return (
    <section id="faq" className="scroll-mt-24 mx-auto max-w-7xl px-4 sm:px-6 py-24">
      <div className="w-full max-w-7xl mx-auto">
        <div className="bg-mist rounded-[48px] border border-mist shadow-sm overflow-hidden">
          <div className="bg-white rounded-[40px] m-2 shadow-sm">
            <div className="p-8 md:p-10 lg:p-12 grid grid-cols-1 lg:grid-cols-5 gap-12">
              {/* Heading column */}
              <div className="lg:col-span-2 space-y-6">
                <p className="text-[14px] font-medium text-deep/60">FAQ</p>
                <h2 className="text-4xl sm:text-5xl tracking-tight text-ink leading-[1] font-normal">
                  Questions{" "}
                  <span className="font-serif-italic font-normal text-deep">
                    answered<span className="text-deep/40">.</span>
                  </span>
                </h2>
                <p className="text-deep/70 leading-relaxed text-[16px] font-normal max-w-[320px]">
                  Everything you need to know about ChatKit. Can&apos;t find
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
  );
}

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
