"use client";

import { useState } from "react";
import {
  PROFILE_ROLES,
  LABELS,
  type ProfileRole,
} from "@/lib/onboarding/enums";
import { TileGrid, BackContinue } from "@/app/dashboard/_components/ui/primitives";

export function StepRole({
  initial,
  pending,
  onContinue,
}: {
  initial: ProfileRole | null;
  pending: boolean;
  onContinue: (role: ProfileRole) => void;
}) {
  const [role, setRole] = useState<ProfileRole | null>(initial);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const picked = fd.get("role") as ProfileRole | null;
        if (picked) onContinue(picked);
      }}
      onChange={(e) => {
        const target = e.target as unknown as HTMLInputElement;
        if (target.name === "role") setRole(target.value as ProfileRole);
      }}
    >
      <TileGrid
        name="role"
        options={PROFILE_ROLES}
        labels={LABELS.role}
        defaultValue={initial ?? undefined}
      />
      <BackContinue pending={pending || !role} />
    </form>
  );
}
