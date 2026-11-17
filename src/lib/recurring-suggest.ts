// Qué recurrentes ofrecer al registrar, para marcarlos como pagados en vez de
// crear un movimiento aparte. Puro: trabaja sobre `upcomingCharges`.

import { addDays, formatShortDay } from "@/lib/dates";
import { PRICE_TOLERANCE } from "@/lib/recurring-match";
import type { TxType } from "@/lib/types";
import type { UpcomingCharge } from "@/lib/week-plan";

/** Fichas en la ventana de registro: pocas, para no llenar el teclado. */
export const MAX_SUGGESTIONS = 3;

/**
 * Lo que se puede marcar pagado ahora: los pendientes de la bandeja y la
 * próxima fecha de cada recurrente (la siguiente se paga cuando llegue esta).
 * Primero lo pendiente, luego lo más cercano.
 */
export function payableCharges(upcoming: UpcomingCharge[], type: TxType): UpcomingCharge[] {
  const pendingRules = new Set(upcoming.filter((c) => c.pending).map((c) => c.ruleId));
  const seen = new Set<string>();
  const items: UpcomingCharge[] = [];
  for (const charge of upcoming) {
    if (charge.type !== type) continue;
    if (charge.pending) {
      items.push(charge);
      continue;
    }
    // Con un pendiente de la misma regla, ese va primero; la fecha futura espera.
    if (pendingRules.has(charge.ruleId) || seen.has(charge.ruleId)) continue;
    seen.add(charge.ruleId);
    items.push(charge);
  }
  return items
    .sort((a, b) => (a.pending === b.pending ? (a.day < b.day ? -1 : a.day > b.day ? 1 : 0) : a.pending ? -1 : 1))
    .slice(0, MAX_SUGGESTIONS);
}

/** Los pagables con un monto parecido al escrito (±25 %), el más cercano primero. */
export function matchingCharges(upcoming: UpcomingCharge[], type: TxType, amount: number): UpcomingCharge[] {
  if (amount <= 0) return [];
  return payableCharges(upcoming, type)
    .filter((c) => Math.abs(amount - c.amount) <= c.amount * PRICE_TOLERANCE)
    .sort((a, b) => Math.abs(amount - a.amount) - Math.abs(amount - b.amount));
}

/** Identifica una ficha: la regla y su fecha (un recurrente diario tiene varias). */
export const chargeKey = (c: Pick<UpcomingCharge, "ruleId" | "occurrence">) => `${c.ruleId}:${c.occurrence}`;

/** Cuándo vence, para la ficha: "Por confirmar", "Vence hoy", "Mañana" o "20 nov". */
export function dueLabel(c: Pick<UpcomingCharge, "pending" | "day">, today: string): string {
  if (c.pending) return "Por confirmar";
  if (c.day <= today) return "Vence hoy";
  if (c.day === addDays(today, 1)) return "Mañana";
  return formatShortDay(c.day);
}

/** El recurrente que se paga desde un acceso directo (inicio, Plan): lo pendiente primero. */
export function payableForRule(upcoming: UpcomingCharge[], ruleId: string): UpcomingCharge | null {
  const own = upcoming.filter((c) => c.ruleId === ruleId);
  return own.find((c) => c.pending) ?? own[0] ?? null;
}

/** La fecha que se tocó (si viene) o, si no, lo próximo de ese recurrente. */
export function findCharge(upcoming: UpcomingCharge[], ruleId: string, occurrence?: string | null): UpcomingCharge | null {
  return (occurrence && upcoming.find((c) => c.ruleId === ruleId && c.occurrence === occurrence)) || payableForRule(upcoming, ruleId);
}

/** Cómo se llama en la ficha, el botón y la confirmación. */
export const chargeName = (c: Pick<UpcomingCharge, "description">, category?: { name: string } | null) =>
  c.description || category?.name || "Recurrente";

/**
 * La fecha con que se registra: la del cobro si ya esperaba en la bandeja (así
 * no se mueve de semana), hoy si se paga antes de tiempo.
 */
export const payDate = (c: Pick<UpcomingCharge, "pending" | "day">, today: string) => (c.pending && c.day <= today ? c.day : today);
