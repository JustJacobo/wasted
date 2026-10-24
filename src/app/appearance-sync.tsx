"use client";

import { useEffect } from "react";
import { ACCENT_COOKIE, MODE_COOKIE, type Accent, type ColorMode } from "@/lib/theme";
import { applyMode, writeCookie } from "@/lib/theme-client";

/**
 * En un dispositivo sin las cookies de apariencia, las escribe con lo guardado
 * en la cuenta. Solo se monta cuando falta alguna.
 */
export function AppearanceSync({ accent, mode }: { accent: Accent; mode: ColorMode }) {
  useEffect(() => {
    document.documentElement.dataset.accent = accent;
    applyMode(mode);
    writeCookie(ACCENT_COOKIE, accent);
    writeCookie(MODE_COOKIE, mode);
  }, [accent, mode]);
  return null;
}
