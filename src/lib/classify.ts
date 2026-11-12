import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "@/lib/dates";
import { learnCategory } from "@/lib/record";
import type { Raw } from "@/lib/recurring-link";

// Transferencias a personas que no se reconocieron ("Enviaste $15.000 a Juan
// Pérez"): cuentan en el saldo desde que llegan, sin categoría, y se pregunta
// qué fueron. La respuesta se aprende para esa persona (`learnCategory`).
// Sirve con la sesión del usuario (app, web) y con el cliente de servicio
// (la notificación con botones): todo filtra por `userId`.

export interface ToClassify {
  id: string;
  amount: number;
  merchant: string;
  occurred_on: string;
  occurred_at: string | null;
}

/** Cuántos días atrás se sigue preguntando. */
const DAYS = 30;

/**
 * Las que esperan categoría, la más reciente primero. Si ya tienen categoría
 * (se cambió desde el movimiento o el Historial) dejan de aparecer solas.
 */
export async function listToClassify(client: SupabaseClient, userId: string, today: string): Promise<ToClassify[]> {
  const { data, error } = await client
    .from("transactions")
    .select("id, amount, merchant, description, occurred_on, occurred_at")
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .is("category_id", null)
    .eq("raw->>toClassify", "true")
    .gte("occurred_on", addDays(today, -DAYS))
    .order("occurred_on", { ascending: false })
    .order("occurred_at", { ascending: false, nullsFirst: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((t) => ({
    id: t.id,
    amount: Number(t.amount),
    merchant: t.merchant || t.description || "Transferencia",
    occurred_on: t.occurred_on,
    occurred_at: t.occurred_at,
  }));
}

/** Pone la categoría, deja de preguntar y aprende la persona para la próxima. */
export async function classifyTransaction(
  client: SupabaseClient,
  userId: string,
  id: string,
  categoryId: string,
): Promise<{ error?: string }> {
  const [{ data: tx }, { data: category }] = await Promise.all([
    client.from("transactions").select("type, merchant, description, raw").eq("id", id).eq("user_id", userId).maybeSingle(),
    client.from("categories").select("type").eq("id", categoryId).eq("user_id", userId).maybeSingle(),
  ]);
  if (!tx) return { error: "Ese movimiento ya no existe." };
  if (!category || category.type !== tx.type) return { error: "Esa categoría no sirve para este movimiento." };

  const raw: Raw = { ...((tx.raw as Raw) ?? {}) };
  delete raw.toClassify;
  const { error } = await client
    .from("transactions")
    .update({ category_id: categoryId, raw })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: "No pude guardarlo." };

  const name = tx.merchant || tx.description;
  if (name) await learnCategory(client, name, categoryId, userId);
  return {};
}
