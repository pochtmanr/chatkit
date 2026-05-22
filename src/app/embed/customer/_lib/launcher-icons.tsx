import {
  Bell,
  Briefcase,
  Coffee,
  Globe,
  HandHeart,
  Headphones,
  HelpCircle,
  LifeBuoy,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  ShoppingBag,
  Smile,
  Sparkles,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Mirrors src/app/dashboard/_components/settings/launcher-icons.ts.
 * The widget bundles separately so we duplicate the table here rather
 * than crossing the dashboard/embed boundary — slugs are stable strings
 * and the dashboard's saveWidgetConfig action gates writes against the
 * dashboard copy of this allowlist.
 */
export const LAUNCHER_ICONS: Record<string, LucideIcon> = {
  "message-circle": MessageCircle,
  "message-square": MessageSquare,
  headphones: Headphones,
  "life-buoy": LifeBuoy,
  "help-circle": HelpCircle,
  mail: Mail,
  bell: Bell,
  phone: Phone,
  sparkles: Sparkles,
  smile: Smile,
  "hand-heart": HandHeart,
  globe: Globe,
  zap: Zap,
  coffee: Coffee,
  briefcase: Briefcase,
  "shopping-bag": ShoppingBag,
};

export function launcherIconFor(name: string | null): LucideIcon {
  if (name && LAUNCHER_ICONS[name]) return LAUNCHER_ICONS[name];
  return MessageCircle;
}

/** Renders the lucide icon element for the given preset. Returning an
 *  element (rather than a component reference) keeps the static-
 *  components lint rule happy at call sites. */
export function renderLauncherIcon(
  name: string | null,
  className = "h-6 w-6",
): React.ReactElement {
  const Icon = launcherIconFor(name);
  return <Icon className={className} />;
}
