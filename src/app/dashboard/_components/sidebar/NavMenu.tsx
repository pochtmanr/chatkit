"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  BookOpen,
  Building2,
  ChevronDown,
  CreditCard,
  Headphones,
  Inbox as InboxIcon,
  Key,
  KeyRound,
  ListChecks,
  Palette,
  Settings,
  ShieldAlert,
  Users,
  Webhook,
  type LucideIcon,
} from "lucide-react";
import { isActiveRoute, navItemClasses } from "./nav-item-classes";
import { WorkbenchBadge } from "./WorkbenchBadge";

type Role = "owner" | "manager" | "agent";

type NavChild = { href: string; label: string; icon: LucideIcon; roles?: Role[] };
type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  children?: NavChild[];
  roles?: Role[];
};

// `roles` omitted ⇒ all roles see the item. Role filtering at render
// time is presentational only — the middleware enforces the real gate.
const NAV: NavItem[] = [
  { href: "/dashboard", label: "Usage", icon: BarChart3, roles: ["owner", "manager"] },
  { href: "/dashboard/inbox", label: "Inbox", icon: InboxIcon },
  { href: "/workbench", label: "Workbench", icon: Headphones },
  { href: "/dashboard/team", label: "Team", icon: Users, roles: ["owner", "manager"] },
  { href: "/dashboard/webhooks", label: "Webhooks", icon: Webhook, roles: ["owner"] },
  { href: "/dashboard/docs", label: "Docs", icon: BookOpen },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: Settings,
    children: [
      { href: "/dashboard/settings/business", label: "Business", icon: Building2, roles: ["owner"] },
      { href: "/dashboard/settings/billing", label: "Billing", icon: CreditCard, roles: ["owner"] },
      { href: "/dashboard/settings/api-keys", label: "API keys", icon: Key, roles: ["owner"] },
      { href: "/dashboard/settings/mcp", label: "MCP", icon: KeyRound, roles: ["owner"] },
      { href: "/dashboard/settings/start-options", label: "Start options", icon: ListChecks, roles: ["owner"] },
      { href: "/dashboard/settings/widget-appearance", label: "Widget appearance", icon: Palette, roles: ["owner"] },
      { href: "/dashboard/settings/team", label: "Team", icon: Users, roles: ["owner", "manager"] },
      { href: "/dashboard/settings/statistics", label: "Statistics", icon: BarChart3, roles: ["owner"] },
      { href: "/dashboard/settings/account", label: "Account", icon: ShieldAlert },
    ],
  },
];

function visible(role: Role, item: { roles?: Role[] }): boolean {
  return !item.roles || item.roles.includes(role);
}

export function NavMenu({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = NAV.filter((item) => visible(role, item))
    .map((item) =>
      item.children
        ? { ...item, children: item.children.filter((c) => visible(role, c)) }
        : item,
    )
    .filter((item) => !item.children || item.children.length > 0);
  const onSettingsRoute = pathname?.startsWith("/dashboard/settings") ?? false;
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const settingsExpanded = manualOpen ?? onSettingsRoute;

  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {items.map((item) => {
        if (item.children) {
          return (
            <div key={item.href}>
              <button
                type="button"
                aria-expanded={settingsExpanded}
                aria-controls="settings-submenu"
                onClick={() => setManualOpen(!settingsExpanded)}
                className={`${navItemClasses(false, {
                  sectionActive: onSettingsRoute,
                })} w-full`}
              >
                <item.icon className="h-4 w-4" />
                <span className="flex-1 text-left">{item.label}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${
                    settingsExpanded ? "rotate-180" : ""
                  }`}
                />
              </button>
              {settingsExpanded && (
                <ul
                  id="settings-submenu"
                  role="group"
                  className="mt-0.5 mb-1 ml-3 border-l border-mist/60 pl-3 space-y-0.5"
                >
                  {item.children.map((child) => {
                    const active = isActiveRoute(pathname, child.href);
                    return (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          aria-current={active ? "page" : undefined}
                          className={navItemClasses(active)}
                        >
                          <child.icon className="h-4 w-4" />
                          {child.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        }

        const active = isActiveRoute(pathname, item.href);
        const isWorkbench = item.href === "/workbench";
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            target={isWorkbench ? "_blank" : undefined}
            rel={isWorkbench ? "noopener noreferrer" : undefined}
            className={navItemClasses(active)}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
            {isWorkbench && <WorkbenchBadge initial={0} />}
          </Link>
        );
      })}
    </nav>
  );
}
