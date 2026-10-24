/**
 * Temas de acento (Ajustes → Tema). Solo cambian el color de acento; los
 * valores de cada uno viven en globals.css bajo `html[data-accent]`.
 */
export const ACCENTS = [
  { key: "tinta", name: "Tinta", swatch: { light: "#161513", dark: "#f2f0ea" } },
  { key: "brasa", name: "Brasa", swatch: { light: "#ff5a1f", dark: "#ff6b35" } },
  { key: "cobalto", name: "Cobalto", swatch: { light: "#2f4bff", dark: "#7088ff" } },
  { key: "lila", name: "Lila", swatch: { light: "#7c4dff", dark: "#a98bff" } },
  { key: "menta", name: "Menta", swatch: { light: "#19b38a", dark: "#3fd3a5" } },
] as const;

export type Accent = (typeof ACCENTS)[number]["key"];

export const DEFAULT_ACCENT: Accent = "tinta";
export const ACCENT_KEYS = ACCENTS.map((a) => a.key) as [Accent, ...Accent[]];

/** Copia del tema en una cookie para pintarlo desde el primer HTML, sin parpadeo. */
export const ACCENT_COOKIE = "wasted-accent";
export const ACCENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isAccent(value: unknown): value is Accent {
  return typeof value === "string" && (ACCENT_KEYS as string[]).includes(value);
}

export function parseAccent(value: unknown): Accent {
  return isAccent(value) ? value : DEFAULT_ACCENT;
}

/** Lunes de la última semana en que se vio la recarga de la mecha. */
export const REFILL_COOKIE = "wasted-recarga";
