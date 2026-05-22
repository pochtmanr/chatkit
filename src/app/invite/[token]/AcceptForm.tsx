"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import {
  acceptInviteExistingUser,
  acceptInviteNewUser,
} from "@/app/invite/_actions/accept";
import { uploadAgentAvatar } from "@/app/dashboard/_actions/agent-profile";

const TARGET_SIZE = 256;

async function cropTo256(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = TARGET_SIZE;
  canvas.height = TARGET_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, TARGET_SIZE, TARGET_SIZE);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) return file;
  return new File([blob], "avatar.png", { type: "image/png" });
}

export function AcceptForm({
  token,
  email,
  suggestedDisplayName,
  isExistingUser,
}: {
  token: string;
  email: string;
  suggestedDisplayName: string;
  isExistingUser: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(suggestedDisplayName);
  const [password, setPassword] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  function handleAvatarChange(file: File | null) {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    if (!file) {
      setAvatarFile(null);
      setAvatarPreview(null);
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const args = {
        token,
        password,
        displayName,
        avatarUrl: null,
      };
      const res = isExistingUser
        ? await acceptInviteExistingUser(args)
        : await acceptInviteNewUser(args);
      if (!res.ok) {
        setError(res.error);
        return;
      }

      if (avatarFile) {
        try {
          const cropped = await cropTo256(avatarFile);
          const fd = new FormData();
          fd.append("file", cropped);
          // The user is signed in by this point, so uploadAgentAvatar
          // can update their support_agents row directly.
          await uploadAgentAvatar(fd);
        } catch {
          // Non-fatal — the agent can re-upload from the workbench.
        }
      }

      router.push("/workbench");
      router.refresh();
    });
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div className="space-y-1.5">
        <label className="block text-[12px] uppercase tracking-[0.1em] text-deep/60">
          Email
        </label>
        <input
          type="email"
          value={email}
          readOnly
          className="w-full rounded-xl border border-mist bg-mist/30 px-3.5 py-2.5 text-[14px] text-deep/70"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="invite-display-name"
          className="block text-[12px] uppercase tracking-[0.1em] text-deep/60"
        >
          Display name
        </label>
        <input
          id="invite-display-name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={80}
          required
          className="w-full rounded-xl border border-mist bg-white px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
        />
        <p className="text-[12px] text-deep/60">
          Shown to customers when you reply.
        </p>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="invite-password"
          className="block text-[12px] uppercase tracking-[0.1em] text-deep/60"
        >
          {isExistingUser ? "Your current password" : "Choose a password"}
        </label>
        <input
          id="invite-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={isExistingUser ? undefined : 8}
          required
          autoComplete={isExistingUser ? "current-password" : "new-password"}
          className="w-full rounded-xl border border-mist bg-white px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
        />
        {isExistingUser ? (
          <p className="text-[12px] text-deep/60">
            We&apos;ll verify the password you already use for this email.
          </p>
        ) : (
          <p className="text-[12px] text-deep/60">Minimum 8 characters.</p>
        )}
      </div>

      <div className="space-y-2">
        <label className="block text-[12px] uppercase tracking-[0.1em] text-deep/60">
          Photo (optional)
        </label>
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 rounded-full bg-mist/40 border border-mist overflow-hidden grid place-items-center">
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarPreview}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-deep/40 text-[20px]">
                {(displayName.charAt(0) || "?").toUpperCase()}
              </span>
            )}
          </div>
          <label className="inline-flex items-center gap-2 rounded-full bg-white border border-mist px-3.5 py-2 text-[13px] font-medium text-ink hover:bg-mist/40 transition-colors cursor-pointer">
            <Camera className="h-3.5 w-3.5" />
            {avatarFile ? "Replace" : "Choose photo"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                handleAvatarChange(f);
                e.target.value = "";
              }}
            />
          </label>
          {avatarFile && (
            <button
              type="button"
              onClick={() => handleAvatarChange(null)}
              className="text-[13px] text-deep/60 hover:text-ink"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="text-[13px] font-medium text-red-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 w-full rounded-full bg-ink text-white px-4 py-3 text-[14px] font-medium hover:bg-deep transition-colors disabled:opacity-60"
      >
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {pending ? "Setting up…" : "Accept invitation"}
      </button>
    </form>
  );
}
