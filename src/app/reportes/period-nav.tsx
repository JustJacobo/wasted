import Link from "next/link";
import { formatDayRange, formatMonth } from "@/lib/dates";
import { nextRange, previousRange, type PeriodKind, type Range } from "@/lib/report";

const href = (kind: PeriodKind, day: string) => `/reportes?periodo=${kind}&fecha=${day}`;

export function PeriodNav({
  kind,
  range,
  today,
}: {
  kind: PeriodKind;
  range: Range;
  today: string;
}) {
  const prev = previousRange(kind, range);
  const next = nextRange(kind, range);
  const isCurrent = range.end >= today;
  const label =
    kind === "mes" ? formatMonth(range.start) : formatDayRange(range.start, range.end);

  const arrow =
    "grid size-11 place-items-center rounded-xl text-xl transition-transform duration-150 ease-ui active:scale-[0.97]";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface p-1 ring-1 ring-border">
        {(["semana", "mes"] as const).map((k) => (
          <Link
            key={k}
            href={href(k, today)}
            replace
            aria-current={k === kind ? "page" : undefined}
            className={`grid h-10 place-items-center rounded-xl text-sm font-medium transition-colors duration-150 ${
              k === kind ? "bg-foreground text-background" : "text-muted"
            }`}
          >
            {k === "semana" ? "Semana" : "Mes"}
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <Link href={href(kind, prev.start)} replace aria-label="Periodo anterior" className={arrow}>
          ‹
        </Link>
        <h2 className="text-center font-semibold">
          {label}
          {isCurrent && (
            <span className="block text-xs font-normal text-muted">
              {kind === "semana" ? "Esta semana" : "Este mes"}
            </span>
          )}
        </h2>
        {isCurrent ? (
          <span aria-hidden className={`${arrow} opacity-20`}>
            ›
          </span>
        ) : (
          <Link href={href(kind, next.start)} replace aria-label="Periodo siguiente" className={arrow}>
            ›
          </Link>
        )}
      </div>
    </div>
  );
}
