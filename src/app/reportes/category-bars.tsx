import { formatCOP } from "@/lib/money";
import type { CategorySlice } from "@/lib/report";
import { Delta } from "./delta";

const percent = new Intl.NumberFormat("es-CO", { style: "percent", maximumFractionDigits: 0 });

/**
 * Gasto por categoría en barras horizontales de un solo tono, de mayor a menor.
 * Cada fila lleva su valor, su peso en el total y la variación.
 */
export function CategoryBars({
  slices,
  periodName,
}: {
  slices: CategorySlice[];
  periodName: string;
}) {
  const max = slices[0]?.amount ?? 1;

  return (
    <section className="rounded-3xl bg-surface p-5 ring-1 ring-border">
      <h3 className="font-semibold">Gasto por categoría</h3>
      <ul className="mt-4 space-y-4">
        {slices.map((s) => (
          <li key={s.category?.id ?? "sin-categoria"}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate">
                <span aria-hidden className="mr-1.5">
                  {s.category?.emoji ?? "❔"}
                </span>
                {s.category?.name ?? "Sin categoría"}
              </span>
              <span className="shrink-0 font-medium tabular">{formatCOP(s.amount)}</span>
            </div>
            <div className="mt-1.5 h-2 bg-border/60">
              <div
                className="h-full rounded-r-[4px] bg-viz"
                style={{ width: `${Math.max((s.amount / max) * 100, 2)}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between gap-3">
              <span className="text-xs text-muted tabular">
                {s.share > 0 && s.share < 0.01 ? "<1%" : percent.format(s.share)} del gasto
              </span>
              <Delta current={s.amount} previous={s.previous} upIsGood={false} periodName={periodName} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
