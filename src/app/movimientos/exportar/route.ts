import type { NextRequest } from "next/server";
import { getAllTransactions, getCategories, getTransactionsForMonth } from "@/lib/data";
import { todayIn } from "@/lib/dates";
import { transactionsCsv } from "@/lib/export-csv";
import { historyParams } from "../params";

/**
 * CSV de los movimientos confirmados: `?todo=1` trae el historial completo; si
 * no, el mes del Historial con sus filtros (mismos parámetros que la página).
 * La sesión la exigen el proxy y `requireUser` dentro de cada consulta.
 */
export async function GET(request: NextRequest) {
  const today = todayIn();
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const everything = params.todo === "1";
  const { month, filters } = historyParams(params, today);

  const [transactions, categories] = await Promise.all([
    // El Historial lista del más reciente al más antiguo; una hoja se lee al revés.
    everything ? getAllTransactions() : getTransactionsForMonth(filters).then((list) => list.reverse()),
    getCategories(),
  ]);

  const name = everything ? `wasted-${today}.csv` : `wasted-${month}.csv`;
  return new Response(transactionsCsv(transactions, categories), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
