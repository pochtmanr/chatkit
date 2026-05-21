import {
  STATUS_LABELS,
  STATUS_PILL_CLASSES,
  type ConversationStatus,
} from "@/lib/conversation-status";

export function StatusPill({
  status,
  size = "sm",
}: {
  status: ConversationStatus;
  size?: "sm" | "md";
}) {
  const cls = STATUS_PILL_CLASSES[status];
  const sizing =
    size === "md" ? "px-3 py-1 text-[13px]" : "px-2 py-0.5 text-[11px]";
  return (
    <span
      className={`${cls} ${sizing} rounded-full font-medium tracking-tight inline-flex items-center gap-1`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
