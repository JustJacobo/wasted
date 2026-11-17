// Los pagos fijos de un periodo (el mes del Plan): cada fecha de cada
// recurrente con su estado. Puro: recibe las reglas y lo ya unido a ellas.

import { addDays, daysBetween, formatShortDay } from "@/lib/dates";
import { firstOnOrAfter, nextAfter, type Recurring } from "@/lib/recurring";
import { linkWindow } from "@/lib/recurring-match";
import type { TxType } from "@/lib/types";
import type { LinkedCharge } from "@/lib/week-plan";

export type ScheduleStatus =
  /** Ya se registró (confirmado). */
  | "paid"
  /** Espera en Por revisar. */
  | "pending"
  /** Ya pasó la fecha y aún no se genera (el cron lo hace a las 6:00 o al abrir la app). */
  | "overdue"
  | "upcoming"
  /** La fecha pasó sin movimiento unido: se omitió ("Esta vez no") o se registró aparte. */
  | "skipped";

export interface ScheduledCharge {
  ruleId: string;
  /** La fecha de la serie. */
  occurrence: string;
  /** La que se muestra: la del movimiento si ya existe, si no la de la serie. */
  day: string;
  type: TxType;
  amount: number;
  description: string;
  categoryId: string | null;
  status: ScheduleStatus;
  /** El movimiento unido (pagado o pendiente). */
  txId: string | null;
  /** Se puede marcar pagado ahora: un pendiente, o la próxima fecha del recurrente. */
  payable: boolean;
  /** Fechas siguientes de este recurrente en el periodo que no se listan (una diaria tendría 30 filas). */
  more: number;
}

export interface ScheduleTotals {
  /** Todo lo del periodo, sin lo omitido. */
  total: number;
  paid: number;
  left: number;
}

export interface Schedule {
  items: ScheduledCharge[];
  expense: ScheduleTotals;
  income: ScheduleTotals;
}

/** El estado de una fecha en palabras: "Pagado el 17 nov", "Por confirmar", "Mañana"… */
export function scheduleLabel(c: Pick<ScheduledCharge, "status" | "day">, today: string): string {
  switch (c.status) {
    case "paid":
      return c.day === today ? "Pagado hoy" : `Pagado el ${formatShortDay(c.day)}`;
    case "pending":
      return "Por confirmar";
    case "overdue":
      return `Venció el ${formatShortDay(c.day)}`;
    case "skipped":
      return `Omitido el ${formatShortDay(c.day)}`;
    default:
      return c.day === today ? "Hoy" : c.day === addDays(today, 1) ? "Mañana" : formatShortDay(c.day);
  }
}

/** Tope de fechas por recurrente en el periodo, para que una diaria no llene la lista. */
const MAX_PER_RULE = 31;

/**
 * Las fechas entre `from` y `to` de cada recurrente activo, unidas a su
 * movimiento si ya lo tienen (±`linkWindow` días, el más cercano). Los
 * pendientes de antes del periodo también entran: siguen por confirmar.
 */
export function schedule(rules: Recurring[], linked: LinkedCharge[], from: string, to: string, today: string): Schedule {
  const used = new Set<string>();
  const items: ScheduledCharge[] = [];

  for (const rule of rules) {
    if (rule.paused) continue;
    const own = linked.filter((tx) => tx.recurring_id === rule.id);
    const window = linkWindow(rule);
    // De lo que aún no vence, solo la primera fecha se paga ahora; lo vencido, todo.
    let upcomingSeen = false;
    let day = firstOnOrAfter(rule.starts_on, rule, from);
    for (let i = 0; day <= to && i < MAX_PER_RULE; i++, day = nextAfter(rule.starts_on, rule, day)) {
      const occurrence = day;
      const free = own.filter((t) => !used.has(t.id));
      // Un pago adelantado dice qué fecha cubre; si no, el movimiento más cercano dentro de la ventana.
      const tx =
        free.find((t) => t.paid_occurrence === occurrence) ??
        free
          .filter((t) => !t.paid_occurrence && Math.abs(daysBetween(occurrence, t.occurred_on)) <= window)
          .sort((a, b) => Math.abs(daysBetween(occurrence, a.occurred_on)) - Math.abs(daysBetween(occurrence, b.occurred_on)))[0];
      if (tx) used.add(tx.id);
      const status: ScheduleStatus = tx
        ? tx.status === "confirmed"
          ? "paid"
          : "pending"
        : occurrence < rule.next_on
          ? "skipped"
          : occurrence < today
            ? "overdue"
            : "upcoming";
      const firstUpcoming = status === "upcoming" && !upcomingSeen;
      if (status === "upcoming") upcomingSeen = true;
      items.push({
        ruleId: rule.id,
        occurrence,
        day: tx ? tx.occurred_on : occurrence,
        // El movimiento manda (la regla pudo cambiar de tipo después).
        type: tx?.type ?? rule.type,
        amount: tx ? Number(tx.amount) : Number(rule.amount),
        description: (tx?.status === "pending" && tx.description) || rule.description,
        categoryId: tx?.category_id ?? rule.category_id,
        status,
        txId: tx?.id ?? null,
        payable: status === "pending" || status === "overdue" || firstUpcoming,
        more: 0,
      });
    }
  }

  // Pendientes que no cayeron en una fecha del periodo (de un mes anterior, o de un recurrente en pausa).
  for (const tx of linked) {
    if (tx.status !== "pending" || used.has(tx.id)) continue;
    items.push({
      ruleId: tx.recurring_id,
      occurrence: tx.occurred_on,
      day: tx.occurred_on,
      type: tx.type,
      amount: Number(tx.amount),
      description: tx.description,
      categoryId: tx.category_id,
      status: "pending",
      txId: tx.id,
      payable: true,
      more: 0,
    });
  }

  items.sort((a, b) => (a.day === b.day ? a.description.localeCompare(b.description) : a.day < b.day ? -1 : 1));

  // Los totales son del periodo y cuentan todas las fechas: un pendiente de un mes anterior se ve en
  // la lista pero no suma aquí.
  const totals = (type: TxType): ScheduleTotals => {
    const counted = items.filter((c) => c.type === type && c.status !== "skipped" && c.occurrence >= from);
    const total = counted.reduce((sum, c) => sum + c.amount, 0);
    const paid = counted.filter((c) => c.status === "paid").reduce((sum, c) => sum + c.amount, 0);
    return { total, paid, left: total - paid };
  };
  // La lista muestra lo pagado, lo pendiente o vencido y la próxima fecha de cada recurrente; las
  // siguientes se resumen en esa fila (`more`).
  const visible = items.filter((c) => c.status !== "upcoming" || c.payable);
  for (const c of visible) {
    if (c.status === "upcoming") c.more = items.filter((o) => o.ruleId === c.ruleId && o.status === "upcoming" && !o.payable).length;
  }
  return { items: visible, expense: totals("expense"), income: totals("income") };
}
