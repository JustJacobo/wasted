import type { Icon } from "@phosphor-icons/react";
import {
  AirplaneTilt,
  Baby,
  Bank,
  Barbell,
  Basket,
  BeerStein,
  Bicycle,
  BookOpen,
  Briefcase,
  Bus,
  CalendarCheck,
  Coffee,
  Coins,
  Confetti,
  Cookie,
  DeviceMobile,
  FilmSlate,
  FirstAid,
  ForkKnife,
  GameController,
  GasPump,
  Gift,
  GraduationCap,
  HandCoins,
  Heart,
  House,
  Laptop,
  Lightbulb,
  Motorcycle,
  MusicNotes,
  Package,
  PawPrint,
  Pill,
  Pizza,
  Popcorn,
  Receipt,
  Scissors,
  ShoppingBag,
  ShoppingCart,
  TShirt,
  Taxi,
  Television,
  Wine,
  Wrench,
} from "@phosphor-icons/react/dist/ssr";
import { isCategoryIcon, type CategoryIconKey } from "@/lib/category-icons";

export const ICON_COMPONENTS: Record<CategoryIconKey, Icon> = {
  "fork-knife": ForkKnife,
  taxi: Taxi,
  "shopping-cart": ShoppingCart,
  "graduation-cap": GraduationCap,
  pill: Pill,
  confetti: Confetti,
  television: Television,
  "shopping-bag": ShoppingBag,
  lightbulb: Lightbulb,
  house: House,
  package: Package,
  "calendar-check": CalendarCheck,
  gift: Gift,
  briefcase: Briefcase,
  coins: Coins,
  coffee: Coffee,
  pizza: Pizza,
  cookie: Cookie,
  "beer-stein": BeerStein,
  wine: Wine,
  bus: Bus,
  motorcycle: Motorcycle,
  bicycle: Bicycle,
  "gas-pump": GasPump,
  "airplane-tilt": AirplaneTilt,
  "device-mobile": DeviceMobile,
  laptop: Laptop,
  barbell: Barbell,
  "first-aid": FirstAid,
  "book-open": BookOpen,
  "game-controller": GameController,
  "film-slate": FilmSlate,
  popcorn: Popcorn,
  "music-notes": MusicNotes,
  "t-shirt": TShirt,
  scissors: Scissors,
  basket: Basket,
  "paw-print": PawPrint,
  baby: Baby,
  heart: Heart,
  wrench: Wrench,
  receipt: Receipt,
  bank: Bank,
  "hand-coins": HandCoins,
};

/**
 * Ícono de una categoría. Las categorías propias anteriores a los íconos no
 * tienen `icon`: para ellas se muestra su emoji.
 */
export function CategoryIcon({
  category,
  className = "size-5",
}: {
  category: { icon?: string | null; emoji: string } | null | undefined;
  className?: string;
}) {
  if (!category) return <span aria-hidden className={`inline-grid place-items-center ${className}`}>•</span>;
  if (isCategoryIcon(category.icon)) {
    const Component = ICON_COMPONENTS[category.icon];
    return <Component aria-hidden className={className} />;
  }
  return (
    <span aria-hidden className={`inline-grid place-items-center leading-none ${className}`}>
      {category.emoji}
    </span>
  );
}
