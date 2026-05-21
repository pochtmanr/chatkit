"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Plus } from "lucide-react";
import { Dropdown, type DropdownItem } from "../ui/primitives";
import { setActiveInbox } from "../../_actions/active-context";
import type { ProjectGroup } from "@/lib/active-context";

export function InboxSwitcher({
  groups,
  activeId,
  businessName,
}: {
  groups: ProjectGroup[];
  activeId: string;
  businessName: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function pick(id: string) {
    if (id === activeId) return;
    startTransition(async () => {
      const res = await setActiveInbox(id);
      if (res.ok) router.refresh();
    });
  }

  const items: DropdownItem[] = groups.flatMap((g) =>
    g.inboxes.map((ib) => ({
      id: ib.id,
      label: ib.name,
      group: g.project.name,
    })),
  );

  const footer = (
    <Link
      href="/dashboard/inboxes/new"
      className="flex items-center gap-2 px-3.5 py-2 text-[14px] text-deep hover:text-ink transition-colors"
    >
      <Plus className="h-3.5 w-3.5" />
      Create inbox
    </Link>
  );

  return (
    <Dropdown
      label={`Active inbox for ${businessName}`}
      value={activeId}
      items={items}
      onChange={pick}
      footer={footer}
    />
  );
}
