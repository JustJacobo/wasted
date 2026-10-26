"use client";

import { useMemo, useState, useTransition } from "react";
import { formatDay, todayIn } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import { matchCategory, type CategoryRule } from "@/lib/quick-add/categorize";
import { parseQuickAdd } from "@/lib/quick-add/parse";
import type { Category, Transaction, WeekBudget } from "@/lib/types";
import { quickAdd } from "../actions";

/** Modo secundario: escribir "25k almuerzo" en una línea. */
export function TextStep({
  categories,
  rules,
  onSaved,
}: {
  categories: Category[];
  rules: CategoryRule[];
  onSaved: (transaction: Transaction, week: WeekBudget, similar?: string | null) => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const preview = useMemo(() => parseQuickAdd(text), [text]);
  const previewCategory = useMemo(() => {
    if (!preview) return null;
    const id = matchCategory(preview.description, preview.type, categories, rules);
    return categories.find((c) => c.id === id) ?? null;
  }, [preview, categories, rules]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    if (!preview) {
      setError("Falta el monto. Prueba con “25k almuerzo”.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await quickAdd(value);
      if (result.status === "ok") onSaved(result.transaction, result.week, result.similar);
      else if (result.status === "error") setError(result.error);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="px-1 text-sm text-muted">
        Escribe el monto y en qué fue: <strong>25k almuerzo</strong>,{" "}
        <strong>+200k cuota semanal</strong>, <strong>ayer 6k yango</strong>.
      </p>
      <div className="flex items-center gap-2">
        <label htmlFor="quick-add" className="sr-only">
          Nuevo gasto o ingreso
        </label>
        <input
          id="quick-add"
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="25k almuerzo"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          maxLength={200}
          className="h-12 min-w-0 flex-1 rounded-xl border border-border bg-background px-4 outline-none placeholder:text-muted focus:border-foreground"
        />
        <button
          type="submit"
          disabled={!text.trim() || pending}
          aria-label="Guardar"
          className="grid size-12 shrink-0 place-items-center rounded-xl bg-foreground text-background transition-[transform,opacity] duration-150 ease-out active:scale-[0.97] disabled:opacity-30"
        >
          →
        </button>
      </div>
      <p className="tabular h-4 truncate px-1 text-xs text-muted" aria-live="polite">
        {pending
          ? "Guardando…"
          : preview
            ? `${preview.type === "income" ? "Ingreso" : "Gasto"} · ${formatCOP(preview.amount)}` +
              ` · ${formatDay(preview.occurredOn, todayIn())}` +
              (previewCategory ? ` · ${previewCategory.name}` : "")
            : ""}
      </p>
      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
