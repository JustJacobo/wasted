import { getCategories, getRecurring } from "@/lib/data";
import { todayIn } from "@/lib/dates";
import { ScreenHeader } from "@/components/screen-header";
import { RecurringManager } from "../ajustes/recurrentes/recurring-manager";

/** Arriendo, suscripciones, la cuota semanal. Se llega desde el Plan; ?nuevo=1 abre el formulario. */
export default async function RecurringPage({ searchParams }: PageProps<"/recurrentes">) {
  const [{ nuevo }, recurring, categories] = await Promise.all([searchParams, getRecurring(), getCategories()]);

  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <ScreenHeader title="Recurrentes" back="/plan" />
      <p className="px-1 text-sm text-muted">
        Arriendo, suscripciones, la cuota semanal. Cuando llega la fecha aparecen en Por revisar, y al
        registrar un gasto puedes marcarlos como pagados.
      </p>
      <RecurringManager recurring={recurring} categories={categories} today={todayIn()} startCreating={nuevo === "1"} />
    </main>
  );
}
