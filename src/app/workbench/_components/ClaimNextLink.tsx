"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { claimNextUnassigned } from "../_actions/claim";

/** Inline link that claims the oldest unassigned conversation and
 *  navigates to it. Used by the /workbench empty state. */
export function ClaimNextLink() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function go() {
    setErr(null);
    startTransition(async () => {
      const res = await claimNextUnassigned();
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      if (res.conversationId) router.push(`/workbench/${res.conversationId}`);
      else setErr("Queue is empty.");
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={go}
        disabled={pending}
        className="text-deep underline hover:text-ink transition-colors disabled:opacity-50"
      >
        claim a new one
      </button>
      {err && <p className="mt-2 text-[13px] text-red-700">{err}</p>}
    </>
  );
}
