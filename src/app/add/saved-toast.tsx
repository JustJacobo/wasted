"use client";

import { formatCOP } from "@/lib/money";
import type { Category, Transaction } from "@/lib/types";

export type Feedback =
  | { kind: "saved"; transaction: Transaction }
  | { kind: "error"; message: string };

const ENTER =
  "transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] starting:translate-y-2 starting:opacity-0 motion-reduce:starting:translate-y-0";

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
      <p role="alert" className={`rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger ${ENTER}`}>
        {feedback.message}
      </p>
    );
  }

  const { transaction } = feedback;
  const options = categories.filter((c) => c.type === transaction.type);

  return (
    <div className={`rounded-2xl bg-surface p-3 shadow-lg ring-1 ring-border ${ENTER}`}>
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="tabular min-w-0 truncate text-sm" aria-live="polite">
          <span className="text-accent">✓</span>{" "}
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
      <div className="-mx-3 mt-2 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
        {options.map((c) => {
          const active = c.id === transaction.category_id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onCategory(c.id)}
              aria-pressed={active}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] ${
                active ? "bg-foreground text-background" : "bg-background ring-1 ring-border"
              }`}
            >
              {c.emoji} {c.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
