// Cuánto se puede gastar por día hasta el domingo, descontando los cobros
// recurrentes que vienen. Puro: fechas "YYYY-MM-DD" como en dates.ts.

import { balance, budgetStatus } from "@/lib/budget";
import { addDays, daysBetween, startOfWeek, weekday } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import { nextAfter, type Recurring } from "@/lib/recurring";
import { linkWindow } from "@/lib/recurring-match";
import type { TxType, WeekBudget } from "@/lib/types";

/** Un cobro (o ingreso) recurrente que todavía no cuenta en el saldo. */
export interface UpcomingCharge {
  day: string;
  type: TxType;
  amount: number;
  description: string;
  categoryId: string | null;
  ruleId: string;
  /** Ya venció y espera en la bandeja: no cuenta hasta confirmarlo. */
  pending: boolean;
}

/** Un movimiento ya unido a un recurrente (`recurring_id`). */
export interface LinkedCharge {
  id: string;
  recurring_id: string;
  status: "pending" | "confirmed";
  type: TxType;
  amount: number;
  description: string;
  category_id: string | null;
  occurred_on: string;
}

/** Tope de fechas por regla, para que una diaria no llene la lista. */
const MAX_PER_RULE = 14;

/**
 * Lo que viene de los recurrentes entre hoy y `until`: los pendientes de la
 * bandeja (ya vencidos) y las próximas fechas de cada regla activa. Una fecha
 * se omite si ya tiene un movimiento unido cerca (el correo llegó antes), así
 * no se cuenta dos veces.
 */
export function upcomingCharges(
  rules: Recurring[],
  linked: LinkedCharge[],
  today: string,
  until: string,
): UpcomingCharge[] {
  const items: UpcomingCharge[] = linked
    .filter((tx) => tx.status === "pending")
    .map((tx) => ({
      day: tx.occurred_on,
      type: tx.type,
      amount: Number(tx.amount),
      description: tx.description,
      categoryId: tx.category_id,
      ruleId: tx.recurring_id,
      pending: true,
    }));

  for (const rule of rules) {
    if (rule.paused) continue;
    const near = linked.filter((tx) => tx.recurring_id === rule.id);
    let day = rule.next_on;
    for (let i = 0; day <= until && i < MAX_PER_RULE; i++, day = nextAfter(rule.starts_on, rule, day)) {
      if (near.some((tx) => Math.abs(daysBetween(day, tx.occurred_on)) <= linkWindow(rule))) continue;
      items.push({
        // Lo vencido que el cron aún no generó se debe desde hoy.
        day: day < today ? today : day,
        type: rule.type,
        amount: Number(rule.amount),
        description: rule.description,
        categoryId: rule.category_id,
        ruleId: rule.id,
        pending: false,
      });
    }
  }

  return items.sort((a, b) => (a.day === b.day ? Number(b.pending) - Number(a.pending) : a.day < b.day ? -1 : 1));
}

export interface WeekPlan {
  /** Lo que queda (el saldo). */
  left: number;
  /** Gastos recurrentes hasta el domingo menos los ingresos recurrentes. */
  committed: number;
  /** Lo que queda sin lo comprometido. */
  free: number;
  /** Días de hoy al domingo, contando hoy. */
  daysLeft: number;
  /** `free` repartido en los días que faltan, redondeado hacia abajo a $100. */
  perDay: number;
  /** Día en que se acaba al ritmo de la semana, si es antes del domingo. */
  runsOutOn: string | null;
  hasBudget: boolean;
}

export function weekPlan(week: WeekBudget, today: string, upcoming: UpcomingCharge[]): WeekPlan {
  const monday = startOfWeek(today);
  const sunday = addDays(monday, 6);
  const daysLeft = daysBetween(today, sunday) + 1;
  const committed = upcoming
    .filter((c) => c.day <= sunday)
    .reduce((sum, c) => sum + (c.type === "expense" ? c.amount : -c.amount), 0);
  const left = balance(week);
  const free = left - committed;
  const perDay = free > 0 ? Math.floor(free / daysLeft / 100) * 100 : 0;

  // El ritmo solo dice algo desde el martes: el lunes llega la cuota y se gasta distinto.
  const elapsed = daysBetween(monday, today) + 1;
  let runsOutOn: string | null = null;
  if (elapsed >= 2 && week.expense > 0 && free > 0) {
    const covered = Math.floor(free / (week.expense / elapsed));
    if (covered < daysLeft - 1) runsOutOn = addDays(today, covered);
  }

  return { left, committed, free, daysLeft, perDay, runsOutOn, hasBudget: budgetStatus(week).level !== "none" };
}

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/**
 * Una frase, sin punto final y sin regañar. null si no hay presupuesto o si ya
 * no queda nada (de eso habla el aviso del presupuesto).
 */
export function weekPlanMessage(plan: WeekPlan, today: string): string | null {
  if (!plan.hasBudget || plan.left <= 0) return null;
  if (plan.free <= 0) return "Lo que queda ya está comprometido en cobros de esta semana";
  if (plan.runsOutOn) {
    return plan.runsOutOn === today
      ? "A este ritmo te alcanza solo para hoy"
      : `A este ritmo te alcanza hasta el ${WEEKDAYS[weekday(plan.runsOutOn)]}`;
  }
  if (plan.perDay < 100) return null;
  return plan.daysLeft === 1
    ? `Hoy puedes gastar ${formatCOP(plan.perDay)}`
    : `Puedes gastar ${formatCOP(plan.perDay)} por día hasta el domingo`;
}
