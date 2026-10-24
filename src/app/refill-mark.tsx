"use client";

import { useEffect } from "react";
import { REFILL_COOKIE } from "@/lib/theme";

/** Marca la semana como vista para que la recarga de la mecha salga una sola vez. */
export function RefillMark({ week }: { week: string }) {
  useEffect(() => {
    document.cookie = `${REFILL_COOKIE}=${week}; path=/; max-age=${60 * 60 * 24 * 14}; samesite=lax`;
  }, [week]);
  return null;
}
