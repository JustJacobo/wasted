import { z } from "zod";
import { getReport } from "@/lib/data";
import { todayIn } from "@/lib/dates";
import type { PeriodKind } from "@/lib/report";
import { ScreenHeader } from "@/components/screen-header";
import { TabBar } from "@/components/tab-bar";
import { ReportView } from "./report-view";

/** Reportes (el Dashboard): ?periodo=semana|mes&fecha=YYYY-MM-DD. */
export default async function ReportsPage({ searchParams }: PageProps<"/reportes">) {
  const params = await searchParams;
  const today = todayIn();
  const kind: PeriodKind = params.periodo === "mes" ? "mes" : "semana";
  const requested = z.iso.date().safeParse(params.fecha);
  const anchor = requested.success && requested.data <= today ? requested.data : today;
  const report = await getReport(kind, anchor, today);

  return (
    <>
      <main className="mx-auto max-w-lg px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-32">
        <ScreenHeader title="Reportes" />
        <ReportView kind={kind} report={report} today={today} />
      </main>
      <TabBar />
    </>
  );
}
