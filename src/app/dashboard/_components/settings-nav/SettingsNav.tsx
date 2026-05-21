"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  CreditCard,
  KeyRound,
  ShieldAlert,
  Users,
} from "lucide-react";

const items = [
  { href: "/dashboard/settings/business", label: "Business", icon: Building2 },
  { href: "/dashboard/settings/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/settings/mcp", label: "MCP", icon: KeyRound },
  { href: "/dashboard/settings/team", label: "Team", icon: Users },
  {
    href: "/dashboard/settings/statistics",
    label: "Statistics",
    icon: BarChart3,
  },
  {
    href: "/dashboard/settings/account",
    label: "Account",
    icon: ShieldAlert,
  },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="space-y-0.5">
      {items.map((item) => {
        const active = pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              (active
                ? "bg-ink text-white"
                : "text-ink/80 hover:bg-mist/50 hover:text-ink") +
              " flex items-center gap-2.5 rounded-xl px-3 py-2 text-[14px] transition-colors"
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
