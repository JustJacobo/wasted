import type { Transaction } from "@/lib/types";

/** Un pendiente de la bandeja (PendingItem de src/lib/data.ts). */
export interface PendingItem extends Transaction {
  provider: string | null;
  frequency: string | null;
  ruleAmount: number | null;
  similar: Pick<Transaction, "id" | "description" | "amount" | "occurred_on" | "category_id"> | null;
}

export type Card = { kind: "row"; item: PendingItem } | { kind: "pair"; recurring: PendingItem; mail: PendingItem };

/**
 * Un recurrente y un cobro importado pendientes que se señalan como posible
 * mismo cobro van en una sola tarjeta; lo demás, uno por fila (bandeja/page.tsx).
 */
export function cards(pending: PendingItem[]): Card[] {
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

export const PROVIDERS: Record<string, string> = {
  nequi: "Nequi",
  nu: "Nu",
  didi: "DiDi",
  yango: "Yango",
  uber: "Uber",
  rappi: "Rappi",
  dian: "Factura",
  otro: "Correo",
  recurrente: "Recurrente",
};
