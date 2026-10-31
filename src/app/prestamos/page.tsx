import Link from "next/link";
import { getLoans } from "@/lib/data";
import { todayIn } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import { LoansManager } from "./loans-manager";

export default async function LoansPage() {
  const { items, owedToMe, iOwe } = await getLoans();

  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center gap-2 py-2">
        <Link href="/" className="rounded-lg px-2 py-1 text-sm text-muted active:scale-[0.97]">
          ← Volver
        </Link>
        <h1 className="flex-1 text-right text-lg font-bold tracking-tight">Préstamos</h1>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-surface p-4 ring-1 ring-border">
          <p className="text-sm text-muted">Te deben</p>
          <p className="tabular mt-1 truncate text-2xl font-semibold tracking-tight">{formatCOP(owedToMe)}</p>
        </div>
        <div className="rounded-xl bg-surface p-4 ring-1 ring-border">
          <p className="text-sm text-muted">Debes</p>
          <p className="tabular mt-1 truncate text-2xl font-semibold tracking-tight">{formatCOP(iOwe)}</p>
        </div>
      </div>

      <LoansManager items={items} today={todayIn()} />

      <p className="px-1 text-xs text-muted">
        Prestar baja lo que te queda y que te paguen lo sube, sin contar como gasto ni ingreso. También
        puedes escribirlo en Telegram o en el modo ⌨: “le presté 20k a Juan”, “Juan me pagó 20k”.
      </p>
    </main>
  );
}
