import Link from "next/link";
import { CategoryIcon } from "@/components/category-icon";
import { categoryColorVar } from "@/lib/category-colors";
import { addDays, formatDay } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import type { Category } from "@/lib/types";
import type { UpcomingCharge } from "@/lib/week-plan";

const VISIBLE = 3;

/**
 * Los recurrentes de los próximos 7 días (y los vencidos que esperan en la
 * bandeja), para que no sorprendan. No aparece si no viene nada.
 */
export function UpcomingCharges({
  upcoming,
  categories,
  today,
}: {
  upcoming: UpcomingCharge[];
  categories: Category[];
  today: string;
}) {
  if (upcoming.length === 0) return null;
  const byId = new Map(categories.map((c) => [c.id, c]));
  const hidden = upcoming.length - VISIBLE;
  const when = (c: UpcomingCharge) =>
    c.pending ? "Por confirmar" : c.day === addDays(today, 1) ? "Mañana" : formatDay(c.day, today);

  return (
    <section className="mt-6" aria-labelledby="upcoming-title">
      <h2 id="upcoming-title" className="mb-1 flex justify-between px-1 text-xs font-medium text-muted uppercase">
        <span>Próximos movimientos</span>
        <span className="normal-case">7 días</span>
      </h2>
      <ul className="divide-y divide-border border-y border-border">
        {upcoming.slice(0, VISIBLE).map((c) => {
          const category = c.categoryId ? byId.get(c.categoryId) : undefined;
          return (
            <li key={`${c.ruleId}:${c.day}:${c.pending}`}>
              <Link
                href={c.pending ? "/bandeja" : "/ajustes/recurrentes"}
                className="-mx-1 flex items-center gap-3 px-1 py-3 active:bg-border/40"
              >
                <span className="flex shrink-0" style={{ color: categoryColorVar(category?.color) }}>
                  <CategoryIcon category={category} className="size-5 text-xl" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{c.description || category?.name || "Recurrente"}</span>
                  <span className="block truncate text-xs text-muted">{when(c)}</span>
                </span>
                <span
                  className={`shrink-0 font-mono text-[15px] tracking-tight ${c.type === "income" ? "text-accent-ink" : ""}`}
                >
                  {c.type === "income" ? "+" : "-"}
                  {formatCOP(c.amount)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {hidden > 0 && (
        <Link href="/ajustes/recurrentes" className="block px-1 py-3 text-xs text-muted active:opacity-70">
          y {hidden} más ›
        </Link>
      )}
    </section>
  );
}
