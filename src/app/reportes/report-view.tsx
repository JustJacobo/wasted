import type { PeriodKind, Report } from "@/lib/report";
import { CategoryBars } from "./category-bars";
import { DailyChart } from "./daily-chart";
import { PeriodNav } from "./period-nav";
import { StatTiles } from "./stat-tiles";

/** Contenido del dashboard: navegación de periodo, cifras y gráficos. */
export function ReportView({
  kind,
  report,
  today,
}: {
  kind: PeriodKind;
  report: Report;
  today: string;
}) {
  const periodName = kind === "semana" ? "la semana anterior" : "el mes anterior";
  const empty = report.expense === 0 && report.income === 0;

  return (
    <div className="space-y-4">
      <PeriodNav kind={kind} range={report.range} today={today} />

      {empty ? (
        <p className="rounded-3xl bg-surface px-5 py-10 text-center text-sm text-muted ring-1 ring-border">
          No hay movimientos en este periodo.
        </p>
      ) : (
        <>
          <StatTiles report={report} periodName={periodName} />
          <DailyChart
            key={`${kind}-${report.range.start}`}
            kind={kind}
            days={report.days}
            dailyAverage={report.dailyAverage}
            today={today}
          />
          {report.byCategory.length > 0 && (
            <CategoryBars
              slices={report.byCategory}
              periodName={periodName}
              month={report.range.start.slice(0, 7)}
            />
          )}
        </>
      )}
    </div>
  );
}
