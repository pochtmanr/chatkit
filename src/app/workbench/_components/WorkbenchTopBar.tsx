import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { getServiceClient } from "@/lib/supabase/server";
import { formatRoleLabel } from "@/lib/team";
import type { Business } from "@/lib/businesses";
import type { Inbox } from "@/lib/inboxes";
import type { WorkbenchRole } from "@/lib/workbench-context";
import { getOwnStatus } from "../_actions/presence";
import { AgentHubButton } from "./AgentHubButton";
import { AgentPresenceHeartbeat } from "./AgentPresenceHeartbeat";
import { ManagerViewToggle } from "./ManagerViewToggle";

const INBOX_COOKIE = "chatkit_active_inbox";

type Props = {
  business: Business;
  businesses: Business[];
  inboxes: Inbox[];
  role: WorkbenchRole;
  hasAgentRow: boolean;
  agentId: string | null;
  managerView: boolean;
  userEmail: string;
};

export async function WorkbenchTopBar({
  business,
  businesses,
  inboxes,
  role,
  hasAgentRow,
  agentId,
  managerView,
  userEmail,
}: Props) {
  // Status toggle is only meaningful for users with an agent row in the
  // active business. Admins without a row never see the status surface.
  const ownStatus = hasAgentRow
    ? await getOwnStatus()
    : { status: "offline" as const, agentId: null };

  // Pull the caller's display name + avatar from their own support_agents
  // row when they have one. Admins without an agent row fall back to
  // their email.
  let displayName = userEmail;
  let avatarUrl: string | null = null;
  let skills: string[] = [];
  if (agentId) {
    const admin = getServiceClient();
    const { data } = await admin
      .from("support_agents")
      .select("display_name, avatar_url, skills")
      .eq("id", agentId)
      .maybeSingle();
    if (data) {
      displayName = data.display_name;
      avatarUrl = data.avatar_url;
      skills = Array.isArray(data.skills) ? data.skills : [];
    }
  }

  const roleLabel = formatRoleLabel(role) as "Admin" | "Manager" | "Agent";
  const cookieStore = await cookies();
  const activeInboxId =
    cookieStore.get(INBOX_COOKIE)?.value ??
    inboxes[0]?.id ??
    null;

  return (
    <header
      role="banner"
      className="h-14 shrink-0 bg-white text-ink flex items-center gap-3 px-4 sm:px-6 border-b border-mist"
    >
      <Link
        href="/workbench"
        aria-label="ChatKit Workbench"
        className="flex items-center gap-2 pl-1 pr-3 h-10 rounded-full hover:bg-mist/60 transition-colors"
      >
        <Image
          src="/chatkit.png"
          alt=""
          width={765}
          height={649}
          priority
          className="h-6 w-auto"
        />
        <span className="font-medium text-[15px] tracking-tight text-ink">
          ChatKit
        </span>
        <span className="text-[14px] text-deep/60 font-normal">
          · Workbench
        </span>
      </Link>

      <div className="hidden md:flex items-center gap-2 ml-2 text-[12px] text-deep/60">
        <span className="h-1 w-1 rounded-full bg-deep/30" />
        <span className="truncate max-w-[180px]">{business.name}</span>
      </div>

      <div className="flex-1" />

      {role === "owner" && <ManagerViewToggle initial={managerView} />}

      <AgentHubButton
        displayName={displayName}
        email={userEmail}
        avatarUrl={avatarUrl}
        roleLabel={roleLabel}
        hasAgentRow={hasAgentRow}
        initialStatus={ownStatus.status}
        skills={skills}
        activeBusinessId={business.id}
        businesses={businesses.map((b) => ({
          id: b.id,
          name: b.name,
          logoUrl: b.logo_url,
          planLabel: `${b.plan} plan`,
        }))}
        activeInboxId={activeInboxId}
        inboxes={inboxes.map((i) => ({ id: i.id, name: i.name }))}
      />

      {hasAgentRow && (
        <AgentPresenceHeartbeat initialStatus={ownStatus.status} />
      )}
    </header>
  );
}
