import Link from "next/link";
import { z } from "zod";
import { getCategories, getTransactionsForMonth } from "@/lib/data";
import { addDays, formatMonth, todayIn } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import { TransactionList } from "../transaction-list";
import { HistoryFilters } from "./history-filters";

const TYPES = { todos: null, gasto: "expense", ingreso: "income" } as const;
type TypeParam = keyof typeof TYPES;

export default async function HistoryPage({ searchParams }: PageProps<"/movimientos">) {
  const params = await searchParams;
  const today = todayIn();
  const current = today.slice(0, 7);

  const monthParam = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).safeParse(params.mes);
  const month = monthParam.success && monthParam.data <= current ? monthParam.data : current;
  const typeKey: TypeParam =
    typeof params.tipo === "string" && params.tipo in TYPES ? (params.tipo as TypeParam) : "todos";
  const cat = z.uuid().safeParse(params.cat);
  const categoryId = cat.success ? cat.data : null;
  const query = typeof params.q === "string" ? params.q.slice(0, 100) : "";

  const [transactions, categories] = await Promise.all([
    getTransactionsForMonth({ month, type: TYPES[typeKey], categoryId, query }),
    getCategories(),
  ]);

  const href = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams();
    const merged = { mes: month, tipo: typeKey, cat: categoryId, q: query || null, ...changes };
    for (const [k, v] of Object.entries(merged)) {
      if (v && !(k === "tipo" && v === "todos") && !(k === "mes" && v === current)) next.set(k, v);
    }
    const qs = next.toString();
    return qs ? `/movimientos?${qs}` : "/movimientos";
  };
  const prevMonth = addDays(`${month}-01`, -1).slice(0, 7);
  const nextMonth = addDays(`${month}-28`, 7).slice(0, 7);
  const filtered = typeKey !== "todos" || categoryId !== null || query !== "";

  const expense = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);
  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);

  const arrow =
    "grid size-11 place-items-center rounded-xl text-xl transition-transform duration-150 ease-ui active:scale-[0.97]";

  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center gap-2 py-2">
        <Link href="/" className="rounded-lg px-2 py-1 text-sm text-muted active:scale-[0.97]">
          ← Volver
        </Link>
        <h1 className="flex-1 text-right text-lg font-bold tracking-tight">Historial</h1>
      </header>

      <div className="flex items-center justify-between">
        <Link href={href({ mes: prevMonth })} replace scroll={false} aria-label="Mes anterior" className={arrow}>
          ‹
        </Link>
        <h2 className="font-semibold">{formatMonth(`${month}-01`)}</h2>
        {month >= current ? (
          <span aria-hidden className={`${arrow} opacity-20`}>
            ›
          </span>
        ) : (
          <Link href={href({ mes: nextMonth })} replace scroll={false} aria-label="Mes siguiente" className={arrow}>
            ›
          </Link>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-surface p-1 ring-1 ring-border">
        {(["todos", "gasto", "ingreso"] as const).map((t) => (
          <Link
            key={t}
            href={href({ tipo: t })}
            replace
            scroll={false}
            aria-current={t === typeKey ? "page" : undefined}
            className={`grid h-10 place-items-center rounded-xl text-sm font-medium transition-colors duration-150 ${
              t === typeKey ? "bg-foreground text-background" : "text-muted"
            }`}
          >
            {t === "todos" ? "Todo" : t === "gasto" ? "Gastos" : "Ingresos"}
          </Link>
        ))}
      </div>

      <HistoryFilters categories={categories} categoryId={categoryId} query={query} />

      <p className="tabular px-1 text-sm text-muted" aria-live="polite">
        {transactions.length} {transactions.length === 1 ? "movimiento" : "movimientos"}
        {expense > 0 && (
          <>
            {" · Gastos "}
            <span className="text-foreground">{formatCOP(expense)}</span>
          </>
        )}
        {income > 0 && (
          <>
            {" · Ingresos "}
            <span className="text-foreground">{formatCOP(income)}</span>
          </>
        )}
      </p>

      <TransactionList
        transactions={transactions}
        categories={categories}
        today={today}
        returnTo={href({})}
        empty={
          filtered ? (
            <>
              No hay movimientos con estos filtros.{" "}
              <Link href={href({ tipo: "todos", cat: null, q: null })} className="underline">
                Quitar filtros
              </Link>
            </>
          ) : (
            "No hay movimientos en este mes."
          )
        }
      />
    </main>
  );
}
