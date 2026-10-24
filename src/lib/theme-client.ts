import { ACCENT_COOKIE_MAX_AGE, type ColorMode } from "@/lib/theme";

declare global {
  interface Window {
    /** Lo define MODE_SCRIPT en el layout: recalcula data-theme a partir de data-mode. */
    __wastedApplyMode?: () => void;
  }
}

/** Aplica un modo en esta página sin recargar. */
export function applyMode(mode: ColorMode) {
  document.documentElement.dataset.mode = mode;
  window.__wastedApplyMode?.();
}

export function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=${ACCENT_COOKIE_MAX_AGE}; samesite=lax`;
}
