import { permanentRedirect } from "next/navigation";

// Round 5 renamed the customer surface to /embed/customer. This file is
// a 308 tombstone so production embeds keep working until prompt 6's
// loader script ships the new URL. Delete at the start of round 7.
export default async function LegacyWidgetRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") usp.set(k, v);
  }
  const qs = usp.toString();
  permanentRedirect(qs ? `/embed/customer?${qs}` : "/embed/customer");
}
