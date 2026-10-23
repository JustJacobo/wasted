"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { CategoryRule } from "@/lib/quick-add/categorize";
import type { Category, Totals, Transaction, TxType } from "@/lib/types";
import { deleteTransaction, setCategory } from "../actions";
import { AddSheet } from "./add-sheet";
import { revealRow } from "./reveal-row";
import { SavedToast, type Feedback } from "./saved-toast";

const DISMISS_MS = 6_000;

/**
 * Barra fija con "− Gasto" y "+ Ingreso" y la ventana de registro, que se abre
 * sola al entrar. Al abrir se agrega una entrada al historial para que el
 * botón Atrás de Android cierre la ventana en vez de salir de la app.
 */
export function AddLauncher({
  categories,
  rules,
  usage,
  initialType,
  startOpen = true,
}: {
  categories: Category[];
  rules: CategoryRule[];
  usage: { category_id: string | null }[];
  initialType: TxType;
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const [type, setType] = useState<TxType>(initialType);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [, startTransition] = useTransition();
  const inHistory = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (open && !inHistory.current) {
      window.history.pushState({ ...window.history.state, wastedSheet: true }, "");
      inHistory.current = true;
    }
  }, [open]);

  useEffect(() => {
    function onPopState() {
      if (inHistory.current) {
        inHistory.current = false;
        setOpen(false);
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const close = useCallback(() => {
    // Volver en el historial dispara popstate, que cierra la ventana.
    if (inHistory.current) window.history.back();
    else setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => () => clearTimeout(timer.current), []);

  function show(next: Feedback | null) {
    setFeedback(next);
    clearTimeout(timer.current);
    if (next) timer.current = setTimeout(() => setFeedback(null), DISMISS_MS);
  }

  function openWith(next: TxType) {
    setType(next);
    show(null);
    setOpen(true);
  }

  function saved(transaction: Transaction, week: Totals, similar?: string | null) {
    show({ kind: "saved", transaction, week, similar });
    close();
    revealRow(transaction.id);
  }

  function changeCategory(categoryId: string) {
    if (feedback?.kind !== "saved") return;
    const tx = feedback.transaction;
    show({ ...feedback, transaction: { ...tx, category_id: categoryId } });
    startTransition(() => setCategory(tx.id, categoryId));
  }

  function undo() {
    if (feedback?.kind !== "saved") return;
    const { id } = feedback.transaction;
    show(null);
    startTransition(() => deleteTransaction(id));
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto max-w-lg px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {feedback && (
            <div className="mb-3">
              <SavedToast
                feedback={feedback}
                categories={categories}
                onCategory={changeCategory}
                onUndo={undo}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => openWith("expense")}
              className="h-14 rounded-2xl bg-foreground text-lg font-semibold text-background transition-transform duration-150 ease-out active:scale-[0.97]"
            >
              − Gasto
            </button>
            <button
              type="button"
              onClick={() => openWith("income")}
              className="h-14 rounded-2xl bg-accent text-lg font-semibold text-background transition-transform duration-150 ease-out active:scale-[0.97]"
            >
              + Ingreso
            </button>
          </div>
        </div>
      </div>

      <AddSheet
        open={open}
        initialType={type}
        categories={categories}
        rules={rules}
        usage={usage}
        onClose={close}
        onSaved={saved}
      />
    </>
  );
}
