// ¿Este cobro (del correo) es el de un recurrente? Puro: decide con tipo, monto,
// fecha y el texto del correo, sin consultar la base.

import { daysBetween } from "@/lib/dates";
import { fold } from "@/lib/quick-add/parse";
import type { Frequency } from "@/lib/recurring";
import type { TxType } from "@/lib/types";

export type MatchStrength = "same" | "maybe";

export interface RuleForMatch extends Frequency {
  type: TxType;
  amount: number;
  description: string;
  /** Cómo aparece en el correo ("google play"), aprendido al confirmar un cobro. */
  match_hint: string | null;
}

export interface Charge {
  type: TxType;
  amount: number;
  occurred_on: string;
  /** Comercio, descripción y asunto del correo, juntos. */
  text: string;
}

/** Diferencia de monto que todavía puede ser el mismo cobro (subió el precio). */
const PRICE_TOLERANCE = 0.25;

/**
 * Días de diferencia que se aceptan entre la fecha del recurrente y la del
 * cobro: ±3, salvo en series de pocos días, donde se confundiría con la fecha
 * anterior o la siguiente.
 */
export function linkWindow({ every, unit }: Frequency): number {
  if (unit !== "day") return 3;
  return Math.min(3, Math.floor((every - 1) / 2));
}

const FILLER = new Set([
  "de", "del", "la", "el", "los", "las", "en", "por", "para", "con", "tu", "su", "mi",
  "pago", "pagos", "recibo", "factura", "compra", "cobro", "plan", "mensual", "anual", "cuota",
]);

/** Plegado (sin tildes, minúsculas) y con espacios simples, para buscar el nombre aprendido. */
export function foldText(text: string): string {
  return fold(text).replace(/[^a-z0-9ñ]+/g, " ").trim();
}

export function words(text: string): Set<string> {
  return new Set(foldText(text).split(" ").filter((w) => w.length >= 3 && !FILLER.has(w)));
}

/**
 * "same": el nombre aprendido aparece en el correo (aunque el precio cambie un
 * poco), o el monto es exacto y el correo nombra al recurrente. "maybe": solo
 * una de las dos pistas (monto exacto o nombre con un monto parecido); se le
 * pregunta al usuario. Un monto igual por sí solo no basta: en pesos hay muchos
 * cobros redondos que coinciden por casualidad.
 */
export function matchCharge(rule: RuleForMatch, occurrence: string, charge: Charge): MatchStrength | null {
  if (charge.type !== rule.type) return null;
  if (Math.abs(daysBetween(occurrence, charge.occurred_on)) > linkWindow(rule)) return null;
  const exact = Number(charge.amount) === Number(rule.amount);
  const close = Math.abs(Number(charge.amount) - Number(rule.amount)) <= Number(rule.amount) * PRICE_TOLERANCE;
  if (!close) return null;

  const text = ` ${foldText(charge.text)} `;
  if (rule.match_hint && text.includes(` ${rule.match_hint} `)) return "same";
  const ruleWords = words(rule.description);
  const named = [...words(charge.text)].some((w) => ruleWords.has(w));
  if (exact && named) return "same";
  return exact || named ? "maybe" : null;
}

/** Un nombre aprendido sirve si es específico: no el de una app con muchos comercios. */
export function usefulHint(merchant: string | null, provider: string | null | undefined): string | null {
  if (!merchant || provider === "uber" || provider === "rappi") return null;
  const hint = foldText(merchant);
  return hint.length >= 4 ? hint : null;
}

/** Elige el mejor candidato: primero "same", luego el de fecha más cercana. */
export function bestMatch<T>(
  candidates: { item: T; strength: MatchStrength | null; days: number }[],
): { item: T; strength: MatchStrength } | null {
  const valid = candidates.filter((c): c is { item: T; strength: MatchStrength; days: number } => c.strength !== null);
  valid.sort((a, b) => (a.strength === b.strength ? Math.abs(a.days) - Math.abs(b.days) : a.strength === "same" ? -1 : 1));
  return valid[0] ? { item: valid[0].item, strength: valid[0].strength } : null;
}
