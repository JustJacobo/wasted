import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { suggestCategory } from "@/lib/ai/categorize";
import {
  fallbackCategory,
  matchCategory,
  ruleKeyword,
  type CategoryOption,
} from "@/lib/quick-add/categorize";
import { occurredAt } from "@/lib/dates";
import { parseQuickAdd, type QuickEntry } from "@/lib/quick-add/parse";
import type { Transaction } from "@/lib/types";

export type RecordResult =
  | { ok: true; transaction: Transaction; entry: QuickEntry }
  | { ok: false; error: string; duplicate?: boolean };

export interface RecordOptions {
  source?: "manual" | "telegram";
  /** Obligatorio con el cliente de servicio (sin sesión): filtra y asigna al usuario. */
  userId?: string;
  /** Evita registrar dos veces lo mismo (p. ej. un mensaje de Telegram reintentado). */
  externalId?: string;
  now?: Date;
}

/**
 * Registra una línea de texto como movimiento. Es el único camino de entrada
 * para la web, Telegram y futuros canales, así todos categorizan igual.
 */
export async function recordQuickEntry(
  supabase: SupabaseClient,
  text: string,
  { source = "manual", userId, externalId, now }: RecordOptions = {},
): Promise<RecordResult> {
  const entry = parseQuickAdd(text, now);
  if (!entry) {
    return { ok: false, error: "No encontré el monto. Prueba con algo como “25k almuerzo”." };
  }

  let categoriesQuery = supabase.from("categories").select("id, key, name, type").eq("archived", false);
  let rulesQuery = supabase.from("category_rules").select("keyword, category_id");
  if (userId) {
    categoriesQuery = categoriesQuery.eq("user_id", userId);
    rulesQuery = rulesQuery.eq("user_id", userId);
  }
  const [{ data: categories, error: catError }, { data: rules, error: ruleError }] =
    await Promise.all([categoriesQuery, rulesQuery]);
  if (catError || ruleError) return { ok: false, error: "No pude leer tus categorías." };

  const options = categories as CategoryOption[];
  const categoryId =
    matchCategory(entry.description, entry.type, options, rules) ??
    (await suggestCategory(entry.description, entry.type, options)) ??
    fallbackCategory(entry.type, options);

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      type: entry.type,
      amount: entry.amount,
      description: entry.description,
      occurred_on: entry.occurredOn,
      occurred_at: occurredAt(entry.occurredOn, now),
      category_id: categoryId,
      source,
      ...(userId ? { user_id: userId } : {}),
      ...(externalId ? { external_id: externalId } : {}),
    })
    .select(
      "id, type, amount, description, merchant, category_id, account_id, occurred_on, occurred_at, source, status, created_at",
    )
    .single();
  if (error?.code === "23505") return { ok: false, error: "Ya estaba registrado.", duplicate: true };
  if (error) return { ok: false, error: "No pude guardar el movimiento." };

  return { ok: true, transaction: data, entry };
}

/**
 * Cuando el usuario corrige una categoría, recuerda la descripción para que la
 * próxima vez se asigne sola.
 */
export async function learnCategory(
  supabase: SupabaseClient,
  description: string,
  categoryId: string,
  userId?: string,
): Promise<void> {
  const keyword = ruleKeyword(description);
  if (!keyword) return;
  await supabase
    .from("category_rules")
    .upsert(
      { keyword, category_id: categoryId, ...(userId ? { user_id: userId } : {}) },
      { onConflict: "user_id,keyword" },
    );
}
