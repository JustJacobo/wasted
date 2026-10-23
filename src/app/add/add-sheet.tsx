"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { sortByUsage } from "@/lib/category-usage";
import { todayIn } from "@/lib/dates";
import type { CategoryRule } from "@/lib/quick-add/categorize";
import type { Category, Totals, Transaction, TxType } from "@/lib/types";
import { addTransaction } from "../actions";
import { AmountStep } from "./amount-step";
import { CategoryStep } from "./category-step";
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
  categories,
  rules,
  usage,
  onClose,
  onSaved,
}: {
  open: boolean;
  initialType: TxType;
  categories: Category[];
  rules: CategoryRule[];
  usage: { category_id: string | null }[];
  onClose: () => void;
  onSaved: (transaction: Transaction, week: Totals, similar?: string | null) => void;
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
  const [, startTransition] = useTransition();

  // Cada vez que se abre, empieza de cero con el tipo elegido.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setView("amount");
      setDirection("forward");
      setType(initialType);
      setDigits("");
      setDate(todayIn());
      setNote("");
      setSelectedId(null);
      setPending(false);
      setError(null);
    }
  }

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
  }

  function submit() {
    if (!selectedId || pending) return;
    setPending(true);
    setError(null);
    startTransition(async () => {
      const result = await addTransaction({
        type,
        amount: Number(digits),
        categoryId: selectedId,
        description: note,
        occurredOn: date,
      });
      setPending(false);
      if (result.status === "ok") onSaved(result.transaction, result.week, result.similar);
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
            />
          ) : (
            <CategoryStep
              type={type}
              amount={Number(digits)}
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
            />
          )}
        </div>
      </div>
    </div>
  );
}
