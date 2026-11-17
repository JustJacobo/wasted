import { todayIn } from "@/lib/dates";
import type { Transaction, WeekBudget } from "@/lib/types";
import type { UpcomingCharge } from "@/lib/week-plan";
import type { HomeData } from "@/core/types";

/**
 * El inicio como queda después de guardar, sin esperar a recargarlo: el saldo
 * de la semana viene del servidor (`week`), el movimiento va primero en la
 * lista y el recurrente pagado sale de "Próximos". Después se recarga detrás.
 */
export function homeAfterSave(home: HomeData, transaction: Transaction, week: WeekBudget, paid: UpcomingCharge | null): HomeData {
  const { carry, income, expense, moved } = week;
  const amount = Number(transaction.amount);
  const sameMonth = transaction.occurred_on.slice(0, 7) === todayIn().slice(0, 7);
  const month = { ...home.summary.month };
  if (sameMonth) month[transaction.type === "income" ? "income" : "expense"] += amount;
  return {
    ...home,
    summary: { ...home.summary, week: { income, expense, moved }, month, carry },
    // En su día (más reciente primero): un gasto de ayer no queda encima de "Hoy".
    transactions: [transaction, ...home.transactions.filter((t) => t.id !== transaction.id)].sort((a, b) =>
      b.occurred_on.localeCompare(a.occurred_on),
    ),
    upcoming: paid ? home.upcoming.filter((c) => !(c.ruleId === paid.ruleId && c.occurrence === paid.occurrence)) : home.upcoming,
    pendingCount: paid?.pending ? Math.max(0, home.pendingCount - 1) : home.pendingCount,
  };
}
