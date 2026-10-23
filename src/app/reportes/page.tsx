import Link from "next/link";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getCategories } from "@/lib/data";
import { todayIn } from "@/lib/dates";
import { buildReport, periodRange, previousRange, type PeriodKind } from "@/lib/report";
import { CategoryBars } from "./category-bars";
import { DailyChart } from "./daily-chart";
import { PeriodNav } from "./period-nav";
import { StatTiles } from "./stat-tiles";

export default async function ReportsPage({ searchParams }: PageProps<"/reportes">) {
  const params = await searchParams;
  const today = todayIn();
  const kind: PeriodKind = params.periodo === "mes" ? "mes" : "semana";
  const requested = z.iso.date().safeParse(params.fecha);
  // No se navega al futuro: una fecha posterior a hoy vuelve al periodo actual.
  const anchor = requested.success && requested.data <= today ? requested.data : today;

  const range = periodRange(kind, anchor);
  const prev = previousRange(kind, range);

  const { supabase } = await requireUser();
  const [{ data: transactions, error }, categories] = await Promise.all([
    supabase
      .from("transactions")
      .select("type, amount, category_id, occurred_on")
      .eq("status", "confirmed")
      .gte("occurred_on", prev.start)
      .lte("occurred_on", range.end),
    getCategories(),
  ]);
  if (error) throw error;

  const report = buildReport(kind, anchor, today, transactions, categories);
  const periodName = kind === "semana" ? "la semana anterior" : "el mes anterior";
  const empty = report.expense === 0 && report.income === 0;

  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center gap-2 py-2">
        <Link href="/" className="rounded-lg px-2 py-1 text-sm text-muted active:scale-[0.97]">
          ← Volver
        </Link>
        <h1 className="flex-1 text-right text-lg font-bold tracking-tight">Reportes</h1>
      </header>

      <PeriodNav kind={kind} range={range} today={today} />

      {empty ? (
        <p className="rounded-3xl bg-surface px-5 py-10 text-center text-sm text-muted ring-1 ring-border">
          No hay movimientos en este periodo.
        </p>
      ) : (
        <>
          <StatTiles report={report} periodName={periodName} />
          <DailyChart
            key={`${kind}-${range.start}`}
            kind={kind}
            days={report.days}
            dailyAverage={report.dailyAverage}
            today={today}
          />
          {report.byCategory.length > 0 && (
            <CategoryBars slices={report.byCategory} periodName={periodName} />
          )}
        </>
      )}
    </main>
  );
}
