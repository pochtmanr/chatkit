"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  KeyRound,
  LogOut,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";

type Entry = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

const ENTRIES: Entry[] = [
  {
    href: "/dashboard/docs/install",
    label: "Install on a website",
    description: "iframe + handshake (auth-only).",
    icon: BookOpen,
  },
  {
    href: "/dashboard/docs/tokens",
    label: "Mint a widget token",
    description: "JWT shape, TTL, allowed_kinds.",
    icon: KeyRound,
  },
  {
    href: "/dashboard/docs/sign-out",
    label: "Sign-out destroy",
    description: "Tear down the widget session.",
    icon: LogOut,
  },
  {
    href: "/dashboard/docs/security",
    label: "Security model",
    description: "Three credentials, four rules.",
    icon: ShieldAlert,
  },
];

export function DocsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Docs sections" className="space-y-1">
      {ENTRIES.map((e) => {
        const active = pathname?.startsWith(e.href) ?? false;
        return (
          <Link
            key={e.href}
            href={e.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-start gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-colors ${
              active
                ? "bg-white border border-mist text-ink"
                : "text-deep/70 hover:bg-white/60 hover:text-ink"
            }`}
          >
            <e.icon className="h-4 w-4 mt-0.5 shrink-0" />
            <span className="space-y-0.5">
              <span className="block font-medium leading-tight">{e.label}</span>
              <span className="block text-[11px] text-deep/50 leading-tight">
                {e.description}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
