import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { startOfMonth, startOfWeek } from "@/lib/dates";
import { buildReport, periodRange, previousRange, type PeriodKind, type Report } from "@/lib/report";
import type { Summary, Totals, WeekBudget } from "@/lib/types";

/**
 * Reporte del periodo que contiene `anchor`. Con el cliente de sesión, RLS ya
 * limita al usuario; con el cliente de servicio hay que pasar `userId`.
 */
export async function fetchReport(
  supabase: SupabaseClient,
  kind: PeriodKind,
  anchor: string,
  today: string,
  userId?: string,
): Promise<Report> {
  const range = periodRange(kind, anchor);
  const prev = previousRange(kind, range);

  let txQuery = supabase
    .from("transactions")
    .select("type, amount, category_id, occurred_on")
    .eq("status", "confirmed")
    .gte("occurred_on", prev.start)
    .lte("occurred_on", range.end);
  let catQuery = supabase.from("categories").select("id, name, emoji, icon, color");
  if (userId) {
    txQuery = txQuery.eq("user_id", userId);
    catQuery = catQuery.eq("user_id", userId);
  }

  const [{ data: transactions, error }, { data: categories, error: catError }] = await Promise.all([
    txQuery,
    catQuery,
  ]);
  if (error) throw error;
  if (catError) throw catError;
  return buildReport(kind, anchor, today, transactions, categories);
}

function sumSince(rows: { type: "expense" | "income"; amount: number; occurred_on: string }[], since: string): Totals {
  const totals: Totals = { income: 0, expense: 0 };
  for (const row of rows) {
    if (row.occurred_on >= since) totals[row.type] += Number(row.amount);
  }
  return totals;
}

/**
 * Ingresos y gastos confirmados de la semana (lunes a hoy) y del mes en curso,
 * más el saldo con que arrancó la semana.
 */
export async function fetchSummary(
  supabase: SupabaseClient,
  today: string,
  userId?: string,
): Promise<Summary> {
  const week = startOfWeek(today);
  const month = startOfMonth(today);
  const since = week < month ? week : month;

  let query = supabase
    .from("transactions")
    .select("type, amount, occurred_on")
    .eq("status", "confirmed")
    .gte("occurred_on", since)
    .lte("occurred_on", today);
  if (userId) query = query.eq("user_id", userId);
  const [{ data, error }, { data: before, error: beforeError }] = await Promise.all([
    query,
    supabase.rpc("totals_before", { p_before: week, p_user: userId ?? null }).single<Totals>(),
  ]);
  if (error) throw error;
  if (beforeError) throw beforeError;

  return {
    week: sumSince(data, week),
    month: sumSince(data, month),
    carry: Number(before.income) - Number(before.expense),
  };
}

/** Lo que miden la mecha y los avisos: la semana con el saldo anterior. */
export function weekBudget({ week, carry }: Summary): WeekBudget {
  return { ...week, carry };
}
