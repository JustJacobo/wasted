import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { startOfMonth, startOfWeek } from "@/lib/dates";
import { buildReport, periodRange, previousRange, type PeriodKind, type Report } from "@/lib/report";
import type { Summary, Totals } from "@/lib/types";

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
  let catQuery = supabase.from("categories").select("id, name, emoji, icon");
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

/** Ingresos y gastos confirmados de la semana (lunes a hoy) y del mes en curso. */
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
  const { data, error } = await query;
  if (error) throw error;

  return { week: sumSince(data, week), month: sumSince(data, month) };
}
