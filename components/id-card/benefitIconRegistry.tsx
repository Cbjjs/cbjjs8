import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Apple,
  BadgeCheck,
  BookOpen,
  Building2,
  Calculator,
  CalendarCheck,
  CheckCircle,
  CircleDollarSign,
  CreditCard,
  Dumbbell,
  FileBadge,
  GraduationCap,
  HandHeart,
  HeartPulse,
  Landmark,
  Medal,
  Megaphone,
  Percent,
  Scale,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Stethoscope,
  Trophy,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';

export const BENEFIT_ICON_REGISTRY = {
  Activity,
  Apple,
  BadgeCheck,
  BookOpen,
  Building2,
  Calculator,
  CalendarCheck,
  CheckCircle,
  CircleDollarSign,
  CreditCard,
  Dumbbell,
  FileBadge,
  GraduationCap,
  HandHeart,
  HeartPulse,
  Landmark,
  Medal,
  Megaphone,
  Percent,
  Scale,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Stethoscope,
  Trophy,
  Users,
  Wallet,
  Zap,
} satisfies Record<string, LucideIcon>;

export type BenefitIconName = keyof typeof BENEFIT_ICON_REGISTRY;

export const getBenefitIcon = (iconName: string | null | undefined): LucideIcon => {
  if (iconName && iconName in BENEFIT_ICON_REGISTRY) {
    return BENEFIT_ICON_REGISTRY[iconName as BenefitIconName];
  }

  return ShieldCheck;
};
