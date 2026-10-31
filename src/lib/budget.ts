import { formatCOP } from "@/lib/money";
import type { Totals, TxType, WeekBudget } from "@/lib/types";

export type BudgetLevel = "none" | "ok" | "warning" | "over";

export interface BudgetStatus {
  /** Gasto / disponible. 0.85 = llevas 85% de lo disponible esta semana. */
  ratio: number;
  level: BudgetLevel;
}

export const WARNING_AT = 0.8;

/**
 * Lo disponible esta semana: el saldo con que arrancó más lo que entró, y lo
 * movido a préstamos y metas (prestar o apartar lo baja sin contar como gasto).
 */
export const available = ({ carry, income, moved }: WeekBudget) => carry + income + moved;

/** El saldo total: lo disponible menos lo que salió esta semana. */
export const balance = (week: WeekBudget) => available(week) - week.expense;

/**
 * El presupuesto no se reinicia: lo que sobró (o faltó) antes del lunes se
 * suma a lo que entró esta semana. Sin saldo anterior ni ingresos no hay
 * presupuesto con el cual comparar; si los hay y no queda nada disponible (por
 * ejemplo, se prestó todo), ya se pasó.
 */
export function budgetStatus(week: WeekBudget): BudgetStatus {
  const budget = available(week);
  if (budget <= 0) {
    return week.carry === 0 && week.income === 0 ? { ratio: 0, level: "none" } : { ratio: 1, level: "over" };
  }
  const ratio = week.expense / budget;
  const level = ratio >= 1 ? "over" : ratio >= WARNING_AT ? "warning" : "ok";
  return { ratio, level };
}

const percent = new Intl.NumberFormat("es-CO", { style: "percent", maximumFractionDigits: 0 });

/** Desde aquí el mensaje deja de decir "vas bien". */
export const HALF_AT = 0.5;

/**
 * Estado del presupuesto de la semana, en tono neutro y sin regañar.
 * Frase completa sin punto final; null si no hay nada que decir.
 */
export function budgetMessage({ ratio, level }: BudgetStatus, week: WeekBudget): string | null {
  if (level === "none") return null;
  const pct = percent.format(ratio);
  if (level === "over") {
    const left = balance(week);
    return left < 0
      ? `Te pasaste ${formatCOP(-left)} de lo disponible esta semana`
      : "Ya usaste todo lo disponible esta semana";
  }
  if (level === "warning") return `Cuidado: llevas ${pct} de lo disponible esta semana`;
  if (ratio >= HALF_AT) return `Ya llevas el ${pct} de lo disponible esta semana`;
  return `Vas bien: llevas ${pct} de lo disponible esta semana`;
}

const LEVEL_RANK = { none: 0, ok: 1, warning: 2, over: 3 } as const;

/** Nivel que se acaba de cruzar al pasar de `before` a `after` (aviso o exceso), o null. */
export function crossedLevel(before: WeekBudget, after: WeekBudget): "warning" | "over" | null {
  const a = budgetStatus(after).level;
  if (a !== "warning" && a !== "over") return null;
  return LEVEL_RANK[a] > LEVEL_RANK[budgetStatus(before).level] ? a : null;
}

/** true si pasar de `before` a `after` cruza el umbral de aviso o el de exceso. */
export function crossedBudget(before: WeekBudget, after: WeekBudget): boolean {
  return crossedLevel(before, after) !== null;
}

/** Totales de la semana antes de un movimiento, a partir de los de después. */
export function weekBefore<T extends Totals>(after: T, tx: { type: TxType; amount: number }): T {
  return tx.type === "income"
    ? { ...after, income: after.income - tx.amount }
    : { ...after, expense: after.expense - tx.amount };
}
