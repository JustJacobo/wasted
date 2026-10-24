import Link from "next/link";
import { CategoryIcon } from "@/components/category-icon";
import { formatDay } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import type { Category, Transaction } from "@/lib/types";

export function TransactionList({
  transactions,
  categories,
  today,
  returnTo = "/",
  empty,
}: {
  transactions: Transaction[];
  categories: Category[];
  today: string;
  /** A dónde volver después de editar un movimiento. */
  returnTo?: string;
  empty?: React.ReactNode;
}) {
  if (transactions.length === 0) {
    return (
      <p className="mt-10 text-center text-sm text-muted">
        {empty ?? (
          <>
            Todavía nada por aquí. Toca <strong>− Gasto</strong> o <strong>+ Ingreso</strong> y
            arrancamos.
          </>
        )}
      </p>
    );
  }

  const editHref = (id: string) =>
    returnTo === "/" ? `/movimientos/${id}` : `/movimientos/${id}?volver=${encodeURIComponent(returnTo)}`;

  const byId = new Map(categories.map((c) => [c.id, c]));
  const days = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    days.set(tx.occurred_on, [...(days.get(tx.occurred_on) ?? []), tx]);
  }

  return (
    <div className="mt-6 space-y-6">
      {[...days].map(([day, items]) => {
        const spent = items
          .filter((t) => t.type === "expense")
          .reduce((sum, t) => sum + Number(t.amount), 0);
        return (
          <section key={day}>
            <h2 className="tabular mb-1 flex justify-between px-1 text-xs font-medium text-muted uppercase">
              <span>{formatDay(day, today)}</span>
              {spent > 0 && <span>-{formatCOP(spent)}</span>}
            </h2>
            <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-surface ring-1 ring-border">
              {items.map((tx) => {
                const category = tx.category_id ? byId.get(tx.category_id) : undefined;
                return (
                  <li key={tx.id} data-tx-id={tx.id}>
                    <Link
                      href={editHref(tx.id)}
                      className="flex items-center gap-3 px-4 py-3 active:bg-border/40"
                    >
                      <CategoryIcon category={category} className="size-5 shrink-0 text-xl text-muted" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">
                          {tx.description || category?.name || "Sin categoría"}
                        </span>
                        {(tx.description || tx.source.startsWith("email_")) && (
                          <span className="block truncate text-xs text-muted">
                            {tx.description && (category?.name ?? "Sin categoría")}
                            {tx.description && tx.source.startsWith("email_") && " · "}
                            {tx.source.startsWith("email_") && "del correo"}
                          </span>
                        )}
                      </span>
                      <span
                        className={`tabular shrink-0 font-medium ${
                          tx.type === "income" ? "text-accent-ink" : ""
                        }`}
                      >
                        {tx.type === "income" ? "+" : "-"}
                        {formatCOP(Number(tx.amount))}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
