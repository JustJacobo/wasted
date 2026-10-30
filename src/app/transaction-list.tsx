import Link from "next/link";
import { CategoryIcon } from "@/components/category-icon";
import { categoryColorVar } from "@/lib/category-colors";
import { formatDay, formatTime } from "@/lib/dates";
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
            Todavía no hay movimientos. Toca <strong>− Gasto</strong> o <strong>+ Ingreso</strong> para
            registrar el primero.
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
            <ul className="divide-y divide-border border-y border-border">
              {items.map((tx) => {
                const category = tx.category_id ? byId.get(tx.category_id) : undefined;
                const details = [
                  tx.occurred_at && formatTime(tx.occurred_at),
                  tx.description && (category?.name ?? "Sin categoría"),
                  tx.source.startsWith("email_") && "del correo",
                  tx.recurring_id && "recurrente",
                ].filter(Boolean);
                return (
                  <li key={tx.id} data-tx-id={tx.id}>
                    <Link
                      href={editHref(tx.id)}
                      className="-mx-1 flex items-center gap-3 px-1 py-3 active:bg-border/40"
                    >
                      <span className="flex shrink-0" style={{ color: categoryColorVar(category?.color) }}>
                        <CategoryIcon category={category} className="size-5 text-xl" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">
                          {tx.description || category?.name || "Sin categoría"}
                        </span>
                        {details.length > 0 && (
                          <span className="block truncate text-xs text-muted">{details.join(" · ")}</span>
                        )}
                      </span>
                      <span
                        className={`shrink-0 font-mono text-[15px] tracking-tight ${
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
