"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { sortByUsage } from "@/lib/category-usage";
import { todayIn } from "@/lib/dates";
import type { CategoryRule } from "@/lib/quick-add/categorize";
import { chargeName, findCharge, matchingCharges, payableCharges, payDate } from "@/lib/recurring-suggest";
import type { Category, Transaction, TxType, WeekBudget } from "@/lib/types";
import type { UpcomingCharge } from "@/lib/week-plan";
import { addTransaction, payRecurring, type Similar } from "../actions";
import { AmountStep } from "./amount-step";
import { CategoryStep } from "./category-step";
import type { PaymentPick } from "./pay-event";
import { DueChips, PayToggle } from "./recurring";
import { TextStep } from "./text-step";

type View = "amount" | "category" | "text";

// Cada vista entra deslizándose 16px desde el lado hacia el que se avanza
// (200ms, --ease-ui). Con movimiento reducido solo hay fundido.
const ENTER_FROM = {
  forward: "starting:translate-x-4",
  back: "starting:-translate-x-4",
} as const;

export function AddSheet({
  open,
  initialType,
  initialPick,
  categories,
  rules,
  usage,
  upcoming,
  onClose,
  onSaved,
}: {
  open: boolean;
  initialType: TxType;
  /** Abre listo para marcar pagada esta fecha de un recurrente (Próximos movimientos, ?recurrente=). */
  initialPick: PaymentPick | null;
  categories: Category[];
  rules: CategoryRule[];
  usage: { category_id: string | null }[];
  upcoming: UpcomingCharge[];
  onClose: () => void;
  onSaved: (transaction: Transaction, week: WeekBudget, similar?: Similar | null, paid?: string) => void;
}) {
  const [view, setView] = useState<View>("amount");
  const [direction, setDirection] = useState<keyof typeof ENTER_FROM>("forward");
  const [type, setType] = useState<TxType>(initialType);
  const [digits, setDigits] = useState("");
  const [date, setDate] = useState(() => todayIn());
  const [note, setNote] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** El recurrente que se marca pagado al guardar, o null para un registro normal. */
  const [paying, setPaying] = useState<UpcomingCharge | null>(null);
  const [, startTransition] = useTransition();

  const usable = (charge: UpcomingCharge) =>
    categories.some((c) => c.id === charge.categoryId) ? charge.categoryId : null;

  // Cada vez que se abre, empieza de cero con el tipo elegido (o con el recurrente pedido).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      const start = initialPick ? findCharge(upcoming, initialPick.ruleId, initialPick.occurrence) : null;
      setView(start ? "category" : "amount");
      setDirection("forward");
      setType(start?.type ?? initialType);
      setDigits(start ? String(start.amount) : "");
      setDate(start ? payDate(start, todayIn()) : todayIn());
      setNote("");
      setSelectedId(start ? usable(start) : null);
      setPaying(start);
      setPending(false);
      setError(null);
    }
  }

  const amount = Number(digits || 0);
  const today = todayIn();
  // Sin elegir una ficha, el que coincide con el monto escrito se ofrece apagado.
  const suggestion = paying ?? matchingCharges(upcoming, type, amount)[0] ?? null;

  const options = useMemo(
    () => sortByUsage(categories.filter((c) => c.type === type), usage),
    [categories, type, usage],
  );

  function go(next: View, dir: keyof typeof ENTER_FROM) {
    setDirection(dir);
    setView(next);
  }

  function changeType(next: TxType) {
    setType(next);
    setSelectedId(null);
    setPaying(null);
  }

  /** Una ficha de "Vence pronto": monto y categoría del recurrente, listo para marcarlo pagado. */
  function pick(charge: UpcomingCharge) {
    setType(charge.type);
    setDigits(String(charge.amount));
    setDate(payDate(charge, today));
    setSelectedId(usable(charge));
    setPaying(charge);
    go("category", "forward");
  }

  function togglePaying() {
    if (paying) return setPaying(null);
    if (!suggestion) return;
    setPaying(suggestion);
    if (!selectedId && options.some((c) => c.id === suggestion.categoryId)) setSelectedId(suggestion.categoryId);
  }

  function submit() {
    if (!selectedId || pending) return;
    setPending(true);
    setError(null);
    startTransition(async () => {
      const fields = { amount, categoryId: selectedId, description: note, occurredOn: date };
      const result = paying
        ? await payRecurring({ ...fields, ruleId: paying.ruleId, txId: paying.txId, occurrence: paying.occurrence })
        : await addTransaction({ ...fields, type });
      setPending(false);
      if (result.status === "ok") onSaved(result.transaction, result.week, result.similar, result.paid);
      else if (result.status === "error") setError(result.error);
    });
  }

  // En computador, Enter en el paso de categoría confirma.
  useEffect(() => {
    if (!open || view !== "category") return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Enter" && selectedId) {
        event.preventDefault();
        submit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const title =
    view === "text" ? "Escribir rápido" : type === "income" ? "Nuevo ingreso" : "Nuevo gasto";

  return (
    <div className={`fixed inset-0 z-30 ${open ? "" : "pointer-events-none"}`} inert={!open}>
      <div
        aria-hidden
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ease-ui ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`absolute inset-x-0 bottom-0 mx-auto max-h-[92dvh] max-w-lg overflow-x-hidden overflow-y-auto rounded-t-3xl bg-surface px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl transition-[transform,opacity] ease-drawer motion-reduce:translate-y-0 ${
          open
            ? "translate-y-0 duration-[280ms]"
            : "translate-y-full duration-200 motion-reduce:opacity-0"
        }`}
      >
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-border" aria-hidden />
        <div className="mb-3 flex items-center gap-2">
          <h2 className="flex-1 text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={() =>
              view === "text" ? go("amount", "back") : go("text", "forward")
            }
            aria-label={view === "text" ? "Usar botones" : "Escribir rápido"}
            className="grid size-10 place-items-center rounded-xl text-lg text-muted active:scale-[0.97]"
          >
            {view === "text" ? "123" : "⌨"}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="grid size-10 place-items-center rounded-xl text-xl text-muted active:scale-[0.97]"
          >
            ✕
          </button>
        </div>

        <div
          key={view}
          className={`transition-[transform,opacity] duration-200 ease-ui starting:opacity-0 motion-reduce:starting:translate-x-0 ${ENTER_FROM[direction]}`}
        >
          {view === "text" ? (
            open && <TextStep categories={categories} rules={rules} onSaved={onSaved} />
          ) : view === "amount" ? (
            <AmountStep
              type={type}
              onType={changeType}
              digits={digits}
              onDigits={setDigits}
              onNext={() => go("category", "forward")}
              active={open}
              due={<DueChips charges={payableCharges(upcoming, type)} categories={categories} today={today} onPick={pick} />}
            />
          ) : (
            <CategoryStep
              type={type}
              amount={amount}
              categories={options}
              date={date}
              onDate={setDate}
              note={note}
              onNote={setNote}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onBack={() => go("amount", "back")}
              onSubmit={submit}
              pending={pending}
              error={error}
              paying={paying ? chargeName(paying, categories.find((c) => c.id === paying.categoryId)) : null}
              payToggle={
                suggestion && (
                  <PayToggle
                    charge={suggestion}
                    category={categories.find((c) => c.id === suggestion.categoryId)}
                    today={today}
                    active={paying !== null}
                    onToggle={togglePaying}
                  />
                )
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
