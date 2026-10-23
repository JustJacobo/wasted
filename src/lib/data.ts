import "server-only";

import { requireUser } from "@/lib/auth";
import { startOfMonth, startOfWeek, todayIn } from "@/lib/dates";
import type { CategoryRule } from "@/lib/quick-add/categorize";
import {
  buildReport,
  periodRange,
  previousRange,
  type PeriodKind,
  type Report,
} from "@/lib/report";
import type { Category, Summary, Totals, Transaction } from "@/lib/types";

const TX_COLUMNS =
  "id, type, amount, description, merchant, category_id, account_id, occurred_on, source, status, created_at";

export async function getCategories(): Promise<Category[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("categories")
    .select("id, key, name, emoji, type, monthly_budget, sort")
    .eq("archived", false)
    .order("sort");
  if (error) throw error;
  return data;
}

export async function getRules(): Promise<CategoryRule[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("category_rules").select("keyword, category_id");
  if (error) throw error;
  return data;
}

export async function getRecentTransactions(limit = 60): Promise<Transaction[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("transactions")
    .select(TX_COLUMNS)
    .eq("status", "confirmed")
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function getTransaction(id: string): Promise<Transaction | null> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("transactions")
    .select(TX_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Reporte del periodo que contiene `anchor`, comparado con el anterior. */
export async function getReport(kind: PeriodKind, anchor: string, today: string): Promise<Report> {
  const { supabase } = await requireUser();
  const range = periodRange(kind, anchor);
  const prev = previousRange(kind, range);
  const [{ data, error }, categories] = await Promise.all([
    supabase
      .from("transactions")
      .select("type, amount, category_id, occurred_on")
      .eq("status", "confirmed")
      .gte("occurred_on", prev.start)
      .lte("occurred_on", range.end),
    getCategories(),
  ]);
  if (error) throw error;
  return buildReport(kind, anchor, today, data, categories);
}

function sumSince(rows: Pick<Transaction, "type" | "amount" | "occurred_on">[], since: string): Totals {
  const totals: Totals = { income: 0, expense: 0 };
  for (const row of rows) {
    if (row.occurred_on >= since) totals[row.type] += Number(row.amount);
  }
  return totals;
}

/** Ingresos y gastos confirmados de la semana (lunes a hoy) y del mes en curso. */
export async function getSummary(today: string = todayIn()): Promise<Summary> {
  const { supabase } = await requireUser();
  const week = startOfWeek(today);
  const month = startOfMonth(today);
  const since = week < month ? week : month;

  const { data, error } = await supabase
    .from("transactions")
    .select("type, amount, occurred_on")
    .eq("status", "confirmed")
    .gte("occurred_on", since)
    .lte("occurred_on", today);
  if (error) throw error;

  return { week: sumSince(data, week), month: sumSince(data, month) };
}
