import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  getCategories,
  getRecentTransactions,
  getReport,
  getRules,
  getSummary,
} from "@/lib/data";
import { todayIn } from "@/lib/dates";
import type { PeriodKind } from "@/lib/report";
import { AddLauncher } from "./add/add-launcher";
import { HomePager } from "./home-pager";
import { ReportView } from "./reportes/report-view";
import { SummaryCard } from "./summary-card";
import { TransactionList } from "./transaction-list";

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const today = todayIn();

  // Dashboard: ?vista=dashboard&periodo=semana|mes&fecha=YYYY-MM-DD
  const kind: PeriodKind = params.periodo === "mes" ? "mes" : "semana";
  const requested = z.iso.date().safeParse(params.fecha);
  const anchor = requested.success && requested.data <= today ? requested.data : today;
  const onDashboard = params.vista === "dashboard";

  const [{ name }, summary, categories, rules, transactions, report] = await Promise.all([
    requireUser(),
    getSummary(today),
    getCategories(),
    getRules(),
    getRecentTransactions(),
    getReport(kind, anchor, today),
  ]);

  return (
    <>
      <HomePager
        initialPanel={onDashboard ? 1 : 0}
        home={
          <>
            <p className="mb-2 px-1 text-sm text-muted capitalize">
              Hola, {name.split(" ")[0]}
            </p>
            <SummaryCard summary={summary} today={today} />
            <TransactionList transactions={transactions} categories={categories} today={today} />
          </>
        }
        dashboard={<ReportView kind={kind} report={report} today={today} />}
      />
      <AddLauncher
        categories={categories}
        rules={rules}
        usage={transactions}
        initialType={params.nuevo === "ingreso" ? "income" : "expense"}
        startOpen={!onDashboard}
      />
    </>
  );
}
