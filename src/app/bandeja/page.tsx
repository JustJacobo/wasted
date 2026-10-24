import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getCategories, getPending } from "@/lib/data";
import { todayIn } from "@/lib/dates";
import { canImportMail } from "@/lib/mail-import/sync";
import { PendingRow } from "./pending-row";
import { SyncButton } from "./sync-button";

/** Movimientos importados del correo que esperan confirmación. */
export default async function InboxPage() {
  const [{ email }, pending, categories] = await Promise.all([
    requireUser(),
    getPending(),
    getCategories(),
  ]);
  const today = todayIn();

  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center gap-2 py-2">
        <Link href="/" className="rounded-lg px-2 py-1 text-sm text-muted active:scale-[0.97]">
          ← Volver
        </Link>
        <h1 className="flex-1 text-right text-lg font-bold tracking-tight">Por revisar</h1>
      </header>

      {pending.length === 0 ? (
        <p className="rounded-3xl bg-surface px-5 py-10 text-center text-sm text-muted ring-1 ring-border">
          Nada por revisar. Lo que llega claro del correo se anota solo.
        </p>
      ) : (
        <>
          <p className="px-1 text-sm text-muted">
            Llegaron del correo, pero no son seguros o se parecen a algo que ya registraste.
          </p>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-surface ring-1 ring-border">
            {pending.map((item) => (
              <PendingRow key={item.id} item={item} categories={categories} today={today} />
            ))}
          </ul>
        </>
      )}

      {canImportMail(email) && <SyncButton />}
    </main>
  );
}
