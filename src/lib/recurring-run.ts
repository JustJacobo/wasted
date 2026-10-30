import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "@/lib/dates";
import { dueDates, RECURRING_COLUMNS, type Recurring } from "@/lib/recurring";
import { alreadyLinked, mailForOccurrence } from "@/lib/recurring-link";
import { MAIL_SOURCES, TX_COLUMNS, type Transaction } from "@/lib/types";

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
  // Esa fecha ya tiene su cobro (llegó del correo antes, o se unió a mano): nada que crear.
  if (await alreadyLinked(admin, userId, rule, day)) return null;

  // El cobro ya llegó del correo: se une a él en vez de crear otro pendiente. Si
  // espera en la bandeja, toma el nombre y la categoría del recurrente y sigue
  // siendo una sola tarjeta; si ya estaba confirmado, ya cuenta y no se toca.
  const mail = await mailForOccurrence(admin, userId, rule, day);
  if (mail?.strength === "same") {
    const pending = mail.item.status === "pending";
    await admin
      .from("transactions")
      .update({
        recurring_id: rule.id,
        ...(pending && rule.description ? { description: rule.description } : {}),
        ...(pending && rule.category_id ? { category_id: rule.category_id } : {}),
      })
      .eq("id", mail.item.id)
      .eq("user_id", userId)
      .is("recurring_id", null);
    return null;
  }

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
  // Un correo que quizás es este cobro (otro monto, mismo nombre) va como "¿Es el mismo cobro?".
  const possibleDuplicateOf = mail?.item.id ?? similar?.[0]?.id ?? null;

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
