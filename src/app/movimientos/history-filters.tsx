"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { Category } from "@/lib/types";

/** Selector de categoría y buscador; actualizan la URL (la búsqueda con 300ms de espera). */
export function HistoryFilters({
  categories,
  categoryId,
  query,
}: {
  categories: Category[];
  categoryId: string | null;
  query: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [text, setText] = useState(query);
  const [pending, startTransition] = useTransition();

  // Si la búsqueda cambia desde fuera (p. ej. "Quitar filtros"), reflejarla
  // en el campo sin remontarlo, para no perder el foco al escribir.
  const [syncedQuery, setSyncedQuery] = useState(query);
  if (query !== syncedQuery) {
    setSyncedQuery(query);
    if (query !== text.trim()) setText(query);
  }
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.replace(`${pathname}?${next}`, { scroll: false }));
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  function onSearch(value: string) {
    setText(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => update("q", value.trim()), 300);
  }

  const expense = categories.filter((c) => c.type === "expense");
  const income = categories.filter((c) => c.type === "income");

  return (
    <div className="space-y-2">
      <div className="relative">
        <label htmlFor="history-search" className="sr-only">
          Buscar en las descripciones
        </label>
        <input
          id="history-search"
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          value={text}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Buscar: uber, mercado…"
          maxLength={100}
          className="h-12 w-full rounded-xl border border-border bg-surface px-4 outline-none placeholder:text-muted focus:border-foreground"
        />
        {pending && (
          <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-xs text-muted">
            Buscando…
          </span>
        )}
      </div>
      <label className="block">
        <span className="sr-only">Categoría</span>
        <select
          value={categoryId ?? ""}
          onChange={(e) => update("cat", e.target.value)}
          className="h-12 w-full rounded-xl border border-border bg-surface px-3 outline-none focus:border-foreground"
        >
          <option value="">Todas las categorías</option>
          <optgroup label="Gastos">
            {expense.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.archived ? " (archivada)" : ""}
              </option>
            ))}
          </optgroup>
          <optgroup label="Ingresos">
            {income.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.archived ? " (archivada)" : ""}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
    </div>
  );
}
