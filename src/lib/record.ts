import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { suggestCategory } from "@/lib/ai/categorize";
import {
  fallbackCategory,
  matchCategory,
  ruleKeyword,
  type CategoryOption,
} from "@/lib/quick-add/categorize";
import { parseQuickAdd, type QuickEntry } from "@/lib/quick-add/parse";
import type { Transaction } from "@/lib/types";

export type RecordResult =
  | { ok: true; transaction: Transaction; entry: QuickEntry }
  | { ok: false; error: string };

/**
 * Registra una línea de texto como movimiento. Es el único camino de entrada
 * para la web, Telegram y futuros canales, así todos categorizan igual.
 */
export async function recordQuickEntry(
  supabase: SupabaseClient,
  text: string,
  source: "manual" | "telegram" = "manual",
): Promise<RecordResult> {
  const entry = parseQuickAdd(text);
  if (!entry) {
    return { ok: false, error: "No encontré el monto. Prueba con algo como “25k almuerzo”." };
  }

  const [{ data: categories, error: catError }, { data: rules, error: ruleError }] =
    await Promise.all([
      supabase.from("categories").select("id, key, name, type").eq("archived", false),
      supabase.from("category_rules").select("keyword, category_id"),
    ]);
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
      category_id: categoryId,
      source,
    })
    .select(
      "id, type, amount, description, merchant, category_id, account_id, occurred_on, source, status, created_at",
    )
    .single();
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
): Promise<void> {
  const keyword = ruleKeyword(description);
  if (!keyword) return;
  await supabase
    .from("category_rules")
    .upsert({ keyword, category_id: categoryId }, { onConflict: "user_id,keyword" });
}
