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
 * Allowlist of lucide icon names exposed in the launcher icon picker.
 * The DB stores the raw slug; this map renders it. The widget bundles
 * its own copy so it never needs to import from the dashboard tree.
 *
 * Distinct from start-option-icons.ts on purpose — launchers and topic
 * icons live in different visual contexts and should be tuned
 * independently.
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

export const LAUNCHER_ICON_NAMES = Object.keys(LAUNCHER_ICONS);

export function isLauncherIcon(value: string): value is keyof typeof LAUNCHER_ICONS {
  return Object.prototype.hasOwnProperty.call(LAUNCHER_ICONS, value);
}
