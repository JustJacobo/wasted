import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, startOfMonth, startOfWeek } from "@/lib/dates";
import { RECURRING_COLUMNS, type Recurring } from "@/lib/recurring";
import { buildReport, periodRange, previousRange, type PeriodKind, type Report } from "@/lib/report";
import type { Summary, Totals, WeekBudget } from "@/lib/types";
import { upcomingCharges, type LinkedCharge, type UpcomingCharge } from "@/lib/week-plan";

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
 * lo movido a préstamos y metas en la semana, y el saldo con que arrancó.
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
  let movesQuery = supabase.from("balance_moves").select("amount").gte("occurred_on", week).lte("occurred_on", today);
  if (userId) {
    query = query.eq("user_id", userId);
    movesQuery = movesQuery.eq("user_id", userId);
  }
  const [{ data, error }, { data: moves, error: movesError }, { data: before, error: beforeError }] =
    await Promise.all([
      query,
      movesQuery,
      supabase
        .rpc("totals_before", { p_before: week, p_user: userId ?? null })
        .single<Totals & { moved: number }>(),
    ]);
  if (error) throw error;
  if (movesError) throw movesError;
  if (beforeError) throw beforeError;

  return {
    week: { ...sumSince(data, week), moved: (moves ?? []).reduce((sum, m) => sum + Number(m.amount), 0) },
    month: sumSince(data, month),
    carry: Number(before.income) - Number(before.expense) + Number(before.moved),
  };
}

/** Cuántos días adelante se miran los recurrentes (siempre alcanza al domingo). */
export const UPCOMING_DAYS = 7;

/**
 * Lo que viene de los recurrentes en los próximos días y lo que ya venció y
 * espera en la bandeja. Con el cliente de servicio hay que pasar `userId`.
 */
export async function fetchUpcoming(
  supabase: SupabaseClient,
  today: string,
  userId?: string,
): Promise<UpcomingCharge[]> {
  let rulesQuery = supabase.from("recurring").select(RECURRING_COLUMNS).eq("paused", false);
  // Los confirmados recientes sirven para no contar otra vez una fecha que ya se pagó.
  let linkedQuery = supabase
    .from("transactions")
    .select("id, recurring_id, status, type, amount, description, category_id, occurred_on")
    .not("recurring_id", "is", null)
    .or(`status.eq.pending,and(status.eq.confirmed,occurred_on.gte.${addDays(today, -7)})`);
  if (userId) {
    rulesQuery = rulesQuery.eq("user_id", userId);
    linkedQuery = linkedQuery.eq("user_id", userId);
  }
  const [{ data: rules, error }, { data: linked, error: linkedError }] = await Promise.all([rulesQuery, linkedQuery]);
  if (error) throw error;
  if (linkedError) throw linkedError;
  return upcomingCharges(rules as Recurring[], linked as LinkedCharge[], today, addDays(today, UPCOMING_DAYS));
}

/** Lo que miden la mecha y los avisos: la semana con el saldo anterior. */
export function weekBudget({ week, carry }: Summary): WeekBudget {
  return { ...week, carry };
}
