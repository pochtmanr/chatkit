const BASE =
  "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[14px] transition-colors";

export function navItemClasses(
  active: boolean,
  opts: { nested?: boolean; sectionActive?: boolean } = {}
) {
  if (active) return `${BASE} bg-ink text-white`;
  if (opts.sectionActive) return `${BASE} text-ink font-medium hover:bg-mist/50`;
  return `${BASE} text-ink/80 hover:bg-mist/50 hover:text-ink`;
}

export function isActiveRoute(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}
