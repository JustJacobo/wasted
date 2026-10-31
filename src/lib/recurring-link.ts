import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, daysBetween } from "@/lib/dates";
import { RECURRING_COLUMNS, type Recurring } from "@/lib/recurring";
import { bestMatch, linkWindow, matchCharge, usefulHint, type MatchStrength } from "@/lib/recurring-match";
import { IMPORTED_SOURCES, type Transaction, type TxType } from "@/lib/types";

// Enlaza los cobros del correo con los recurrentes, para que un mismo cobro
// quede como un solo movimiento. Cliente de servicio: todo filtra por `userId`.

/** La ventana más amplia de `linkWindow`, para traer candidatos de la base. */
const MAX_DAYS = 3;

export type Raw = Record<string, unknown> | null;

export interface ImportedCharge {
  type: TxType;
  amount: number;
  occurredOn: string;
  merchant: string | null;
  description: string;
  subject: string;
  /** Texto del correo (recortado): a veces solo ahí aparece el nombre ("YouTube Premium"). */
  body: string;
}

export type ChargeLink =
  /** Ya hay un pendiente del recurrente para esa fecha. */
  | { kind: "pending"; strength: MatchStrength; rule: Recurring; placeholder: { id: string; raw: Raw } }
  /** El correo llegó antes de que el recurrente venciera. */
  | { kind: "due"; strength: "same"; rule: Recurring };

const chargeText = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ");
const rawText = (raw: Raw) => [raw?.subject, raw?.text].filter((v): v is string => typeof v === "string");

/** ¿Es este correo el cobro de un recurrente? El mejor candidato, o null. */
export async function linkForCharge(
  admin: SupabaseClient,
  userId: string,
  charge: ImportedCharge,
): Promise<ChargeLink | null> {
  const from = addDays(charge.occurredOn, -MAX_DAYS);
  const to = addDays(charge.occurredOn, MAX_DAYS);
  const c = {
    type: charge.type,
    amount: charge.amount,
    occurred_on: charge.occurredOn,
    text: chargeText(charge.merchant, charge.description, charge.subject, charge.body),
  };

  const { data: placeholders } = await admin
    .from("transactions")
    .select(`id, occurred_on, raw, rule:recurring_id(${RECURRING_COLUMNS})`)
    .eq("user_id", userId)
    .eq("source", "recurring")
    .eq("status", "pending")
    .eq("type", charge.type)
    .gte("occurred_on", from)
    .lte("occurred_on", to);
  const pending = bestMatch(
    (placeholders ?? [])
      .map((p) => ({ ...p, rule: p.rule as unknown as Recurring | null }))
      .filter((p) => p.rule)
      .map((p) => ({
        item: p,
        strength: matchCharge(p.rule!, p.occurred_on, c),
        days: daysBetween(p.occurred_on, charge.occurredOn),
      })),
  );
  if (pending) {
    const { id, raw, rule } = pending.item;
    return { kind: "pending", strength: pending.strength, rule: rule!, placeholder: { id, raw: raw as Raw } };
  }

  const { data: rules } = await admin
    .from("recurring")
    .select(RECURRING_COLUMNS)
    .eq("user_id", userId)
    .eq("paused", false)
    .eq("type", charge.type)
    .gte("next_on", from)
    .lte("next_on", to);
  const due = bestMatch(
    ((rules ?? []) as Recurring[]).map((r) => ({
      item: r,
      strength: matchCharge(r, r.next_on, c),
      days: daysBetween(r.next_on, charge.occurredOn),
    })),
  );
  return due?.strength === "same" ? { kind: "due", strength: "same", rule: due.item } : null;
}

export interface ImportedTx {
  id: string;
  status: Transaction["status"];
}

/** Un movimiento del correo, todavía sin recurrente, que sea el cobro de esta fecha. */
export async function importedForOccurrence(
  admin: SupabaseClient,
  userId: string,
  rule: Recurring,
  day: string,
): Promise<{ item: ImportedTx; strength: MatchStrength } | null> {
  const days = linkWindow(rule);
  const { data } = await admin
    .from("transactions")
    .select("id, type, amount, occurred_on, merchant, description, status, raw")
    .eq("user_id", userId)
    .in("source", IMPORTED_SOURCES)
    .is("recurring_id", null)
    .in("status", ["pending", "confirmed"])
    .eq("type", rule.type)
    .gte("occurred_on", addDays(day, -days))
    .lte("occurred_on", addDays(day, days));
  return bestMatch(
    (data ?? []).map((t) => ({
      item: { id: t.id, status: t.status } as ImportedTx,
      strength: matchCharge(rule, day, {
        type: t.type,
        amount: t.amount,
        occurred_on: t.occurred_on,
        text: chargeText(t.merchant, t.description, ...rawText(t.raw as Raw)),
      }),
      days: daysBetween(day, t.occurred_on),
    })),
  );
}

/** ¿Esta fecha del recurrente ya tiene su cobro (del correo o registrado a mano)? */
export async function alreadyLinked(
  admin: SupabaseClient,
  userId: string,
  rule: Recurring,
  day: string,
): Promise<boolean> {
  const days = linkWindow(rule);
  const { data } = await admin
    .from("transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("recurring_id", rule.id)
    .neq("source", "recurring")
    .in("status", ["pending", "confirmed"])
    .gte("occurred_on", addDays(day, -days))
    .lte("occurred_on", addDays(day, days))
    .limit(1);
  return Boolean(data?.length);
}

/**
 * Al confirmar un cobro del correo unido a un recurrente: la regla aprende cómo
 * se llama en el correo y toma el monto cobrado (si subió el precio).
 * Con el cliente de sesión basta RLS; con el de servicio, pasar `userId`.
 */
export async function learnFromCharge(
  client: SupabaseClient,
  tx: Pick<Transaction, "recurring_id" | "source" | "merchant" | "amount"> & { raw?: unknown },
  userId?: string,
): Promise<void> {
  if (!tx.recurring_id || !IMPORTED_SOURCES.includes(tx.source)) return;
  const hint = usefulHint(tx.merchant, (tx.raw as Raw)?.provider as string | undefined);
  let query = client
    .from("recurring")
    .update({ amount: tx.amount, ...(hint ? { match_hint: hint } : {}) })
    .eq("id", tx.recurring_id);
  if (userId) query = query.eq("user_id", userId);
  await query;
}

/**
 * Retira el pendiente de un recurrente porque su cobro llegó del correo:
 * queda `discarded` (su external_id evita que vuelva) y apunta al movimiento
 * del correo, para que los botones del aviso de Telegram actúen sobre ese.
 */
export async function retirePlaceholder(
  client: SupabaseClient,
  placeholder: { id: string; raw: Raw },
  intoId: string,
  userId?: string,
): Promise<boolean> {
  let query = client
    .from("transactions")
    .update({ status: "discarded", raw: { ...(placeholder.raw ?? {}), mergedInto: intoId } })
    .eq("id", placeholder.id)
    .eq("status", "pending");
  if (userId) query = query.eq("user_id", userId);
  const { data } = await query.select("id");
  return Boolean(data?.length);
}
