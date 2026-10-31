// Respuestas de /api/atajos/* para Atajos (iPhone), Scriptable y HTTP Shortcuts
// (Android). Texto plano: se muestra tal cual en una notificación o un toast.

import { available, balance, budgetMessage, budgetStatus, type BudgetLevel } from "@/lib/budget";
import { formatDay } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import type { Category, Transaction, WeekBudget } from "@/lib/types";
import { weekPlanMessage, type WeekPlan } from "@/lib/week-plan";

/** Confirmación de un registro con el saldo, y el aviso si la semana va en 80% o más. */
export function shortcutSavedText(
  tx: Pick<Transaction, "type" | "amount" | "description" | "occurred_on">,
  category: Pick<Category, "emoji" | "name"> | undefined,
  today: string,
  week: WeekBudget,
): string {
  const day = tx.occurred_on === today ? "" : ` · ${formatDay(tx.occurred_on, today)}`;
  const lines = [
    `✓ ${tx.type === "income" ? "Ingreso" : "Gasto"} ${formatCOP(Number(tx.amount))}${
      tx.description ? ` · ${tx.description}` : ""
    }`,
    `${category ? `${category.emoji} ${category.name}` : "Sin categoría"}${day}`,
  ];
  const status = budgetStatus(week);
  if (status.level !== "none") lines.push(`Te quedan ${formatCOP(balance(week))}`);
  if (tx.type === "expense" && (status.level === "warning" || status.level === "over")) {
    lines.push(`⚠️ ${budgetMessage(status, week)}`);
  }
  return lines.join("\n");
}

export interface BalanceSnapshot {
  /** Saldo total; sin presupuesto (`nivel: "none"`), lo gastado esta semana. */
  teQuedan: number;
  saldoAnterior: number;
  disponible: number;
  semana: { entro: number; salio: number };
  /** 0 a 1: lo gastado de lo disponible esta semana. */
  porcentaje: number;
  nivel: BudgetLevel;
  /** Lo que se puede gastar por día hasta el domingo, sin los recurrentes que vienen. */
  porDia: number | null;
  /** Recurrentes de aquí al domingo que todavía no cuentan (gastos menos ingresos). */
  comprometido: number;
  /** "Puedes gastar $18.000 por día hasta el domingo" o null. */
  proyeccion: string | null;
  /** Ya formateados, para widgets que no formatean. */
  titulo: string;
  cifra: string;
  detalle: string;
  mensaje: string;
}

/** Saldo para el widget de Scriptable y el botón "Saldo" de Android. */
export function balanceSnapshot(week: WeekBudget, projection?: { plan: WeekPlan; today: string }): BalanceSnapshot {
  const status = budgetStatus(week);
  const hasBudget = status.level !== "none";
  const titulo = hasBudget ? "Te quedan" : "Gastaste esta semana";
  const cifra = formatCOP(hasBudget ? balance(week) : week.expense);
  const detalle = `Esta semana entró ${formatCOP(week.income)} · salió ${formatCOP(week.expense)}`;
  const advice = budgetMessage(status, week);
  const proyeccion = projection ? weekPlanMessage(projection.plan, projection.today) : null;
  return {
    teQuedan: hasBudget ? balance(week) : week.expense,
    saldoAnterior: week.carry,
    disponible: available(week),
    semana: { entro: week.income, salio: week.expense },
    porcentaje: Math.round(status.ratio * 100) / 100,
    nivel: status.level,
    porDia: projection && hasBudget ? projection.plan.perDay : null,
    comprometido: projection?.plan.committed ?? 0,
    proyeccion,
    titulo,
    cifra,
    detalle,
    mensaje: [`${titulo}: ${cifra}`, ...(proyeccion ? [proyeccion] : []), detalle, ...(advice ? [advice] : [])].join(
      "\n",
    ),
  };
}
