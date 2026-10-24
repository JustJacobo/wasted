import { formatCOP } from "@/lib/money";

export type BudgetLevel = "none" | "ok" | "warning" | "over";

export interface BudgetStatus {
  /** Gasto / ingreso. 0.85 = llevas 85% de lo que entró. */
  ratio: number;
  level: BudgetLevel;
}

export const WARNING_AT = 0.8;

/**
 * El presupuesto de la semana es lo que entró en ella. Sin ingresos no hay
 * presupuesto con el cual comparar.
 */
export function budgetStatus(expense: number, income: number): BudgetStatus {
  if (income <= 0) return { ratio: 0, level: "none" };
  const ratio = expense / income;
  const level = ratio >= 1 ? "over" : ratio >= WARNING_AT ? "warning" : "ok";
  return { ratio, level };
}

const percent = new Intl.NumberFormat("es-CO", { style: "percent", maximumFractionDigits: 0 });

/** Desde aquí el "vas bien" pasa a "ojo". */
export const HALF_AT = 0.5;

/**
 * Estado del presupuesto de la semana, en voz parcera: irónica, nunca regañona.
 * Frase completa sin punto final; null si no hay nada que decir.
 */
export function budgetMessage(
  { ratio, level }: BudgetStatus,
  expense: number,
  income: number,
): string | null {
  if (level === "none") return null;
  const pct = percent.format(ratio);
  if (level === "over") return `Paila: te pasaste ${formatCOP(expense - income)} de lo que entró esta semana`;
  if (level === "warning") return `Frena un poquito: llevas ${pct} de lo que entró esta semana`;
  if (ratio >= HALF_AT) return `Ojo, ya va el ${pct} de lo que entró esta semana`;
  return `Vas bien, parce: llevas ${pct} de lo que entró esta semana`;
}
