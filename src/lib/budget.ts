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

/** Texto del estado del presupuesto; null si no hay nada que decir. */
export function budgetMessage(
  { ratio, level }: BudgetStatus,
  expense: number,
  income: number,
): string | null {
  if (level === "none") return null;
  if (level === "over") return `Te pasaste ${formatCOP(expense - income)} de lo que entró`;
  return `Llevas ${percent.format(ratio)} de lo que entró`;
}
