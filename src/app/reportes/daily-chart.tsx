"use client";

import { useState } from "react";
import { formatDay, formatShortDay, formatWeekdayLetter } from "@/lib/dates";
import { formatCOP, formatCOPShort } from "@/lib/money";
import type { PeriodKind, Report } from "@/lib/report";

/**
 * Columnas de gasto por día en un solo tono (magnitud), con una línea de
 * referencia del promedio. Tocar un día muestra su valor en la lectura de
 * arriba; la vista de tabla lleva todos los valores.
 */
export function DailyChart({
  kind,
  days,
  dailyAverage,
  today,
}: {
  kind: PeriodKind;
  days: Report["days"];
  dailyAverage: number;
  today: string;
}) {
  const max = Math.max(...days.map((d) => d.expense), dailyAverage, 1);
  const peak = days.reduce((a, b) => (b.expense > a.expense ? b : a), days[0]);
  const [selected, setSelected] = useState<string | null>(null);
  const shown = days.find((d) => d.day === selected) ?? null;
  const avgPct = (dailyAverage / max) * 100;
  const isMonth = kind === "mes";

  return (
    <section className="border-t border-border pt-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="shrink-0 font-semibold">Gasto por día</h3>
        <p className="min-w-0 truncate text-right text-sm" aria-live="polite">
          {shown ? (
            <>
              <span className="text-muted">{formatDay(shown.day, today)} · </span>
              <span className="font-medium">{formatCOP(shown.expense)}</span>
            </>
          ) : peak.expense > 0 ? (
            <>
              <span className="text-muted">Día más alto: {formatShortDay(peak.day)} · </span>
              <span className="font-medium">{formatCOP(peak.expense)}</span>
            </>
          ) : (
            <span className="text-muted">Sin gastos</span>
          )}
        </p>
      </div>

      <div className="relative mt-4 h-36">
        {dailyAverage > 0 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 border-t border-muted/50"
            style={{ bottom: `${avgPct}%` }}
          >
            <span className="absolute right-0 bottom-0.5 rounded bg-surface/90 px-1 text-[11px] text-muted tabular">
              Prom. {formatCOPShort(dailyAverage)}
            </span>
          </div>
        )}

        <div className={`flex h-full items-end ${isMonth ? "gap-0.5" : "gap-2"}`}>
          {days.map((d) => {
            const future = d.day > today;
            const active = selected === d.day;
            const dim = selected !== null && !active;
            return (
              <button
                key={d.day}
                type="button"
                disabled={future}
                onClick={() => setSelected(active ? null : d.day)}
                aria-pressed={active}
                aria-label={`${formatDay(d.day, today)}: ${formatCOP(d.expense)}`}
                className="flex h-full min-w-0 flex-1 items-end justify-center disabled:cursor-default"
              >
                {d.expense > 0 ? (
                  <span
                    className={`block w-full max-w-6 rounded-t-[4px] bg-viz transition-opacity duration-150 ease-ui ${
                      dim ? "opacity-35" : ""
                    }`}
                    style={{ height: `${Math.max((d.expense / max) * 100, 2)}%` }}
                  />
                ) : (
                  <span
                    className={`block h-px w-full max-w-6 ${future ? "bg-border/50" : "bg-border"}`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className={`mt-2 flex ${isMonth ? "gap-0.5" : "gap-2"}`} aria-hidden>
        {days.map((d) => {
          const dayNum = Number(d.day.slice(8));
          const label = isMonth
            ? dayNum === 1 || dayNum % 7 === 1
              ? String(dayNum)
              : ""
            : formatWeekdayLetter(d.day);
          return (
            <span
              key={d.day}
              className={`min-w-0 flex-1 text-center text-[11px] tabular ${
                d.day === today ? "font-semibold text-foreground" : "text-muted"
              }`}
            >
              {label}
            </span>
          );
        })}
      </div>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-muted select-none">Ver como tabla</summary>
        <table className="mt-2 w-full tabular">
          <thead className="sr-only">
            <tr>
              <th>Día</th>
              <th>Gasto</th>
            </tr>
          </thead>
          <tbody>
            {days
              .filter((d) => d.day <= today)
              .map((d) => (
                <tr key={d.day} className="border-t border-border">
                  <td className="py-1.5 text-muted">{formatDay(d.day, today)}</td>
                  <td className="py-1.5 text-right">{formatCOP(d.expense)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
