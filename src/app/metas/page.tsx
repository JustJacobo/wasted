import Link from "next/link";
import { getGoals } from "@/lib/data";
import { formatCOP } from "@/lib/money";
import { GoalsManager } from "./goals-manager";

export default async function GoalsPage() {
  const { items, total } = await getGoals();

  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center gap-2 py-2">
        <Link href="/" className="rounded-lg px-2 py-1 text-sm text-muted active:scale-[0.97]">
          ← Volver
        </Link>
        <h1 className="flex-1 text-right text-lg font-bold tracking-tight">Metas</h1>
      </header>

      <div className="rounded-xl bg-surface p-4 ring-1 ring-border">
        <p className="text-sm text-muted">Apartado</p>
        <p className="tabular mt-1 truncate text-2xl font-semibold tracking-tight">{formatCOP(total)}</p>
      </div>

      <GoalsManager items={items} />

      <p className="px-1 text-xs text-muted">
        Lo apartado sale de lo que te queda, sin contar como gasto. Al sacarlo vuelve a tu saldo.
        También puedes escribir “aparté 50k para el viaje” en Telegram o en el modo ⌨.
      </p>
    </main>
  );
}
