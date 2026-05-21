import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  CircleHelp,
  Mail,
  Terminal,
  type LucideIcon,
} from "lucide-react";

type Card = {
  icon: LucideIcon;
  title: string;
  body: string;
  href: string;
  external?: boolean;
};

const CARDS: Card[] = [
  {
    icon: Terminal,
    title: "API reference",
    body: "Every endpoint with request and response.",
    href: "/api-reference",
  },
  {
    icon: BookOpen,
    title: "SDK reference",
    body: "Install, initialize, identify, open.",
    href: "/sdk",
  },
  {
    icon: CircleHelp,
    title: "FAQ",
    body: "Pricing, data residency, SSO, self-hosting.",
    href: "/#faq",
  },
  {
    icon: Mail,
    title: "Email us",
    body: "Reply within 24h on weekdays.",
    href: "mailto:support@chatkit.cc",
    external: true,
  },
];

export function HelpGrid() {
  return (
    <section className="w-full bg-white py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CARDS.map((card) => {
            const Inner = (
              <div className="group relative h-full rounded-[2rem] bg-white border border-mist shadow-[0_1px_2px_rgba(11,11,11,0.04)] hover:shadow-[0_16px_40px_rgba(11,11,11,0.2)] p-8 flex flex-col overflow-hidden transition-shadow duration-300">
                <div className="grid place-items-center h-10 w-10 rounded-[10px] bg-deep/10 text-deep transition-colors duration-500 ease-out group-hover:bg-mist group-hover:text-deep group-hover:shadow-sm">
                  <card.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-6 text-[18px] text-ink">{card.title}</h3>
                <p className="mt-2 text-[15px] text-deep/70 leading-relaxed">
                  {card.body}
                </p>
                <span className="mt-auto self-end -mr-4 -mb-4 inline-flex items-center gap-2 rounded-full bg-ink text-white pl-5 pr-2 py-2 text-[15px] shadow-lg shadow-ink/10 group-hover:bg-deep transition-colors">
                  Open
                  <span className="grid place-items-center h-7 w-7 rounded-full bg-white text-ink transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </span>
              </div>
            );

            return card.external ? (
              <a key={card.title} href={card.href}>
                {Inner}
              </a>
            ) : (
              <Link key={card.title} href={card.href}>
                {Inner}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
