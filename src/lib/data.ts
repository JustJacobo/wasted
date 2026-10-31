import "server-only";

import { requireUser } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import type { CategoryRule } from "@/lib/quick-add/categorize";
import { frequencyLabel, RECURRING_COLUMNS, type Frequency, type Recurring } from "@/lib/recurring";
import { periodRange, type PeriodKind, type Report } from "@/lib/report";
import { fetchReport, fetchSummary, fetchUpcoming } from "@/lib/report-data";
import { summarizeGoals, summarizeLoans, type BalanceMove, type Goal, type Loan } from "@/lib/money-moves";
import { likePattern } from "@/lib/search";
import { TX_COLUMNS, type Category, type Summary, type Transaction, type TxType } from "@/lib/types";
import type { UpcomingCharge } from "@/lib/week-plan";

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
  /** "Cada mes, el día 1" si salió de un recurrente o es su cobro del correo. */
  frequency: string | null;
  /** Monto del recurrente al que está unido (para avisar si el cobro cambió). */
  ruleAmount: number | null;
  similar: Pick<Transaction, "id" | "description" | "amount" | "occurred_on" | "category_id"> | null;
}

type RuleRef = (Frequency & { starts_on: string; amount: number }) | null;

/** Importados del correo y recurrentes vencidos que esperan confirmación, del más reciente al más antiguo. */
export async function getPending(): Promise<PendingItem[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("transactions")
    .select(`${TX_COLUMNS}, raw, rule:recurring_id(every, unit, starts_on, amount)`)
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
        // Lo descartado (o retirado al juntarse con su correo) ya no es un posible repetido.
        .neq("status", "discarded")
    : { data: [] };
  const byId = new Map((similar ?? []).map((t) => [t.id, t]));

  return data.map(({ raw, rule, ...tx }) => {
    const meta = (raw ?? {}) as { provider?: string; possibleDuplicateOf?: string };
    const ref = rule as unknown as RuleRef;
    return {
      ...tx,
      provider: meta.provider ?? null,
      frequency: ref ? frequencyLabel(ref.starts_on, ref) : null,
      ruleAmount: ref ? Number(ref.amount) : null,
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

const MOVE_COLUMNS = "id, loan_id, goal_id, amount, occurred_on, created_at";

/** Préstamos con lo pendiente y su historial; abiertos primero. */
export async function getLoans() {
  const { supabase } = await requireUser();
  const [{ data: loans, error }, { data: moves, error: movesError }] = await Promise.all([
    supabase.from("loans").select("id, person, direction, created_at, closed_at").order("created_at", { ascending: false }).limit(300),
    supabase
      .from("balance_moves")
      .select(MOVE_COLUMNS)
      .not("loan_id", "is", null)
      .order("occurred_on", { ascending: false })
      .limit(5000),
  ]);
  if (error) throw error;
  if (movesError) throw movesError;
  return summarizeLoans(loans as Loan[], moves as BalanceMove[]);
}

/** Metas con lo apartado; activas primero. */
export async function getGoals() {
  const { supabase } = await requireUser();
  const [{ data: goals, error }, { data: moves, error: movesError }] = await Promise.all([
    supabase.from("goals").select("id, name, target, archived, created_at").order("created_at", { ascending: false }),
    supabase
      .from("balance_moves")
      .select(MOVE_COLUMNS)
      .not("goal_id", "is", null)
      .order("occurred_on", { ascending: false })
      .limit(5000),
  ]);
  if (error) throw error;
  if (movesError) throw movesError;
  return summarizeGoals(goals as Goal[], moves as BalanceMove[]);
}

/** Para el inicio: cuánto te deben, cuánto debes y cuánto hay apartado en metas. */
export async function getMoneyOverview(): Promise<{ owedToMe: number; iOwe: number; saved: number }> {
  const { supabase } = await requireUser();
  // Solo lo abierto: préstamos sin saldar y metas activas (las archivadas están vacías).
  const [{ data: loans, error }, { data: goals, error: goalsError }] = await Promise.all([
    supabase.from("loans").select("id, person, direction, created_at, closed_at").is("closed_at", null),
    supabase.from("goals").select("id").eq("archived", false),
  ]);
  if (error) throw error;
  if (goalsError) throw goalsError;
  if (!loans.length && !goals.length) return { owedToMe: 0, iOwe: 0, saved: 0 };
  const owners = [
    ...loans.map((l) => `loan_id.eq.${l.id}`),
    ...goals.map((g) => `goal_id.eq.${g.id}`),
  ].join(",");
  const { data: moves, error: movesError } = await supabase.from("balance_moves").select(MOVE_COLUMNS).or(owners);
  if (movesError) throw movesError;
  const { owedToMe, iOwe } = summarizeLoans(loans as Loan[], moves as BalanceMove[]);
  const saved = -(moves as BalanceMove[]).filter((m) => m.goal_id).reduce((sum, m) => sum + Number(m.amount), 0);
  return { owedToMe, iOwe, saved: Math.max(0, saved) };
}

/** Recurrentes de los próximos días y los vencidos que esperan en la bandeja. */
export async function getUpcoming(today: string): Promise<UpcomingCharge[]> {
  const { supabase } = await requireUser();
  return fetchUpcoming(supabase, today);
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

/** Todos los movimientos confirmados, del más antiguo al más reciente (para exportar). */
export async function getAllTransactions(): Promise<Transaction[]> {
  const { supabase } = await requireUser();
  const page = 1000; // lo máximo que Supabase devuelve por consulta
  const all: Transaction[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from("transactions")
      .select(TX_COLUMNS)
      .eq("status", "confirmed")
      .order("occurred_on")
      .order("occurred_at", { nullsFirst: true })
      .order("created_at")
      .order("id")
      .range(from, from + page - 1);
    if (error) throw error;
    all.push(...data);
    if (data.length < page) return all;
  }
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
