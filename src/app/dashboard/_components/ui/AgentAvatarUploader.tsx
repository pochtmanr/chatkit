"use client";

import { useState, useTransition } from "react";
import { Camera, Loader2 } from "lucide-react";
import { uploadAgentAvatar } from "@/app/dashboard/_actions/agent-profile";

const TARGET_SIZE = 256;

/**
 * Resize + center-crop an image to 256x256 client-side before upload.
 * Falls back to the original file on any failure (e.g. SVG / unsupported
 * source). Uses only the Canvas API — no extra deps.
 */
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

export function AgentAvatarUploader({
  avatarUrl,
  displayName,
}: {
  avatarUrl: string | null;
  displayName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [optimisticUrl, setOptimisticUrl] = useState<string | null>(null);

  const shownUrl = optimisticUrl ?? avatarUrl;

  function onFile(file: File) {
    setError(null);
    const previewUrl = URL.createObjectURL(file);
    setOptimisticUrl(previewUrl);

    startTransition(async () => {
      const cropped = await cropTo256(file);
      const fd = new FormData();
      fd.append("file", cropped);
      const res = await uploadAgentAvatar(fd);
      URL.revokeObjectURL(previewUrl);
      if (!res.ok) {
        setOptimisticUrl(null);
        setError(res.error);
        return;
      }
      setOptimisticUrl(res.avatarUrl);
    });
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <div className="h-16 w-16 rounded-full bg-mist/40 border border-mist overflow-hidden grid place-items-center">
          {shownUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shownUrl}
              alt={`${displayName} avatar`}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-deep/40 text-[24px] font-serif-italic">
              {displayName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        {pending && (
          <div className="absolute inset-0 grid place-items-center bg-ink/30 rounded-full">
            <Loader2 className="h-4 w-4 text-white animate-spin" />
          </div>
        )}
      </div>

      <label className="inline-flex items-center gap-2 rounded-full bg-white border border-mist px-4 py-2 text-[14px] font-medium text-ink hover:bg-mist/40 transition-colors cursor-pointer">
        <Camera className="h-3.5 w-3.5" />
        {avatarUrl ? "Replace photo" : "Upload photo"}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </label>

      {error && (
        <p className="text-[13px] font-medium text-red-700">{error}</p>
      )}
    </div>
  );
}
