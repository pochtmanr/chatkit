import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, BarChart3, Key, Webhook, HelpCircle, Link2, Settings } from "lucide-react";
import { getServerClient } from "@/lib/supabase/server";
import { logoutAction } from "../(auth)/actions";

const NAV = [
  { href: "/dashboard", label: "Usage", icon: BarChart3 },
  { href: "/dashboard/api-keys", label: "API keys", icon: Key },
  { href: "/dashboard/webhooks", label: "Webhooks", icon: Webhook },
  { href: "/dashboard/faq", label: "FAQ", icon: HelpCircle },
  { href: "/dashboard/quick-links", label: "Quick links", icon: Link2 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Pick the user's first tenant to show in the sidebar header. Multi-tenant
  // selector lands in v0.2 — for now everyone has exactly one tenant.
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name, slug, plan")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);
  const tenant = tenants?.[0];

  return (
    <div className="min-h-dvh grid grid-cols-[240px_1fr] bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <aside className="border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col">
        <Link href="/dashboard" className="px-5 h-14 flex items-center font-semibold tracking-tight">
          TinyChat
        </Link>

        {tenant && (
          <div className="px-5 py-3 border-y border-zinc-200 dark:border-zinc-800">
            <div className="text-sm font-medium truncate">{tenant.name}</div>
            <div className="text-xs text-zinc-500 capitalize mt-0.5">{tenant.plan} plan</div>
          </div>
        )}

        <nav className="flex-1 p-2 flex flex-col gap-0.5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <form action={logoutAction} className="p-2 border-t border-zinc-200 dark:border-zinc-800">
          <button
            type="submit"
            className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>

        <div className="px-5 py-3 text-xs text-zinc-500 truncate border-t border-zinc-200 dark:border-zinc-800">
          {user.email}
        </div>
      </aside>

      <main className="overflow-auto">
        <div className="mx-auto max-w-5xl p-8">{children}</div>
      </main>
    </div>
  );
}
