"use client";

import { useEffect } from "react";
import { ACCENT_COOKIE, ACCENT_COOKIE_MAX_AGE, type Accent } from "@/lib/theme";

/**
 * En un dispositivo sin la cookie del tema, la escribe con el valor guardado
 * en la cuenta. Solo se monta cuando falta la cookie.
 */
export function AccentSync({ accent }: { accent: Accent }) {
  useEffect(() => {
    document.documentElement.dataset.accent = accent;
    document.cookie = `${ACCENT_COOKIE}=${accent}; path=/; max-age=${ACCENT_COOKIE_MAX_AGE}; samesite=lax`;
  }, [accent]);
  return null;
}
