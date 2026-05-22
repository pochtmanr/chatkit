import {
  Bell,
  BookOpen,
  Briefcase,
  Bug,
  Calendar,
  CreditCard,
  Headphones,
  HelpCircle,
  LifeBuoy,
  Mail,
  MessageCircle,
  Package,
  Receipt,
  Shield,
  Truck,
  User,
  type LucideIcon,
} from "lucide-react";

/**
 * Allowlist of lucide icon names exposed in the start-option icon picker.
 * The DB stores the raw slug (e.g. "credit-card"); this map renders it.
 * Reject any slug not present here in the server action — owners can't
 * inject arbitrary names through the form.
 */
export const START_OPTION_ICONS: Record<string, LucideIcon> = {
  "message-circle": MessageCircle,
  "life-buoy": LifeBuoy,
  "help-circle": HelpCircle,
  package: Package,
  receipt: Receipt,
  "credit-card": CreditCard,
  truck: Truck,
  calendar: Calendar,
  user: User,
  shield: Shield,
  bug: Bug,
  "book-open": BookOpen,
  briefcase: Briefcase,
  headphones: Headphones,
  mail: Mail,
  bell: Bell,
};

export const START_OPTION_ICON_NAMES = Object.keys(START_OPTION_ICONS);

export function isStartOptionIcon(value: string): value is keyof typeof START_OPTION_ICONS {
  return Object.prototype.hasOwnProperty.call(START_OPTION_ICONS, value);
}
