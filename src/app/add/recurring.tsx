"use client";

import { CheckCircle, Circle, Repeat } from "@phosphor-icons/react/dist/ssr";
import { CategoryIcon } from "@/components/category-icon";
import { categoryColorVar } from "@/lib/category-colors";
import { formatCOP } from "@/lib/money";
import { chargeKey, chargeName, dueLabel } from "@/lib/recurring-suggest";
import type { Category } from "@/lib/types";
import type { UpcomingCharge } from "@/lib/week-plan";

/**
 * Paso 1: los recurrentes que vencen ("Vence pronto"). Un toque llena el monto
 * y la categoría y lo deja listo para marcarlo pagado.
 */
export function DueChips({
  charges,
  categories,
  today,
  onPick,
}: {
  charges: UpcomingCharge[];
  categories: Category[];
  today: string;
  onPick: (charge: UpcomingCharge) => void;
}) {
  if (charges.length === 0) return null;
  const byId = new Map(categories.map((c) => [c.id, c]));
  return (
    <div>
      <p className="mb-2 px-1 text-xs font-medium text-muted uppercase">Vence pronto</p>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {charges.map((c) => {
          const category = c.categoryId ? byId.get(c.categoryId) : undefined;
          const name = chargeName(c, category);
          const when = dueLabel(c, today);
          return (
            <button
              key={chargeKey(c)}
              type="button"
              onClick={() => onPick(c)}
              aria-label={`Marcar pagado ${name}, ${when}, ${formatCOP(c.amount)}`}
              className={`flex max-w-64 min-h-13 shrink-0 items-center gap-2.5 rounded-2xl bg-background py-2 pr-3.5 pl-3 text-left ring-1 transition-transform duration-150 ease-ui active:scale-[0.97] ${
                c.pending ? "ring-foreground" : "ring-border"
              }`}
            >
              <span className="flex shrink-0" style={{ color: categoryColorVar(category?.color) }}>
                <CategoryIcon category={category} className="size-5 text-xl" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{name}</span>
                <span className="tabular block truncate text-xs text-muted">
                  {when} · {formatCOP(c.amount)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Paso 2: "Es el pago de Arriendo". Encendido, guardar lo marca pagado en vez de crear otro movimiento. */
export function PayToggle({
  charge,
  category,
  today,
  active,
  onToggle,
}: {
  charge: UpcomingCharge;
  category: Category | undefined;
  today: string;
  active: boolean;
  onToggle: () => void;
}) {
  const name = chargeName(charge, category);
  const Check = active ? CheckCircle : Circle;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={active}
      onClick={onToggle}
      className={`flex min-h-14 w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left ring-1 transition-[background-color,color,transform] duration-150 ease-ui active:scale-[0.99] ${
        active ? "bg-foreground text-background ring-foreground" : "bg-background ring-border"
      }`}
    >
      <Repeat aria-hidden className={`size-5 shrink-0 ${active ? "" : "text-muted"}`} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">Es el pago de {name}</span>
        <span className={`tabular block truncate text-xs ${active ? "opacity-75" : "text-muted"}`}>
          {dueLabel(charge, today)} · {formatCOP(charge.amount)}
        </span>
      </span>
      <Check aria-hidden weight={active ? "fill" : "regular"} className={`size-6 shrink-0 ${active ? "" : "text-muted"}`} />
    </button>
  );
}
