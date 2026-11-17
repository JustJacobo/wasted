"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { balance, crossedLevel, weekBefore } from "@/lib/budget";
import { startOfWeek, todayIn } from "@/lib/dates";
import type { CategoryRule } from "@/lib/quick-add/categorize";
import type { Category, Transaction, TxType, WeekBudget } from "@/lib/types";
import { findCharge } from "@/lib/recurring-suggest";
import type { UpcomingCharge } from "@/lib/week-plan";
import { TabBar } from "@/components/tab-bar";
import { deleteTransaction, setCategory, undoRecurringPayment, type Similar } from "../actions";
import { AddSheet } from "./add-sheet";
import { pulseMecha } from "./mecha-pulse";
import { onPayment } from "./pay-event";
import { revealRow } from "./reveal-row";
import { SavedToast, type Feedback } from "./saved-toast";
import { WastedMoment } from "./wasted-moment";

const DISMISS_MS = 6_000;

/**
 * La ventana se abre sola la primera vez que se entra al inicio en esta visita
 * (como la app al arrancar). Al volver desde otra pestaña ya no: se abre con el ＋.
 */
let openedThisVisit = false;

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
 * La barra de pestañas (con el ＋ que abre el registro) y la ventana de
 * registro. Al abrir se agrega una entrada al historial para que el botón
 * Atrás de Android cierre la ventana en vez de salir de la app.
 */
export function AddLauncher({
  categories,
  rules,
  usage,
  upcoming,
  initialType,
  initialCharge = null,
  requested = false,
}: {
  categories: Category[];
  rules: CategoryRule[];
  usage: { category_id: string | null }[];
  upcoming: UpcomingCharge[];
  initialType: TxType;
  /** ?recurrente=…: abre listo para marcar pagada esa fecha. */
  initialCharge?: UpcomingCharge | null;
  /** Se pidió abrirla (?nuevo=gasto|ingreso, el ＋ de otra pestaña). */
  requested?: boolean;
}) {
  const [open, setOpen] = useState(!openedThisVisit || requested || initialCharge !== null);
  useEffect(() => {
    openedThisVisit = true;
  }, []);
  const [type, setType] = useState<TxType>(initialType);
  const [charge, setCharge] = useState<UpcomingCharge | null>(initialCharge);
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
    setCharge(null);
    show(null);
    setOpen(true);
  }

  // "Próximos movimientos": abre la ventana con ese recurrente listo para marcarlo pagado.
  useEffect(
    () =>
      onPayment((pick) => {
        setCharge(findCharge(upcoming, pick.ruleId, pick.occurrence));
        setFeedback(null);
        setOpen(true);
      }),
    [upcoming],
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
      <TabBar
        onAdd={() => openWith("expense")}
        toast={feedback && <SavedToast feedback={feedback} categories={categories} onCategory={changeCategory} onUndo={undo} />}
      />

      <AddSheet
        open={open}
        initialType={type}
        initialCharge={charge}
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
