import "server-only";

import { startOfWeek } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Transaction, WeekBudget } from "@/lib/types";
import { sendMessage, telegramConfigured } from "./api";
import { chatFor } from "./bot";
import { budgetAlertText, crossedBudget } from "./format";

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
