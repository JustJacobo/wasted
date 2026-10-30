import Link from "next/link";
import { getCategories, getRecurring } from "@/lib/data";
import { todayIn } from "@/lib/dates";
import { RecurringManager } from "./recurring-manager";

export default async function RecurringPage() {
  const [recurring, categories] = await Promise.all([getRecurring(), getCategories()]);

  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center gap-2 py-2">
        <Link href="/ajustes" className="rounded-lg px-2 py-1 text-sm text-muted active:scale-[0.97]">
          ← Ajustes
        </Link>
        <h1 className="flex-1 text-right text-lg font-bold tracking-tight">Recurrentes</h1>
      </header>

      <p className="px-1 text-sm text-muted">
        Arriendo, suscripciones, la cuota semanal. Cuando llega la fecha aparecen en Por revisar y
        cuentan en tu saldo al agregarlos.
      </p>

      <RecurringManager recurring={recurring} categories={categories} today={todayIn()} />
    </main>
  );
}
