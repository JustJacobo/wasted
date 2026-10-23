import { redirect } from "next/navigation";
import { todayIn } from "@/lib/dates";
import { dashboardHref } from "./period-nav";

// El dashboard vive ahora en el panel derecho del inicio; esta ruta se
// mantiene para enlaces antiguos.
export default async function ReportsPage({ searchParams }: PageProps<"/reportes">) {
  const { periodo, fecha } = await searchParams;
  redirect(
    dashboardHref(
      periodo === "mes" ? "mes" : "semana",
      typeof fecha === "string" ? fecha : todayIn(),
    ),
  );
}
