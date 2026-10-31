// ¿Un cobro que llega solo (correo o notificación) ya está registrado? Puro:
// decide con tipo, monto, fecha, canal y nombres, sin consultar la base.

import { daysBetween } from "@/lib/dates";
import { words } from "@/lib/recurring-match";
import { IMPORTED_SOURCES, type TxType } from "@/lib/types";

export interface ChargeLike {
  type: TxType;
  amount: number;
  occurred_on: string;
  source: string;
  provider: string | null;
  /** Comercio y descripción juntos. */
  text: string;
  category_id: string | null;
}

export type ChargeMatch = "same" | "maybe";

/** Diferencia de monto con lo registrado a mano ("uber 8k" contra $7.901). */
const HAND_TOLERANCE = 0.1;

/** Correo o notificación, y de qué app: dos avisos del mismo canal no se unen solos. */
export const channel = (c: Pick<ChargeLike, "source" | "provider">) =>
  `${c.source === "notification" ? "notification" : "email"}:${c.provider ?? ""}`;

const sharesName = (a: ChargeLike, b: ChargeLike) => {
  const theirs = words(b.text);
  return [...words(a.text)].some((w) => theirs.has(w));
};

/**
 * - Con algo que también llegó solo: monto exacto y ±1 día. Si viene de otro
 *   canal u otra app y comparten un nombre ("UBER *TRIP" y "Uber") es el mismo
 *   cobro sin preguntar; si no, se pregunta (dos viajes con el mismo precio).
 * - Con lo registrado a mano: nunca se une solo. Se pregunta si el monto es
 *   exacto, o si difiere hasta 10% y comparten nombre o categoría.
 * - Con un recurrente pendiente: se pregunta si el monto es exacto (el enlace
 *   con recurrentes decide aparte).
 */
export function sameCharge(incoming: ChargeLike, existing: ChargeLike): ChargeMatch | null {
  if (incoming.type !== existing.type) return null;
  if (Math.abs(daysBetween(incoming.occurred_on, existing.occurred_on)) > 1) return null;
  const exact = Number(incoming.amount) === Number(existing.amount);

  if (IMPORTED_SOURCES.includes(existing.source)) {
    if (!exact) return null;
    return channel(incoming) !== channel(existing) && sharesName(incoming, existing) ? "same" : "maybe";
  }
  if (existing.source === "recurring") return exact ? "maybe" : null;

  if (exact) return "maybe";
  const close = Math.abs(Number(incoming.amount) - Number(existing.amount)) <= Number(existing.amount) * HAND_TOLERANCE;
  const sameCategory = Boolean(incoming.category_id) && incoming.category_id === existing.category_id;
  return close && (sameCategory || sharesName(incoming, existing)) ? "maybe" : null;
}

/** El mejor candidato: "same" primero, luego el monto más cercano y la fecha más cercana. */
export function pickMatch<T extends ChargeLike>(
  incoming: ChargeLike,
  candidates: T[],
): { item: T; strength: ChargeMatch } | null {
  const scored = candidates
    .map((item) => ({ item, strength: sameCharge(incoming, item) }))
    .filter((c): c is { item: T; strength: ChargeMatch } => c.strength !== null);
  const distance = (c: T) =>
    Math.abs(Number(c.amount) - Number(incoming.amount)) * 10 + Math.abs(daysBetween(incoming.occurred_on, c.occurred_on));
  scored.sort((a, b) =>
    a.strength === b.strength ? distance(a.item) - distance(b.item) : a.strength === "same" ? -1 : 1,
  );
  return scored[0] ?? null;
}
