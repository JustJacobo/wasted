import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildReport, periodRange, previousRange, type PeriodKind, type Report } from "@/lib/report";

/**
 * Reporte del periodo que contiene `anchor`. Con el cliente de sesión, RLS ya
 * limita al usuario; con el cliente de servicio hay que pasar `userId`.
 */
export async function fetchReport(
  supabase: SupabaseClient,
  kind: PeriodKind,
  anchor: string,
  today: string,
  userId?: string,
): Promise<Report> {
  const range = periodRange(kind, anchor);
  const prev = previousRange(kind, range);

  let txQuery = supabase
    .from("transactions")
    .select("type, amount, category_id, occurred_on")
    .eq("status", "confirmed")
    .gte("occurred_on", prev.start)
    .lte("occurred_on", range.end);
  let catQuery = supabase.from("categories").select("id, name, emoji");
  if (userId) {
    txQuery = txQuery.eq("user_id", userId);
    catQuery = catQuery.eq("user_id", userId);
  }

  const [{ data: transactions, error }, { data: categories, error: catError }] = await Promise.all([
    txQuery,
    catQuery,
  ]);
  if (error) throw error;
  if (catError) throw catError;
  return buildReport(kind, anchor, today, transactions, categories);
}
