"use client";

import { CategoryIcon } from "@/components/category-icon";
import { formatCOP } from "@/lib/money";
import { budgetMessage, budgetStatus } from "@/lib/budget";
import type { Category, Totals, Transaction } from "@/lib/types";

export type Feedback =
  | {
      kind: "saved";
      transaction: Transaction;
      week?: Totals;
      /** Un movimiento igual que ya llegó del correo (posible repetido). */
      similar?: string | null;
    }
  | { kind: "error"; message: string };

const ENTER =
  "transition-[opacity,transform] duration-200 ease-ui starting:translate-y-2 starting:opacity-0 motion-reduce:starting:translate-y-0";

/** Confirmación tras guardar: permite cambiar la categoría o deshacer. */
export function SavedToast({
  feedback,
  categories,
  onCategory,
  onUndo,
}: {
  feedback: Feedback;
  categories: Category[];
  onCategory: (id: string) => void;
  onUndo: () => void;
}) {
  if (feedback.kind === "error") {
    return (
      <p role="alert" className={`rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger ${ENTER}`}>
        {feedback.message}
      </p>
    );
  }

  const { transaction, week, similar } = feedback;
  const options = categories.filter((c) => c.type === transaction.type);
  const status = week ? budgetStatus(week.expense, week.income) : null;
  const warning =
    week && status && transaction.type === "expense" && (status.level === "warning" || status.level === "over")
      ? budgetMessage(status, week.expense, week.income)
      : null;

  return (
    <div className={`rounded-xl bg-surface p-3 ring-1 ring-border ${ENTER}`}>
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="tabular min-w-0 truncate text-sm" aria-live="polite">
          <span className="text-accent-ink">✓</span>{" "}
          {transaction.type === "income" ? "Ingreso" : "Gasto"}{" "}
          <strong>{formatCOP(Number(transaction.amount))}</strong>
          {transaction.description && ` · ${transaction.description}`}
        </p>
        <button
          type="button"
          onClick={onUndo}
          className="shrink-0 rounded-lg px-2 py-1 text-sm font-medium text-danger active:scale-[0.97]"
        >
          Deshacer
        </button>
      </div>
      {similar && (
        <p className="mt-1 px-1 text-xs text-foreground">
          <span aria-hidden className="mr-1">
            📧
          </span>
          Parece repetido: ya llegó del correo ({similar}).
        </p>
      )}
      {warning && (
        <p className="mt-1 px-1 text-xs text-foreground">
          <span aria-hidden className="mr-1">
            ⚠️
          </span>
          {warning}
        </p>
      )}
      <div className="-mx-3 mt-2 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
        {options.map((c) => {
          const active = c.id === transaction.category_id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onCategory(c.id)}
              aria-pressed={active}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] ${
                active ? "bg-foreground text-background" : "bg-background ring-1 ring-border"
              }`}
            >
              <CategoryIcon category={c} className="size-4 text-base" />
              {c.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
