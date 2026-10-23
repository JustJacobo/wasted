import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getCategories, getRecentTransactions, getRules, getSummary } from "@/lib/data";
import { todayIn } from "@/lib/dates";
import { AddLauncher } from "./add/add-launcher";
import { SummaryCard } from "./summary-card";
import { TransactionList } from "./transaction-list";

export default async function Home({ searchParams }: PageProps<"/">) {
  const today = todayIn();
  const [{ nuevo }, { name }, summary, categories, rules, transactions] = await Promise.all([
    searchParams,
    requireUser(),
    getSummary(today),
    getCategories(),
    getRules(),
    getRecentTransactions(),
  ]);

  return (
    <div className="mx-auto max-w-lg px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-40">
      <header className="flex items-center justify-between py-2">
        <h1 className="text-lg font-bold tracking-tight">
          Wasted
          <span className="ml-2 text-sm font-normal text-muted capitalize">
            Hola, {name.split(" ")[0]}
          </span>
        </h1>
        <Link
          href="/ajustes"
          aria-label="Ajustes"
          className="grid size-9 place-items-center rounded-xl text-muted active:scale-[0.97]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
            <path
              d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </header>

      <SummaryCard summary={summary} today={today} />
      <TransactionList transactions={transactions} categories={categories} today={today} />
      <AddLauncher
        categories={categories}
        rules={rules}
        usage={transactions}
        initialType={nuevo === "ingreso" ? "income" : "expense"}
      />
    </div>
  );
}
