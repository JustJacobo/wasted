"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { balance, crossedLevel, weekBefore } from "@/lib/budget";
import { startOfWeek, todayIn } from "@/lib/dates";
import type { CategoryRule } from "@/lib/quick-add/categorize";
import type { Category, Transaction, TxType, WeekBudget } from "@/lib/types";
import type { UpcomingCharge } from "@/lib/week-plan";
import { deleteTransaction, setCategory, undoRecurringPayment, type Similar } from "../actions";
import { AddSheet } from "./add-sheet";
import { pulseMecha } from "./mecha-pulse";
import { onPayment, type PaymentPick } from "./pay-event";
import { revealRow } from "./reveal-row";
import { SavedToast, type Feedback } from "./saved-toast";
import { WastedMoment } from "./wasted-moment";

const DISMISS_MS = 6_000;

/** true la primera vez de la semana que se pasa del 100% (recordado en este dispositivo). */
function firstOverThisWeek(): boolean {
  const key = `wasted:pasada:${startOfWeek(todayIn())}`;
  try {
    if (localStorage.getItem(key)) return false;
    localStorage.setItem(key, "1");
  } catch {
    // Sin almacenamiento (modo privado): se muestra igual.
  }
  return true;
}

/**
 * Barra fija con "− Gasto" y "+ Ingreso" y la ventana de registro, que se abre
 * sola al entrar. Al abrir se agrega una entrada al historial para que el
 * botón Atrás de Android cierre la ventana en vez de salir de la app.
 */
export function AddLauncher({
  categories,
  rules,
  usage,
  upcoming,
  initialType,
  initialPick = null,
  startOpen = true,
}: {
  categories: Category[];
  rules: CategoryRule[];
  usage: { category_id: string | null }[];
  upcoming: UpcomingCharge[];
  initialType: TxType;
  /** ?recurrente=<regla>&ocurrencia=<fecha>: abre listo para marcarlo pagado. */
  initialPick?: PaymentPick | null;
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen || initialPick !== null);
  const [type, setType] = useState<TxType>(initialType);
  const [pick, setPick] = useState<PaymentPick | null>(initialPick);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [wastedBy, setWastedBy] = useState<number | null>(null);
  const hideWasted = useCallback(() => setWastedBy(null), []);
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
    setPick(null);
    show(null);
    setOpen(true);
  }

  // "Próximos movimientos": abre la ventana con ese recurrente listo para marcarlo pagado.
  useEffect(
    () =>
      onPayment((next) => {
        setPick(next);
        setFeedback(null);
        setOpen(true);
      }),
    [],
  );

  function saved(transaction: Transaction, week: WeekBudget, similar?: Similar | null, paid?: string) {
    show({ kind: "saved", transaction, week, similar, paid });
    close();
    revealRow(transaction.id);
    pulseMecha();
    const before = weekBefore(week, { type: transaction.type, amount: Number(transaction.amount) });
    if (crossedLevel(before, week) === "over" && firstOverThisWeek()) {
      setWastedBy(-balance(week));
    }
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
    const paid = feedback.paid;
    show(null);
    // Un recurrente marcado pagado vuelve a quedar por pagar (o a la bandeja), no solo se borra.
    startTransition(async () => {
      const result = paid ? await undoRecurringPayment(id) : (await deleteTransaction(id), {});
      if (result.error) show({ kind: "error", message: "No pude deshacer: el movimiento sigue registrado." });
    });
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
              className="h-14 rounded-xl bg-foreground text-lg font-semibold text-background transition-transform duration-150 ease-out active:scale-[0.97]"
            >
              − Gasto
            </button>
            <button
              type="button"
              onClick={() => openWith("income")}
              className="h-14 rounded-xl bg-surface text-lg font-semibold ring-1 ring-border transition-transform duration-150 ease-out active:scale-[0.97]"
            >
              <span className="text-accent-ink">+</span> Ingreso
            </button>
          </div>
        </div>
      </div>

      <AddSheet
        open={open}
        initialType={type}
        initialPick={pick}
        categories={categories}
        rules={rules}
        usage={usage}
        upcoming={upcoming}
        onClose={close}
        onSaved={saved}
      />
      {wastedBy !== null && <WastedMoment over={wastedBy} onDone={hideWasted} />}
    </>
  );
}
