import Link from "next/link";
import { loadQueues, type LoadedQueues } from "./loadQueues";
import { QueueRailContent } from "./QueueRailContent";
import { WorkbenchPoller } from "./WorkbenchPoller";
import type { Inbox } from "@/lib/inboxes";

type Props = {
  businessId: string;
  userId: string;
  inboxes: Inbox[];
  managerView: boolean;
};

export async function QueueRail(props: Props) {
  const data: LoadedQueues = await loadQueues(props);

  return (
    <aside
      aria-label="Workbench queue"
      className="w-[320px] shrink-0 border-r border-mist bg-white flex flex-col h-full overflow-hidden"
    >
      <QueueRailContent data={data} managerView={props.managerView} />

      <div className="border-t border-mist px-4 py-2 text-[11px] text-deep/50 flex items-center justify-between">
        <Link href="/workbench" className="hover:text-ink transition-colors">
          Refresh
        </Link>
        <span className="text-deep/40">Auto · 10s</span>
      </div>

      {/* No business-scoped Realtime channel yet (shared §9 / realtime.ts
       *  only carries conv:<id>). Until that lands, 10s polling keeps the
       *  rail in sync with assignment changes and new conversations. */}
      <WorkbenchPoller intervalMs={10000} />
    </aside>
  );
}
