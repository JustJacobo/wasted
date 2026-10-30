import { addDays, lastDayOfMonth, startOfMonth, startOfWeek } from "@/lib/dates";
import type { TxType } from "@/lib/types";

export type PeriodKind = "semana" | "mes";

export interface Range {
  /** Primer día, inclusive ("YYYY-MM-DD"). */
  start: string;
  /** Último día, inclusive. */
  end: string;
}

export interface ReportTx {
  type: TxType;
  amount: number;
  category_id: string | null;
  occurred_on: string;
}

export interface ReportCategory {
  id: string;
  name: string;
  emoji: string;
  icon?: string | null;
  color?: string | null;
}

export interface CategorySlice {
  category: ReportCategory | null;
  amount: number;
  /** Fracción del gasto total del periodo, 0–1. */
  share: number;
  previous: number;
}

export interface Report {
  range: Range;
  previousRange: Range;
  income: number;
  expense: number;
  previousIncome: number;
  previousExpense: number;
  /** Gasto por día, un elemento por cada día del periodo. */
  days: { day: string; expense: number }[];
  /** Promedio diario de gasto sobre los días transcurridos del periodo. */
  dailyAverage: number;
  byCategory: CategorySlice[];
}

export function periodRange(kind: PeriodKind, anchor: string): Range {
  if (kind === "semana") {
    const start = startOfWeek(anchor);
    return { start, end: addDays(start, 6) };
  }
  return { start: startOfMonth(anchor), end: lastDayOfMonth(anchor) };
}

export function previousRange(kind: PeriodKind, range: Range): Range {
  return periodRange(kind, addDays(range.start, -1));
}

export function nextRange(kind: PeriodKind, range: Range): Range {
  return periodRange(kind, addDays(range.end, 1));
}

/** Días entre start y end, ambos inclusive. */
export function eachDay({ start, end }: Range): string[] {
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}

/** Variación relativa (0.2 = +20%). null si no hay base para comparar. */
export function deltaRatio(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / previous;
}

export function buildReport(
  kind: PeriodKind,
  anchor: string,
  today: string,
  transactions: ReportTx[],
  categories: ReportCategory[],
): Report {
  const range = periodRange(kind, anchor);
  const prev = previousRange(kind, range);
  const within = (t: ReportTx, r: Range) => t.occurred_on >= r.start && t.occurred_on <= r.end;
  const current = transactions.filter((t) => within(t, range));
  const before = transactions.filter((t) => within(t, prev));

  const sum = (txs: ReportTx[], type: TxType) =>
    txs.filter((t) => t.type === type).reduce((s, t) => s + Number(t.amount), 0);

  const expense = sum(current, "expense");

  const perDay = new Map<string, number>();
  for (const t of current) {
    if (t.type === "expense") perDay.set(t.occurred_on, (perDay.get(t.occurred_on) ?? 0) + Number(t.amount));
  }
  const days = eachDay(range).map((day) => ({ day, expense: perDay.get(day) ?? 0 }));

  // En el periodo en curso, el promedio solo cuenta los días ya vividos.
  const elapsed = days.filter((d) => d.day <= today).length || days.length;

  const byId = new Map(categories.map((c) => [c.id, c]));
  const totals = new Map<string | null, { amount: number; previous: number }>();
  const add = (txs: ReportTx[], field: "amount" | "previous") => {
    for (const t of txs) {
      if (t.type !== "expense") continue;
      const key = t.category_id && byId.has(t.category_id) ? t.category_id : null;
      const entry = totals.get(key) ?? { amount: 0, previous: 0 };
      entry[field] += Number(t.amount);
      totals.set(key, entry);
    }
  };
  add(current, "amount");
  add(before, "previous");

  const byCategory = [...totals]
    .filter(([, v]) => v.amount > 0)
    .map(([id, v]) => ({
      category: id ? byId.get(id)! : null,
      amount: v.amount,
      share: expense ? v.amount / expense : 0,
      previous: v.previous,
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    range,
    previousRange: prev,
    income: sum(current, "income"),
    expense,
    previousIncome: sum(before, "income"),
    previousExpense: sum(before, "expense"),
    days,
    dailyAverage: Math.round(expense / elapsed),
    byCategory,
  };
}

export interface CompositionSegment {
  /** id de la categoría, o "otras" para el grupo que junta el resto. */
  key: string;
  label: string;
  /** Clave de color de la categoría; null = gris. */
  color: string | null;
  amount: number;
  share: number;
}

/**
 * Segmentos del gráfico de composición del gasto: las categorías con color más
 * grandes (hasta `named`) y un grupo gris con el resto. Las grises ("Varios",
 * "Sin categoría") van al grupo, así no hay dos segmentos grises.
 */
export function compositionSegments(slices: CategorySlice[], named = 5): CompositionSegment[] {
  const colored = slices.filter((s) => s.category?.color);
  const shown = colored.slice(0, named);
  const rest = slices.filter((s) => !shown.includes(s));

  const segments: CompositionSegment[] = shown.map((s) => ({
    key: s.category!.id,
    label: s.category!.name,
    color: s.category!.color!,
    amount: s.amount,
    share: s.share,
  }));
  if (rest.length > 0) {
    // Un solo sobrante conserva su nombre; si son varios, se nombran como grupo.
    const only = rest.length === 1 ? rest[0] : null;
    segments.push({
      key: only?.category?.id ?? "otras",
      label: only ? (only.category?.name ?? "Sin categoría") : "Otras",
      color: only?.category?.color ?? null,
      amount: rest.reduce((sum, s) => sum + s.amount, 0),
      share: rest.reduce((sum, s) => sum + s.share, 0),
    });
  }
  return segments;
}
