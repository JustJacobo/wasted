import "server-only";

import { requireUser } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import type { CategoryRule } from "@/lib/quick-add/categorize";
import { frequencyLabel, type Frequency, type Recurring } from "@/lib/recurring";
import { RECURRING_COLUMNS } from "@/lib/recurring-run";
import { periodRange, type PeriodKind, type Report } from "@/lib/report";
import { fetchReport, fetchSummary } from "@/lib/report-data";
import { likePattern } from "@/lib/search";
import { TX_COLUMNS, type Category, type Summary, type Transaction, type TxType } from "@/lib/types";

/**
 * Todas las categorías, incluidas las archivadas (para nombrar movimientos
 * pasados). Donde se elige una categoría, filtrar con `active`.
 */
export async function getCategories(): Promise<Category[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("categories")
    .select("id, key, name, emoji, icon, color, type, monthly_budget, sort, archived")
    .order("sort");
  if (error) throw error;
  return data;
}

/** Solo las categorías que se pueden elegir al registrar. */
export const active = (categories: Category[]) => categories.filter((c) => !c.archived);

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
    .order("occurred_at", { ascending: false, nullsFirst: false })
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

/** Un pendiente de la bandeja, con el movimiento al que se parece (si hay). */
export interface PendingItem extends Transaction {
  provider: string | null;
  /** "Cada mes, el día 1" si salió de un recurrente. */
  frequency: string | null;
  similar: Pick<Transaction, "id" | "description" | "amount" | "occurred_on" | "category_id"> | null;
}

type RuleRef = (Frequency & { starts_on: string }) | null;

/** Importados del correo y recurrentes vencidos que esperan confirmación, del más reciente al más antiguo. */
export async function getPending(): Promise<PendingItem[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("transactions")
    .select(`${TX_COLUMNS}, raw, rule:recurring_id(every, unit, starts_on)`)
    .eq("status", "pending")
    .order("occurred_on", { ascending: false })
    .order("occurred_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  const similarIds = data
    .map((t) => (t.raw as { possibleDuplicateOf?: string } | null)?.possibleDuplicateOf)
    .filter((id): id is string => Boolean(id));
  const { data: similar } = similarIds.length
    ? await supabase
        .from("transactions")
        .select("id, description, amount, occurred_on, category_id")
        .in("id", similarIds)
    : { data: [] };
  const byId = new Map((similar ?? []).map((t) => [t.id, t]));

  return data.map(({ raw, rule, ...tx }) => {
    const meta = (raw ?? {}) as { provider?: string; possibleDuplicateOf?: string };
    const ref = rule as unknown as RuleRef;
    return {
      ...tx,
      provider: meta.provider ?? null,
      frequency: ref && tx.source === "recurring" ? frequencyLabel(ref.starts_on, ref) : null,
      similar: meta.possibleDuplicateOf ? (byId.get(meta.possibleDuplicateOf) ?? null) : null,
    };
  });
}

export async function getPendingCount(): Promise<number> {
  const { supabase } = await requireUser();
  const { count, error } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw error;
  return count ?? 0;
}

/** Recurrentes del usuario: activos primero, por próxima fecha. */
export async function getRecurring(): Promise<Recurring[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("recurring")
    .select(RECURRING_COLUMNS)
    .order("paused")
    .order("next_on")
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function getRecurringRule(id: string): Promise<Recurring | null> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("recurring").select(RECURRING_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export interface HistoryFilters {
  /** "YYYY-MM" */
  month: string;
  type: TxType | null;
  categoryId: string | null;
  query: string;
}

/** Movimientos confirmados de un mes con filtros opcionales, del más reciente al más antiguo. */
export async function getTransactionsForMonth(filters: HistoryFilters): Promise<Transaction[]> {
  const { supabase } = await requireUser();
  const { start, end } = periodRange("mes", `${filters.month}-01`);
  let query = supabase
    .from("transactions")
    .select(TX_COLUMNS)
    .eq("status", "confirmed")
    .gte("occurred_on", start)
    .lte("occurred_on", end);
  if (filters.type) query = query.eq("type", filters.type);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.query.trim()) query = query.ilike("description", likePattern(filters.query));

  const { data, error } = await query
    .order("occurred_on", { ascending: false })
    .order("occurred_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return data;
}

/** Reporte del periodo que contiene `anchor`, comparado con el anterior. */
export async function getReport(kind: PeriodKind, anchor: string, today: string): Promise<Report> {
  const { supabase } = await requireUser();
  return fetchReport(supabase, kind, anchor, today);
}

/** Ingresos y gastos confirmados de la semana (lunes a hoy) y del mes en curso. */
export async function getSummary(today: string = todayIn()): Promise<Summary> {
  const { supabase } = await requireUser();
  return fetchSummary(supabase, today);
}
