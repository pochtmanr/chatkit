import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { checkOverage } from "@/lib/billing-banner";
import { Sidebar } from "./_components/sidebar/Sidebar";
import { OverageBanner } from "./_components/billing/OverageBanner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const businessId = cookieStore.get("chatkit_active_biz")?.value;
  const overage = businessId ? await checkOverage(businessId) : null;

  return (
    <div className="min-h-dvh grid grid-cols-[260px_1fr] bg-mist/40 text-ink">
      <Sidebar />
      <main className="overflow-auto">
        <div className="w-full px-6 md:px-10 lg:px-14 py-8 md:py-10 space-y-6">
          {overage && <OverageBanner info={overage} />}
          {children}
        </div>
      </main>
    </div>
  );
}
