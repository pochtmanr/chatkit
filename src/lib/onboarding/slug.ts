export function slugify(input: string, fallback = "item"): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || fallback
  );
}

export function slugWithSuffix(input: string, fallback = "item"): string {
  const base = slugify(input, fallback);
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

export function newApiKey(): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return (
    "pk_live_" +
    Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  );
}
