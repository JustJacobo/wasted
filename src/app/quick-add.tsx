"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { formatDay, todayIn } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import { matchCategory, type CategoryRule } from "@/lib/quick-add/categorize";
import { parseQuickAdd } from "@/lib/quick-add/parse";
import type { Category, Transaction } from "@/lib/types";
import { deleteTransaction, quickAdd, setCategory } from "./actions";

const DISMISS_MS = 6_000;

type Feedback =
  | { kind: "saved"; transaction: Transaction }
  | { kind: "error"; message: string };

export function QuickAdd({
  categories,
  rules,
  autoFocus,
}: {
  categories: Category[];
  rules: CategoryRule[];
  autoFocus: boolean;
}) {
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const preview = useMemo(() => parseQuickAdd(text), [text]);
  const previewCategory = useMemo(() => {
    if (!preview) return null;
    const id = matchCategory(preview.description, preview.type, categories, rules);
    return categories.find((c) => c.id === id) ?? null;
  }, [preview, categories, rules]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  function scheduleDismiss() {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setFeedback(null), DISMISS_MS);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    if (!preview) {
      setFeedback({ kind: "error", message: "Falta el monto. Prueba con “25k almuerzo”." });
      scheduleDismiss();
      return;
    }
    // Se limpia de inmediato para poder escribir el siguiente sin esperar.
    setText("");
    startTransition(async () => {
      const result = await quickAdd(value);
      if (result.status === "ok") {
        setFeedback({ kind: "saved", transaction: result.transaction });
      } else if (result.status === "error") {
        setText(value);
        setFeedback({ kind: "error", message: result.error });
      }
      scheduleDismiss();
    });
  }

  function changeCategory(categoryId: string) {
    if (feedback?.kind !== "saved") return;
    const tx = feedback.transaction;
    setFeedback({ kind: "saved", transaction: { ...tx, category_id: categoryId } });
    scheduleDismiss();
    startTransition(() => setCategory(tx.id, categoryId));
  }

  function undo() {
    if (feedback?.kind !== "saved") return;
    const { id } = feedback.transaction;
    setFeedback(null);
    startTransition(() => deleteTransaction(id));
    inputRef.current?.focus();
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto max-w-lg px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {feedback?.kind === "saved" && (
          <SavedCard
            key={feedback.transaction.id}
            transaction={feedback.transaction}
            categories={categories}
            onCategory={changeCategory}
            onUndo={undo}
          />
        )}
        {feedback?.kind === "error" && (
          <p
            role="alert"
            className="mb-3 rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] starting:translate-y-2 starting:opacity-0 motion-reduce:starting:translate-y-0"
          >
            {feedback.message}
          </p>
        )}

        <form onSubmit={submit} className="flex items-center gap-2">
          <label htmlFor="quick-add" className="sr-only">
            Nuevo gasto o ingreso
          </label>
          <input
            ref={inputRef}
            id="quick-add"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="25k almuerzo · +200k cuota"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="send"
            maxLength={200}
            className="h-12 min-w-0 flex-1 rounded-2xl border border-border bg-surface px-4 outline-none placeholder:text-muted focus:border-foreground"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            aria-label="Guardar"
            className="grid size-12 shrink-0 place-items-center rounded-2xl bg-foreground text-background transition-[transform,opacity] duration-150 ease-out active:scale-[0.97] disabled:opacity-30"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M5 12h14M13 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </form>

        <p className="tabular mt-2 h-4 truncate px-1 text-xs text-muted" aria-live="polite">
          {pending && !text
            ? "Guardando…"
            : preview
              ? `${preview.type === "income" ? "Ingreso" : "Gasto"} · ${formatCOP(preview.amount)}` +
                ` · ${formatDay(preview.occurredOn, todayIn())}` +
                (previewCategory ? ` · ${previewCategory.emoji} ${previewCategory.name}` : "")
              : ""}
        </p>
      </div>
    </div>
  );
}

function SavedCard({
  transaction,
  categories,
  onCategory,
  onUndo,
}: {
  transaction: Transaction;
  categories: Category[];
  onCategory: (id: string) => void;
  onUndo: () => void;
}) {
  const options = categories.filter((c) => c.type === transaction.type);

  return (
    <div className="mb-3 rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-border transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] starting:translate-y-2 starting:opacity-0 motion-reduce:starting:translate-y-0">
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="tabular min-w-0 truncate text-sm">
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
