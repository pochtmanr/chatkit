"use client";

import { useEffect, useState } from "react";

interface Owner {
  id: string;
  email: string | null;
  name: string | null;
}

/**
 * Client-side dropdown that lists the connected HubSpot account's owners
 * and lets the tenant owner pick one. Posts back to the server action
 * passed via `saveAction` to persist tenants.hubspot_owner_id.
 *
 * Lives separately as a client component because the picker needs to
 * fetch /api/hubspot/owners on mount — a server-component approach
 * would have to inline the fetch into the parent's render path, which
 * blocks the whole settings page if HubSpot is slow.
 */
export function HubSpotOwnerPicker({
  initialOwnerId,
  saveAction,
}: {
  initialOwnerId: string | null;
  saveAction: (formData: FormData) => Promise<void>;
}) {
  const [owners, setOwners] = useState<Owner[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>(initialOwnerId ?? "");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/hubspot/owners")
      .then((r) => r.json())
      .then((data: { owners?: Owner[]; error?: string }) => {
        if (cancelled) return;
        if (data.error) setError(data.error);
        else setOwners(data.owners ?? []);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "fetch failed");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
        Couldn&apos;t load HubSpot owners: {error}
      </p>
    );
  }

  if (!owners) {
    return <p className="text-sm text-zinc-500">Loading owners…</p>;
  }

  if (owners.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No HubSpot users found. Add a teammate in HubSpot Settings → Users.
      </p>
    );
  }

  return (
    <form action={saveAction} className="space-y-3">
      <label className="block text-sm">
        Assign new tickets to
        <select
          name="hubspot_owner_id"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
        >
          <option value="">— Unassigned (no notifications) —</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name ? `${o.name}` : "(no name)"}
              {o.email ? ` · ${o.email}` : ""}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-zinc-500">
          Tickets created from chat get assigned to this user, so they
          receive HubSpot&apos;s &quot;ticket assigned to me&quot; notifications.
        </span>
      </label>
      <button
        type="submit"
        className="rounded-lg bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white px-4 py-2 text-sm font-medium"
      >
        Save owner
      </button>
    </form>
  );
}
