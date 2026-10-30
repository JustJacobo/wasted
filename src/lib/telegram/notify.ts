import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { startOfWeek } from "@/lib/dates";
import type { DueItem } from "@/lib/recurring-run";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Transaction, WeekBudget } from "@/lib/types";
import { sendMessage, telegramConfigured } from "./api";
import { categoriesFor, chatFor } from "./bot";
import { budgetAlertText, crossedBudget, pendingKeyboard, recurringDueText } from "./format";

/**
 * Un mensaje por cada recurrente que venció, con Agregar y Esta vez no, si el
 * usuario vinculó Telegram. Nunca lanza.
 */
export async function notifyRecurringDue(
  admin: SupabaseClient,
  userId: string,
  items: DueItem[],
  today: string,
): Promise<void> {
  if (!telegramConfigured() || items.length === 0) return;
  try {
    const chatId = await chatFor(admin, userId);
    if (!chatId) return;
    const categories = await categoriesFor(admin, userId);
    for (const { transaction: tx, similar } of items) {
      const category = categories.find((c) => c.id === tx.category_id);
      await sendMessage(chatId, recurringDueText(tx, category, today, similar), pendingKeyboard(tx.id));
    }
  } catch (error) {
    console.error("telegram: no pude avisar de los recurrentes", error);
  }
}

/**
 * Si el movimiento recién guardado hizo cruzar el 80% o el 100% de lo
 * disponible en la semana (saldo anterior + lo que entró), avisa por Telegram
 * (cuando el usuario lo vinculó). Pensado para correr dentro de `after()`:
 * nunca lanza.
 */
export async function notifyBudgetCrossing(
  userId: string,
  tx: Pick<Transaction, "type" | "amount" | "occurred_on">,
  week: WeekBudget,
  today: string,
): Promise<void> {
  if (!telegramConfigured() || tx.type !== "expense") return;
  if (tx.occurred_on < startOfWeek(today) || tx.occurred_on > today) return;
  const before = { ...week, expense: week.expense - Number(tx.amount) };
  const text = crossedBudget(before, week) ? budgetAlertText(week) : null;
  if (!text) return;

  try {
    const admin = createAdminClient();
    const chatId = await chatFor(admin, userId);
    if (chatId) await sendMessage(chatId, text);
  } catch (error) {
    console.error("telegram: no pude enviar el aviso de presupuesto", error);
  }
}
