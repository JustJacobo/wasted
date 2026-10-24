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

/** Modo claro u oscuro (Ajustes → Tema). "system" sigue al teléfono. */
export const COLOR_MODES = [
  { key: "system", name: "Sistema" },
  { key: "light", name: "Claro" },
  { key: "dark", name: "Oscuro" },
] as const;

export type ColorMode = (typeof COLOR_MODES)[number]["key"];

export const DEFAULT_MODE: ColorMode = "system";
export const MODE_KEYS = COLOR_MODES.map((m) => m.key) as [ColorMode, ...ColorMode[]];
export const MODE_COOKIE = "wasted-modo";

export function isColorMode(value: unknown): value is ColorMode {
  return typeof value === "string" && (MODE_KEYS as string[]).includes(value);
}

export function parseMode(value: unknown): ColorMode {
  return isColorMode(value) ? value : DEFAULT_MODE;
}

/** Color de la barra de estado del teléfono en cada modo (el fondo de la app). */
export const THEME_COLORS = { light: "#f6f5f1", dark: "#0f0e0d" } as const;

/**
 * Script del <head>: pone data-theme a partir de data-mode antes del primer
 * pintado y, con "system", sigue los cambios del teléfono.
 */
export const MODE_SCRIPT = `(function(){var r=document.documentElement,q=matchMedia("(prefers-color-scheme: dark)");function a(){var m=r.dataset.mode;r.dataset.theme=m==="dark"||(m!=="light"&&q.matches)?"dark":"light"}a();q.addEventListener("change",a);window.__wastedApplyMode=a})()`;
