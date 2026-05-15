import Link from "next/link";
import { MessageSquare } from "lucide-react";
import type { SVGProps } from "react";

function LogoIcon() {
  return (
    <span className="grid place-items-center h-8 w-8 rounded-[8px] bg-ink text-white">
      <MessageSquare className="h-4 w-4" />
    </span>
  );
}

function TwitterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

function GithubIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.95.1-.74.4-1.25.73-1.54-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 2.9-.39c.98 0 1.97.13 2.9.39 2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.41-5.26 5.69.41.36.78 1.06.78 2.15v3.19c0 .31.21.67.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

function DiscordIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.249a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.036A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.927 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.128 12.3 12.3 0 0 1-1.873.891.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.028ZM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z" />
    </svg>
  );
}

const SOCIALS = [
  { label: "Twitter", Icon: TwitterIcon, href: "#" },
  { label: "GitHub", Icon: GithubIcon, href: "#" },
  { label: "Discord", Icon: DiscordIcon, href: "#" },
];

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#pricing" },
      { label: "Changelog", href: "#" },
      { label: "Status", href: "#" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Docs", href: "#install" },
      { label: "API reference", href: "#" },
      { label: "SDKs", href: "#" },
      { label: "npm package", href: "#" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Customers", href: "#" },
      { label: "Contact", href: "#" },
    ],
  },
];

function FooterCard() {
  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="bg-mist rounded-[48px] border border-mist shadow-sm overflow-hidden">
        <div className="bg-white rounded-[40px] m-2 shadow-sm">
          <div className="p-8 md:p-10 lg:p-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
            {/* Brand */}
            <div className="lg:col-span-2 space-y-8">
              <Link href="/" className="flex items-center gap-2.5 w-fit">
                <LogoIcon />
                <span className="text-[26px] font-bold tracking-tight text-ink">
                  TinyChat
                </span>
              </Link>

              <p className="text-deep/70 leading-relaxed text-[16px] font-normal max-w-[320px]">
                Drop-in chat support for React Native and web. Paste, ship,
                reply.
              </p>

              <div className="flex items-center gap-3">
                {SOCIALS.map(({ label, Icon, href }) => (
                  <a
                    key={label}
                    href={href}
                    aria-label={label}
                    className="w-[44px] h-[44px] flex items-center justify-center rounded-xl border border-mist bg-white shadow-[0_1px_2px_rgba(11,11,11,0.05)] hover:bg-mist/40 hover:border-deep/20 transition-all active:scale-95 group"
                  >
                    <Icon className="w-5 h-5 text-ink group-hover:text-deep transition-colors" />
                  </a>
                ))}
              </div>
            </div>

            {/* Link columns */}
            {COLUMNS.map((col) => (
              <div key={col.title} className="space-y-6">
                <h4 className="text-[14px] font-medium text-deep/60">
                  {col.title}
                </h4>
                <ul className="space-y-4">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-[15px] font-medium text-deep hover:text-ink transition-colors"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom legal bar (inside outer mist, outside white box) */}
        <div className="px-6 sm:px-12 md:px-16 lg:px-20 py-5 flex flex-col md:flex-row justify-between items-center gap-6 text-[15px]">
          <p className="text-deep/70 font-medium">
            © {new Date().getFullYear()} TinyChat. All rights reserved.
          </p>
          <div className="flex gap-8 text-deep/70 font-medium items-center">
            <a href="#" className="hover:text-ink transition-colors">
              Privacy
            </a>
            <div className="w-[1px] h-4 bg-deep/20" />
            <a href="#" className="hover:text-ink transition-colors">
              Terms
            </a>
            <div className="w-[1px] h-4 bg-deep/20" />
            <a href="#" className="hover:text-ink transition-colors">
              Status
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="w-full px-4 sm:px-6 pb-10 flex flex-col items-center">
      <FooterCard />
    </footer>
  );
}
