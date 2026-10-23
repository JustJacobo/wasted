import { getCategories, getRecentTransactions, getRules, getSummary } from "@/lib/data";
import { todayIn } from "@/lib/dates";
import { QuickAdd } from "./quick-add";
import { SummaryCard } from "./summary-card";
import { TransactionList } from "./transaction-list";

export default async function Home({ searchParams }: PageProps<"/">) {
  const today = todayIn();
  const [{ nuevo }, summary, categories, rules, transactions] = await Promise.all([
    searchParams,
    getSummary(today),
    getCategories(),
    getRules(),
    getRecentTransactions(),
  ]);

  return (
    <div className="mx-auto max-w-lg px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-40">
      <header className="flex items-center justify-between py-2">
        <h1 className="text-lg font-bold tracking-tight">Wasted</h1>
        <form action="/auth/signout" method="post">
          <button className="rounded-lg px-2 py-1 text-sm text-muted active:scale-[0.97]">
            Salir
          </button>
        </form>
      </header>

      <SummaryCard summary={summary} today={today} />
      <TransactionList transactions={transactions} categories={categories} today={today} />
      <QuickAdd categories={categories} rules={rules} autoFocus={nuevo === "1"} />
    </div>
  );
}
