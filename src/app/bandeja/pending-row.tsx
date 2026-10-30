"use client";

import { useState, useTransition } from "react";
import type { PendingItem } from "@/lib/data";
import { CategoryIcon } from "@/components/category-icon";
import { formatDay } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import type { Category } from "@/lib/types";
import { confirmPending, discardPending } from "./actions";

const PROVIDERS: Record<string, string> = {
  nequi: "Nequi",
  uber: "Uber",
  rappi: "Rappi",
  dian: "Factura",
  otro: "Correo",
  recurrente: "Recurrente",
};

/** Un movimiento por confirmar: categoría editable, Agregar o Descartar. */
export function PendingRow({
  item,
  categories,
  today,
}: {
  item: PendingItem;
  categories: Category[];
  today: string;
}) {
  const options = categories.filter(
    (c) => c.type === item.type && (!c.archived || c.id === item.category_id),
  );
  const [categoryId, setCategoryId] = useState(item.category_id ?? options[0]?.id ?? "");
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
  const similar = item.similar;
  // Cobro del correo unido a un recurrente: una sola tarjeta para los dos.
  const linked = Boolean(item.recurring_id) && item.source !== "recurring";
  const recurring = item.source === "recurring" || linked;
  const origin = linked
    ? ["Recurrente", formatDay(item.occurred_on, today), `del correo${item.merchant ? ` (${item.merchant})` : ""}`]
    : [
        PROVIDERS[item.provider ?? "otro"] ?? "Correo",
        formatDay(item.occurred_on, today),
        item.frequency && item.frequency.charAt(0).toLowerCase() + item.frequency.slice(1),
      ].filter(Boolean);
  const priceChanged = linked && item.ruleAmount !== null && item.ruleAmount !== Number(item.amount);
  const similarCategory = similar?.category_id
    ? categories.find((c) => c.id === similar.category_id)
    : undefined;

  return (
    <li className="space-y-3 px-4 py-4" data-pending-id={item.id}>
      <div className="flex items-start gap-3">
        <CategoryIcon category={category} className="size-5 shrink-0 text-xl text-muted" />
        <span className="min-w-0 flex-1">
          <span className="block truncate">{item.description || item.merchant || "Movimiento"}</span>
          <span className="block truncate text-xs text-muted">{origin.join(" · ")}</span>
        </span>
        <span
          className={`tabular shrink-0 font-medium ${item.type === "income" ? "text-accent-ink" : ""}`}
        >
          {item.type === "income" ? "+" : "-"}
          {formatCOP(Number(item.amount))}
        </span>
      </div>

      {priceChanged && (
        <p className="px-1 text-xs text-muted">
          Antes era {formatCOP(item.ruleAmount!)}; al agregarlo, el recurrente pasa a{" "}
          {formatCOP(Number(item.amount))}.
        </p>
      )}

      {similar && (
        <p className="rounded-xl bg-viz-warn/10 px-3 py-2 text-sm">
          <span aria-hidden className="mr-1">
            ⚠️
          </span>
          ¿Ya lo registraste? Se parece a{" "}
          <strong className="font-medium">
            {similar.description || similarCategory?.name || "un movimiento"}{" "}
            {formatCOP(Number(similar.amount))}
          </strong>{" "}
          ({formatDay(similar.occurred_on, today).toLowerCase()}).
        </p>
      )}

      <label className="sr-only" htmlFor={`cat-${item.id}`}>
        Categoría
      </label>
      <select
        id={`cat-${item.id}`}
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
          onClick={() => act(() => discardPending(item.id))}
          className="h-11 rounded-xl text-sm font-medium text-danger ring-1 ring-border transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50"
        >
          {similar ? "Ya lo tenía" : recurring ? "Esta vez no" : "Descartar"}
        </button>
        <button
          type="button"
          disabled={pending || !categoryId}
          onClick={() => act(() => confirmPending(item.id, categoryId))}
          className="h-11 rounded-xl bg-foreground text-sm font-medium text-background transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50"
        >
          {similar ? "Es otro, agregar" : "Agregar"}
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
