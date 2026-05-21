type AvatarProps = {
  name: string;
  size?: "sm" | "md";
};

export function Avatar({ name, size = "md" }: AvatarProps) {
  // Deterministic background pick so the same person looks the same
  // across the list. Pulls from a palette that lives well on mist.
  const palette = ["bg-deep/80", "bg-ink/80", "bg-deep/60", "bg-ink/60"];
  const hash = Array.from(name).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const bg = palette[hash % palette.length];
  const dims = size === "sm" ? "h-9 w-9" : "h-10 w-10";
  return (
    <div
      className={`${dims} rounded-full ${bg} text-white flex items-center justify-center text-[12px] font-medium shrink-0`}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}
