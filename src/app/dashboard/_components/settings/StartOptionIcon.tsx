"use client";

import { MessageCircle } from "lucide-react";
import { START_OPTION_ICONS } from "./start-option-icons";

/**
 * Render a lucide icon by slug. Bouncing the lookup through a stable
 * component keeps `react-hooks/static-components` happy — looking up
 * `START_OPTION_ICONS[name]` inside render would otherwise look like
 * "creating a component during render."
 */
export function StartOptionIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Component = START_OPTION_ICONS[name] ?? MessageCircle;
  return <Component className={className} />;
}
