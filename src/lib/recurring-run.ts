import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "@/lib/dates";
import { dueDates, type Recurring } from "@/lib/recurring";
import { TX_COLUMNS, type Transaction } from "@/lib/types";

const MAIL_SOURCES = ["email_bank", "email_invoice", "email_other"];

export const RECURRING_COLUMNS =
  "id, type, amount, description, category_id, every, unit, starts_on, next_on, paused";

/** Usuarios con algún recurrente vencido (para el cron). */
export async function usersWithDue(admin: SupabaseClient, today: string): Promise<string[]> {
  const { data, error } = await admin
    .from("recurring")
    .select("user_id")
    .eq("paused", false)
    .lte("next_on", today);
  if (error) throw error;
  return [...new Set(data.map((r) => r.user_id as string))];
}

export interface DueItem {
  transaction: Transaction;
  /** Ya hay un movimiento confirmado igual (mismo tipo y monto, ±1 día). */
  similar: boolean;
}

/**
 * Crea como pendientes (en la bandeja) los recurrentes del usuario que ya
 * vencieron y avanza su próxima fecha. Usa el cliente de servicio: todo filtra
 * por `userId`. Correr dos veces no duplica: cada fecha tiene su `external_id`.
 * Devuelve los movimientos creados en esta corrida.
 */
export async function generateDue(
  admin: SupabaseClient,
  userId: string,
  today: string,
): Promise<DueItem[]> {
  const { data: rules, error } = await admin
    .from("recurring")
    .select(RECURRING_COLUMNS)
    .eq("user_id", userId)
    .eq("paused", false)
    .lte("next_on", today);
  if (error) throw error;

  const created: DueItem[] = [];
  for (const rule of rules as Recurring[]) {
    const { dates, nextOn } = dueDates(rule, today);
    for (const day of dates) {
      const item = await insertOccurrence(admin, userId, rule, day);
      if (item) created.push(item);
    }
    // Solo avanza si nadie lo cambió entretanto (otra corrida o una edición).
    await admin
      .from("recurring")
      .update({ next_on: nextOn })
      .eq("id", rule.id)
      .eq("user_id", userId)
      .eq("next_on", rule.next_on);
  }
  return created;
}

async function insertOccurrence(
  admin: SupabaseClient,
  userId: string,
  rule: Recurring,
  day: string,
): Promise<DueItem | null> {
  // ¿Ya se registró, o llegó del correo (aunque espere en la bandeja)? Mismo tipo y monto, ±1 día.
  const { data: similar } = await admin
    .from("transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("type", rule.type)
    .eq("amount", rule.amount)
    .or(`status.eq.confirmed,and(status.eq.pending,source.in.(${MAIL_SOURCES.join(",")}))`)
    .or(`recurring_id.is.null,recurring_id.neq.${rule.id}`)
    .gte("occurred_on", addDays(day, -1))
    .lte("occurred_on", addDays(day, 1))
    .limit(1);
  const possibleDuplicateOf = similar?.[0]?.id ?? null;

  const { data, error } = await admin
    .from("transactions")
    .insert({
      user_id: userId,
      type: rule.type,
      amount: rule.amount,
      description: rule.description,
      category_id: rule.category_id,
      occurred_on: day,
      source: "recurring",
      status: "pending",
      recurring_id: rule.id,
      external_id: `rec:${rule.id}:${day}`,
      raw: { provider: "recurrente", ...(possibleDuplicateOf ? { possibleDuplicateOf } : {}) },
    })
    .select(TX_COLUMNS)
    .single<Transaction>();
  if (error?.code === "23505") return null;
  if (error) throw error;
  return { transaction: data, similar: Boolean(possibleDuplicateOf) };
}
