"use client";

import { useState, useTransition } from "react";
import { Camera, Loader2 } from "lucide-react";
import { uploadBusinessLogo } from "@/app/dashboard/_actions/businesses";

export function BusinessLogoUploader({
  businessId,
  logoUrl,
  businessName,
}: {
  businessId: string;
  logoUrl: string | null;
  businessName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [optimisticUrl, setOptimisticUrl] = useState<string | null>(null);

  const shownUrl = optimisticUrl ?? logoUrl;

  function onFile(file: File) {
    setError(null);
    const fd = new FormData();
    fd.append("businessId", businessId);
    fd.append("file", file);

    const previewUrl = URL.createObjectURL(file);
    setOptimisticUrl(previewUrl);

    startTransition(async () => {
      const res = await uploadBusinessLogo(fd);
      URL.revokeObjectURL(previewUrl);
      if (!res.ok) {
        setOptimisticUrl(null);
        setError(res.error);
        return;
      }
      setOptimisticUrl(res.logoUrl);
    });
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <div className="h-16 w-16 rounded-xl bg-mist/40 border border-mist overflow-hidden grid place-items-center">
          {shownUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shownUrl}
              alt={`${businessName} logo`}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-deep/40 text-[24px] font-serif-italic">
              {businessName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        {pending && (
          <div className="absolute inset-0 grid place-items-center bg-ink/30 rounded-xl">
            <Loader2 className="h-4 w-4 text-white animate-spin" />
          </div>
        )}
      </div>

      <label className="inline-flex items-center gap-2 rounded-full bg-white border border-mist px-4 py-2 text-[14px] font-medium text-ink hover:bg-mist/40 transition-colors cursor-pointer">
        <Camera className="h-3.5 w-3.5" />
        {logoUrl ? "Replace logo" : "Upload logo"}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
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
