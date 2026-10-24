"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CategoryIcon } from "@/components/category-icon";
import type { Category, Transaction, TxType } from "@/lib/types";
import { deleteTransaction, updateTransaction, type EditState } from "../../actions";

const groupThousands = (digits: string) =>
  digits ? Number(digits).toLocaleString("es-CO") : "";

export function EditForm({
  transaction,
  categories,
  returnTo,
}: {
  transaction: Transaction;
  categories: Category[];
  returnTo: string;
}) {
  const router = useRouter();
  const [state, formAction, saving] = useActionState<EditState, FormData>(updateTransaction, {});
  const [deleting, startDelete] = useTransition();
  const [type, setType] = useState<TxType>(transaction.type);
  const [amount, setAmount] = useState(groupThousands(String(transaction.amount)));
  const options = categories.filter(
    (c) => c.type === type && (!c.archived || c.id === transaction.category_id),
  );
  const [categoryId, setCategoryId] = useState(
    transaction.type === type ? transaction.category_id : null,
  );

  function switchType(next: TxType) {
    setType(next);
    setCategoryId(next === transaction.type ? transaction.category_id : null);
  }

  function remove() {
    if (!confirm("¿Eliminar este movimiento?")) return;
    startDelete(async () => {
      await deleteTransaction(transaction.id);
      router.replace(returnTo);
    });
  }

  const selected = options.some((c) => c.id === categoryId) ? categoryId : options.at(-1)?.id;

  return (
    <form action={formAction} className="mt-2 space-y-6">
      <input type="hidden" name="id" value={transaction.id} />
      <input type="hidden" name="volver" value={returnTo} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="category_id" value={selected ?? ""} />

      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface p-1 ring-1 ring-border">
        {(["expense", "income"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => switchType(t)}
            aria-pressed={type === t}
            className={`h-10 rounded-xl text-sm font-medium transition-colors duration-150 ${
              type === t ? "bg-foreground text-background" : "text-muted"
            }`}
          >
            {t === "expense" ? "Gasto" : "Ingreso"}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="mb-1 block px-1 text-sm text-muted">Monto</span>
        <div className="flex h-14 items-center rounded-2xl border border-border bg-surface px-4 focus-within:border-foreground">
          <span className="text-2xl text-muted">$</span>
          <input
            name="amount"
            inputMode="numeric"
            required
            value={amount}
            onChange={(e) => setAmount(groupThousands(e.target.value.replace(/\D/g, "")))}
            className="tabular min-w-0 flex-1 bg-transparent px-2 text-2xl font-semibold outline-none"
          />
        </div>
      </label>

      <label className="block">
        <span className="mb-1 block px-1 text-sm text-muted">Descripción</span>
        <input
          name="description"
          defaultValue={transaction.description}
          maxLength={200}
          className="h-12 w-full rounded-2xl border border-border bg-surface px-4 outline-none focus:border-foreground"
        />
      </label>

      <fieldset>
        <legend className="mb-2 px-1 text-sm text-muted">Categoría</legend>
        <div className="flex flex-wrap gap-2">
          {options.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              aria-pressed={selected === c.id}
              className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] ${
                selected === c.id ? "bg-foreground text-background" : "bg-surface ring-1 ring-border"
              }`}
            >
              <CategoryIcon category={c} className="size-4 text-base" />
              {c.name}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-1 block px-1 text-sm text-muted">Fecha</span>
        <input
          type="date"
          name="occurred_on"
          required
          defaultValue={transaction.occurred_on}
          className="h-12 w-full rounded-2xl border border-border bg-surface px-4 outline-none focus:border-foreground"
        />
      </label>

      {state.error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      )}

      <div className="space-y-3">
        <button
          type="submit"
          disabled={saving || deleting}
          className="h-12 w-full rounded-2xl bg-foreground font-medium text-background transition-transform duration-150 ease-out active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={saving || deleting}
          className="h-12 w-full rounded-2xl font-medium text-danger transition-transform duration-150 ease-out active:scale-[0.98] disabled:opacity-50"
        >
          {deleting ? "Eliminando…" : "Eliminar"}
        </button>
      </div>
    </form>
  );
}
