import Link from "next/link";
import {
  LogOut,
  BarChart3,
  Key,
  Webhook,
  Settings,
  Inbox as InboxIcon,
} from "lucide-react";
import { getActiveContext } from "@/lib/active-context";
import { logoutAction } from "@/app/(auth)/actions";
import { BusinessSwitcher } from "./BusinessSwitcher";
import { InboxSwitcher } from "./InboxSwitcher";

const NAV = [
  { href: "/dashboard", label: "Usage", icon: BarChart3 },
  { href: "/dashboard/inbox", label: "Inbox", icon: InboxIcon },
  { href: "/dashboard/api-keys", label: "API keys", icon: Key },
  { href: "/dashboard/webhooks", label: "Webhooks", icon: Webhook },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export async function Sidebar() {
  const ctx = await getActiveContext();
  if (!ctx) return <SidebarSkeleton />;

  return (
    <aside className="flex flex-col gap-4 px-4 py-5 border-r border-mist bg-white">
      <Link
        href="/dashboard"
        className="px-2 h-10 flex items-center text-ink font-semibold tracking-tight"
      >
        ChatKit
      </Link>

      <div className="space-y-2">
        <BusinessSwitcher
          businesses={ctx.businesses}
          activeId={ctx.business.id}
          inboxCount={ctx.inboxes.length}
          planLabel={ctx.business.plan}
        />
        <InboxSwitcher
          groups={ctx.groups}
          activeId={ctx.inbox.id}
          businessName={ctx.business.name}
        />
      </div>

      <nav className="flex flex-col gap-0.5">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[14px] text-ink/80 hover:bg-mist/50 hover:text-ink transition-colors"
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="flex-1" />

      <form action={logoutAction}>
        <button
          type="submit"
          className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-[14px] text-deep/70 hover:bg-mist/50 hover:text-ink transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </form>

      <div className="px-3 text-[12px] text-deep/50 truncate">{ctx.user.email}</div>
    </aside>
  );
}

function SidebarSkeleton() {
  return (
    <aside className="flex flex-col px-4 py-5 border-r border-mist bg-white">
      <div className="px-2 h-10 flex items-center text-ink font-semibold tracking-tight">
        ChatKit
      </div>
    </aside>
  );
}
