import Link from "next/link";
import { CategoryIcon } from "@/components/category-icon";
import { categoryColorVar } from "@/lib/category-colors";
import { formatCOP } from "@/lib/money";
import type { CategorySlice } from "@/lib/report";
import { Delta } from "./delta";

const percent = new Intl.NumberFormat("es-CO", { style: "percent", maximumFractionDigits: 0 });

/**
 * Gasto por categoría en barras horizontales, de mayor a menor. Cada barra y su
 * ícono llevan el color de la categoría; el texto sigue en tinta. Cada fila lleva
 * su valor, su peso en el total y la variación.
 */
export function CategoryBars({
  slices,
  periodName,
  month,
}: {
  slices: CategorySlice[];
  periodName: string;
  /** "YYYY-MM": cada fila abre el historial de ese mes filtrado por la categoría. */
  month: string;
}) {
  const max = slices[0]?.amount ?? 1;

  return (
    <section className="border-t border-border pt-5">
      <h3 className="font-semibold">Gasto por categoría</h3>
      <ul className="mt-4 space-y-4">
        {slices.map((s) => {
          const color = categoryColorVar(s.category?.color);
          return (
            <li key={s.category?.id ?? "sin-categoria"}>
              <Row
                href={
                  s.category
                    ? `/movimientos?mes=${month}&tipo=gasto&cat=${s.category.id}`
                    : null
                }
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="flex shrink-0" style={{ color }}>
                      <CategoryIcon category={s.category} className="size-4 text-base" />
                    </span>
                    <span className="truncate">{s.category?.name ?? "Sin categoría"}</span>
                  </span>
                  <span className="shrink-0 font-medium tabular">{formatCOP(s.amount)}</span>
                </div>
                <div className="mt-1.5 h-2 bg-border/60">
                  <div
                    className="h-full rounded-r-[4px]"
                    style={{ width: `${Math.max((s.amount / max) * 100, 2)}%`, backgroundColor: color }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="text-xs text-muted tabular">
                    {s.share > 0 && s.share < 0.01 ? "<1%" : percent.format(s.share)} del gasto
                  </span>
                  <Delta current={s.amount} previous={s.previous} upIsGood={false} periodName={periodName} />
                </div>
              </Row>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Row({ href, children }: { href: string | null; children: React.ReactNode }) {
  if (!href) return <div>{children}</div>;
  return (
    <Link href={href} className="-mx-2 block rounded-xl px-2 py-1 active:bg-border/40">
      {children}
    </Link>
  );
}
