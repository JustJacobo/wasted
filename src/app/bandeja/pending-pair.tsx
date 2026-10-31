"use client";

import { useState, useTransition } from "react";
import type { PendingItem } from "@/lib/data";
import { CategoryIcon } from "@/components/category-icon";
import { formatDay } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import type { Category } from "@/lib/types";
import { mergePending, splitPending } from "./actions";

/**
 * Un recurrente y un correo que quizás son el mismo cobro (otro monto, mismo
 * nombre): una sola tarjeta y un solo toque para resolverlos.
 */
export function PendingPair({
  recurring,
  mail,
  categories,
  today,
}: {
  recurring: PendingItem;
  mail: PendingItem;
  categories: Category[];
  today: string;
}) {
  const options = categories.filter(
    (c) => c.type === recurring.type && (!c.archived || c.id === recurring.category_id),
  );
  const [categoryId, setCategoryId] = useState(
    recurring.category_id ?? mail.category_id ?? options[0]?.id ?? "",
  );
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  if (done) return null;

  const act = (action: () => Promise<{ error?: string }>) =>
    start(async () => {
      const result = await action();
      if (result.error) setError(result.error);
      else setDone(true);
    });

  const category = categories.find((c) => c.id === categoryId);
  const sign = recurring.type === "income" ? "+" : "-";
  const amountChanged = Number(mail.amount) !== Number(recurring.amount);
  const frequency = recurring.frequency && recurring.frequency.charAt(0).toLowerCase() + recurring.frequency.slice(1);

  const line = (label: string, title: string, detail: string, amount: number) => (
    <div className="flex items-start gap-3">
      <span className="w-20 shrink-0 pt-0.5 text-xs text-muted">{label}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{title}</span>
        <span className="block truncate text-xs text-muted">{detail}</span>
      </span>
      <span className={`tabular shrink-0 font-medium ${recurring.type === "income" ? "text-accent-ink" : ""}`}>
        {sign}
        {formatCOP(amount)}
      </span>
    </div>
  );

  return (
    <li className="space-y-3 px-4 py-4" data-pending-pair={`${recurring.id}:${mail.id}`}>
      <p className="flex items-center gap-2 font-medium">
        <CategoryIcon category={category} className="size-5 shrink-0 text-xl text-muted" />
        ¿Es el mismo cobro?
      </p>
      <div className="space-y-3 rounded-xl bg-background p-3 ring-1 ring-border">
        {line(
          "Recurrente",
          recurring.description || category?.name || "Recurrente",
          [formatDay(recurring.occurred_on, today), frequency].filter(Boolean).join(" · "),
          Number(recurring.amount),
        )}
        {line(
          mail.source === "notification" ? "Notificación" : "Del correo",
          mail.merchant || mail.description || "Movimiento",
          formatDay(mail.occurred_on, today),
          Number(mail.amount),
        )}
      </div>
      <p className="px-1 text-xs text-muted">
        Si es el mismo, se agrega una vez con el monto y la fecha {mail.source === "notification" ? "de la notificación" : "del correo"}
        {amountChanged && ` y el recurrente pasa a ${formatCOP(Number(mail.amount))}`}.
      </p>

      <label className="sr-only" htmlFor={`cat-${recurring.id}`}>
        Categoría
      </label>
      <select
        id={`cat-${recurring.id}`}
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        className="h-11 w-full rounded-xl border border-border bg-background px-3 text-base"
      >
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => act(() => splitPending([recurring.id, mail.id]))}
          className="h-11 rounded-xl text-sm font-medium ring-1 ring-border transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50"
        >
          Son distintos
        </button>
        <button
          type="button"
          disabled={pending || !categoryId}
          onClick={() => act(() => mergePending(recurring.id, mail.id, categoryId))}
          className="h-11 rounded-xl bg-foreground text-sm font-medium text-background transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50"
        >
          Es el mismo, agregar
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </li>
  );
}
