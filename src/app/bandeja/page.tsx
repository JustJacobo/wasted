import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getCategories, getPending, type PendingItem } from "@/lib/data";
import { todayIn } from "@/lib/dates";
import { canImportMail } from "@/lib/mail-import/sync";
import { PendingPair } from "./pending-pair";
import { PendingRow } from "./pending-row";
import { SyncButton } from "./sync-button";

type Card = { kind: "row"; item: PendingItem } | { kind: "pair"; recurring: PendingItem; mail: PendingItem };

/**
 * Un recurrente y un correo pendientes que se señalan como posible mismo cobro
 * van en una sola tarjeta; lo demás, uno por fila, en el mismo orden.
 */
function cards(pending: PendingItem[]): Card[] {
  const byId = new Map(pending.map((p) => [p.id, p]));
  const partner = new Map<string, PendingItem>();
  for (const item of pending) {
    const other = item.similar ? byId.get(item.similar.id) : undefined;
    if (!other || partner.has(item.id) || partner.has(other.id)) continue;
    if ((item.source === "recurring") === (other.source === "recurring")) continue;
    partner.set(item.id, other);
    partner.set(other.id, item);
  }
  const out: Card[] = [];
  const shown = new Set<string>();
  for (const item of pending) {
    if (shown.has(item.id)) continue;
    const other = partner.get(item.id);
    if (other) {
      shown.add(other.id);
      out.push(item.source === "recurring" ? { kind: "pair", recurring: item, mail: other } : { kind: "pair", recurring: other, mail: item });
    } else {
      out.push({ kind: "row", item });
    }
  }
  return out;
}

/** Movimientos del correo o de notificaciones y recurrentes vencidos que esperan confirmación. */
export default async function InboxPage() {
  const [{ email }, pending, categories] = await Promise.all([
    requireUser(),
    getPending(),
    getCategories(),
  ]);
  const today = todayIn();
  const fromMail = canImportMail(email);
  const recurring = pending.some((p) => p.recurring_id);
  const imported = pending.some((p) => !p.recurring_id);
  const origin = pending.some((p) => p.source === "notification")
    ? pending.some((p) => p.source.startsWith("email_"))
      ? "del correo y de notificaciones"
      : "de notificaciones"
    : "del correo";

  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center gap-2 py-2">
        <Link href="/" className="rounded-lg px-2 py-1 text-sm text-muted active:scale-[0.97]">
          ← Volver
        </Link>
        <h1 className="flex-1 text-right text-lg font-bold tracking-tight">Por revisar</h1>
      </header>

      {pending.length === 0 ? (
        <p className="rounded-xl bg-surface px-5 py-10 text-center text-sm text-muted ring-1 ring-border">
          Nada por revisar.{fromMail && " Lo que llega claro del correo se registra solo."}
        </p>
      ) : (
        <>
          <p className="px-1 text-sm text-muted">
            {recurring && imported
              ? `Recurrentes que vencieron y movimientos ${origin} que no son seguros o se parecen a algo que ya registraste.`
              : recurring
                ? "Recurrentes que vencieron. Cuentan en tu saldo cuando los agregas."
                : `Llegaron ${origin}, pero no son seguros o se parecen a algo que ya registraste.`}
          </p>
          <ul className="divide-y divide-border overflow-hidden rounded-xl bg-surface ring-1 ring-border">
            {cards(pending).map((card) =>
              card.kind === "pair" ? (
                <PendingPair
                  key={`${card.recurring.id}:${card.mail.id}`}
                  recurring={card.recurring}
                  mail={card.mail}
                  categories={categories}
                  today={today}
                />
              ) : (
                <PendingRow key={card.item.id} item={card.item} categories={categories} today={today} />
              ),
            )}
          </ul>
        </>
      )}

      {fromMail && <SyncButton />}
    </main>
  );
}
