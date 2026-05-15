"use client";

import { useEffect, useState } from "react";

export type DocsNavItem = {
  id: string;
  label: string;
  /** When provided, the item is rendered indented as a sub-link. */
  group?: string;
};

export function DocsNav({ items }: { items: DocsNavItem[] }) {
  const [active, setActive] = useState<string>(items[0]?.id ?? "");

  useEffect(() => {
    const els = items
      .map((it) => document.getElementById(it.id))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;

    // Track which sections are intersecting the viewport. When several
    // are in view at once, prefer the topmost one — that matches the
    // section a reader is actively looking at.
    const visible = new Map<string, number>();
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible.set(entry.target.id, entry.boundingClientRect.top);
          } else {
            visible.delete(entry.target.id);
          }
        }
        if (visible.size === 0) return;
        const next = [...visible.entries()].sort((a, b) => a[1] - b[1])[0][0];
        setActive(next);
      },
      { rootMargin: "-96px 0px -60% 0px", threshold: [0, 1] },
    );

    for (const el of els) obs.observe(el);
    return () => obs.disconnect();
  }, [items]);

  return (
    <nav className="sticky top-24 self-start">
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-600 mb-3 px-3">
        On this page
      </p>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const isActive = active === item.id;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={`block rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  item.group ? "ml-3" : ""
                } ${
                  isActive
                    ? "bg-mist text-ink"
                    : "text-deep/60 hover:text-ink hover:bg-mist/60"
                }`}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function DocsNavMobile({ items }: { items: DocsNavItem[] }) {
  return (
    <div className="lg:hidden">
      <label htmlFor="docs-nav-jump" className="sr-only">
        Jump to section
      </label>
      <select
        id="docs-nav-jump"
        onChange={(e) => {
          const id = e.target.value;
          if (!id) return;
          const el = document.getElementById(id);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
        defaultValue=""
        className="w-full rounded-full border border-mist bg-white px-4 py-2.5 text-sm text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-deep/20"
      >
        <option value="" disabled>
          Jump to section…
        </option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.group ? "  " : ""}
            {item.label}
          </option>
        ))}
      </select>
    </div>
  );
}
