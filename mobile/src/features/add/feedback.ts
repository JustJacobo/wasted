import { useSyncExternalStore } from "react";
import type { Transaction, WeekBudget } from "@/lib/types";
import type { Similar } from "./types";

/** Lo que muestra el inicio después de registrar: deshacer, cambiar categoría o el mensaje de un préstamo. */
export type Feedback =
  | { kind: "saved"; transaction: Transaction; week: WeekBudget; similar: Similar | null }
  | { kind: "moved"; message: string };

const DISMISS_MS = 6_000;

let current: Feedback | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** La ventana de registro avisa aquí al guardar; el aviso se va solo a los 6 s. */
export function showFeedback(next: Feedback | null) {
  current = next;
  clearTimeout(timer);
  if (next) timer = setTimeout(() => showFeedback(null), DISMISS_MS);
  emit();
}

/** Mantiene el aviso visible mientras se usa (p. ej. al cambiar la categoría). */
export function keepFeedback(next: Feedback) {
  showFeedback(next);
}

export function useFeedback(): Feedback | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}
