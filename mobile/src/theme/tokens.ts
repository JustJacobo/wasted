// Papel y tinta, igual que src/app/globals.css. El único color lo pone el
// acento (Ajustes → Tema); el modo puede seguir al teléfono.

import type { Accent } from "@/lib/theme";

export interface Palette {
  background: string;
  surface: string;
  foreground: string;
  muted: string;
  border: string;
  danger: string;
  accent: string;
  onAccent: string;
  accentInk: string;
  viz: string;
  vizWarn: string;
  vizOver: string;
  categories: Record<string, string>;
}

const light: Palette = {
  background: "#f6f5f1",
  surface: "#fdfcfa",
  foreground: "#161513",
  muted: "#6b6860",
  border: "#e4e2dc",
  danger: "#c62828",
  accent: "#161513",
  onAccent: "#f6f5f1",
  accentInk: "#161513",
  viz: "#57544d",
  vizWarn: "#c46504",
  vizOver: "#dc2626",
  categories: {
    azul: "#2a78d6",
    naranja: "#eb6834",
    aqua: "#1baf7a",
    amarillo: "#eda100",
    magenta: "#e87ba4",
    verde: "#008300",
    violeta: "#6250d6",
    rojo: "#e34948",
    gris: "#8f8b82",
  },
};

const dark: Palette = {
  background: "#0f0e0d",
  surface: "#1a1917",
  foreground: "#f2f0ea",
  muted: "#a19d94",
  border: "#2a2825",
  danger: "#f87171",
  accent: "#f2f0ea",
  onAccent: "#0f0e0d",
  accentInk: "#f2f0ea",
  viz: "#938f86",
  vizWarn: "#c98500",
  vizOver: "#e66767",
  categories: {
    azul: "#3987e5",
    naranja: "#d95926",
    aqua: "#199e70",
    amarillo: "#c98500",
    magenta: "#d55181",
    verde: "#008300",
    violeta: "#9085e9",
    rojo: "#e66767",
    gris: "#75716a",
  },
};

type AccentColors = Pick<Palette, "accent" | "onAccent" | "accentInk" | "viz">;

const ACCENTS: Record<Exclude<Accent, "tinta">, { light: AccentColors; dark: AccentColors }> = {
  brasa: {
    light: { accent: "#ff5a1f", onAccent: "#161513", accentInk: "#c2410c", viz: "#e8501a" },
    dark: { accent: "#ff6b35", onAccent: "#161513", accentInk: "#ff7a45", viz: "#e85a24" },
  },
  cobalto: {
    light: { accent: "#2f4bff", onAccent: "#ffffff", accentInk: "#2f4bff", viz: "#2f4bff" },
    dark: { accent: "#7088ff", onAccent: "#0f0e0d", accentInk: "#8b9dff", viz: "#6f86ff" },
  },
  lila: {
    light: { accent: "#7c4dff", onAccent: "#ffffff", accentInk: "#6b3fe0", viz: "#7c4dff" },
    dark: { accent: "#a98bff", onAccent: "#0f0e0d", accentInk: "#b9a2ff", viz: "#8c6cf5" },
  },
  menta: {
    light: { accent: "#19b38a", onAccent: "#0f2a22", accentInk: "#0b7a5e", viz: "#0f9474" },
    dark: { accent: "#3fd3a5", onAccent: "#0f0e0d", accentInk: "#4fd8ac", viz: "#1fa883" },
  },
};

export function palette(scheme: "light" | "dark", accent: Accent): Palette {
  const base = scheme === "dark" ? dark : light;
  return accent === "tinta" ? base : { ...base, ...ACCENTS[accent][scheme] };
}

/** Color de una categoría (dashboard e íconos); gris si no tiene. */
export const categoryColor = (p: Palette, color: string | null | undefined) =>
  (color && p.categories[color]) || p.categories.gris;

export const FONTS = {
  regular: "Geist_400Regular",
  medium: "Geist_500Medium",
  semibold: "Geist_600SemiBold",
  bold: "Geist_700Bold",
  mono: "GeistMono_400Regular",
} as const;
