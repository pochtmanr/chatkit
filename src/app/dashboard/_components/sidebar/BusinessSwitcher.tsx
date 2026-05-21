"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Plus } from "lucide-react";
import { Dropdown } from "../ui/primitives";
import { setActiveBusiness } from "../../_actions/active-context";
import type { Business } from "@/lib/businesses";

export function BusinessSwitcher({
  businesses,
  activeId,
  inboxCount,
  planLabel,
}: {
  businesses: Business[];
  activeId: string;
  inboxCount: number;
  planLabel: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function pick(id: string) {
    if (id === activeId) return;
    startTransition(async () => {
      const res = await setActiveBusiness(id);
      if (res.ok) router.refresh();
    });
  }

  const items = businesses.map((b) => ({
    id: b.id,
    label: b.name,
    sub: `${b.plan} plan`,
    icon: <BusinessLogoChip name={b.name} logoUrl={b.logo_url} />,
  }));

  const current = items.find((i) => i.id === activeId);
  if (current) {
    current.sub = `${planLabel} · ${inboxCount} inbox${inboxCount === 1 ? "" : "es"}`;
  }

  const canAddMore = businesses.length < 2;
  const footer = canAddMore ? (
    <Link
      href="/dashboard/businesses/new"
      className="flex items-center gap-2 px-3.5 py-2 text-[14px] text-deep hover:text-ink transition-colors"
    >
      <Plus className="h-3.5 w-3.5" />
      Add another business
    </Link>
  ) : null;

  return (
    <Dropdown
      label="Active business"
      value={activeId}
      items={items}
      onChange={pick}
      footer={footer}
    />
  );
}

function BusinessLogoChip({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl: string | null;
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        className="h-7 w-7 rounded-md object-cover flex-shrink-0"
      />
    );
  }
  return (
    <div className="h-7 w-7 rounded-md bg-mist/60 grid place-items-center text-[12px] font-serif-italic text-deep/70 flex-shrink-0">
      {name.charAt(0)?.toUpperCase()}
    </div>
  );
}
