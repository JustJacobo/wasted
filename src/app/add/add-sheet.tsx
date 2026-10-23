"use client";

import { useMemo, useState, useTransition } from "react";
import { sortByUsage } from "@/lib/category-usage";
import { todayIn } from "@/lib/dates";
import type { CategoryRule } from "@/lib/quick-add/categorize";
import type { Category, Transaction, TxType } from "@/lib/types";
import { addTransaction } from "../actions";
import { AmountStep } from "./amount-step";
import { CategoryStep } from "./category-step";
import { TextStep } from "./text-step";

// Curva tipo cajón de iOS; abre en 280ms y cierra más rápido (200ms).
const SHEET_EASE = "ease-[cubic-bezier(0.32,0.72,0,1)]";

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
  onSaved: (transaction: Transaction) => void;
}) {
  const [mode, setMode] = useState<"steps" | "text">("steps");
  const [step, setStep] = useState<1 | 2>(1);
  const [type, setType] = useState<TxType>(initialType);
  const [digits, setDigits] = useState("");
  const [date, setDate] = useState(() => todayIn());
  const [note, setNote] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Cada vez que se abre, empieza de cero con el tipo elegido.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setMode("steps");
      setStep(1);
      setType(initialType);
      setDigits("");
      setDate(todayIn());
      setNote("");
      setPendingId(null);
      setError(null);
    }
  }

  const options = useMemo(
    () => sortByUsage(categories.filter((c) => c.type === type), usage),
    [categories, type, usage],
  );

  function pick(categoryId: string) {
    setPendingId(categoryId);
    setError(null);
    startTransition(async () => {
      const result = await addTransaction({
        type,
        amount: Number(digits),
        categoryId,
        description: note,
        occurredOn: date,
      });
      setPendingId(null);
      if (result.status === "ok") onSaved(result.transaction);
      else if (result.status === "error") setError(result.error);
    });
  }

  const title =
    mode === "text" ? "Escribir rápido" : type === "income" ? "Nuevo ingreso" : "Nuevo gasto";

  return (
    <div className={`fixed inset-0 z-30 ${open ? "" : "pointer-events-none"}`} inert={!open}>
      <div
        aria-hidden
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`absolute inset-x-0 bottom-0 mx-auto max-h-[92dvh] max-w-lg overflow-y-auto rounded-t-3xl bg-surface px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl transition-[transform,opacity] ${SHEET_EASE} motion-reduce:translate-y-0 ${
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
            onClick={() => setMode((m) => (m === "text" ? "steps" : "text"))}
            aria-label={mode === "text" ? "Usar botones" : "Escribir rápido"}
            className="grid size-10 place-items-center rounded-xl text-lg text-muted active:scale-[0.97]"
          >
            {mode === "text" ? "123" : "⌨"}
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

        {mode === "text" ? (
          open && <TextStep categories={categories} rules={rules} onSaved={onSaved} />
        ) : step === 1 ? (
          <AmountStep
            type={type}
            onType={setType}
            digits={digits}
            onDigits={setDigits}
            onNext={() => setStep(2)}
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
            onBack={() => setStep(1)}
            onPick={pick}
            pendingId={pendingId}
            error={error}
          />
        )}
      </div>
    </div>
  );
}
