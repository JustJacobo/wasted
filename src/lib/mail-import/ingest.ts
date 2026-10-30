import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, occurredAt } from "@/lib/dates";
import {
  fallbackCategory,
  matchCategory,
  type CategoryOption,
  type CategoryRule,
} from "@/lib/quick-add/categorize";
import { cleanText, parseEmail, type MailMessage } from "./parsers";

export type MailOutcome = "recorded" | "pending" | "own_transfer" | "ignored" | "duplicate";

export interface IngestContext {
  userId: string;
  ownerName: string;
  categories: CategoryOption[];
  rules: CategoryRule[];
}

/**
 * Guarda un correo como movimiento. Lo claro y sin parecido a nada queda
 * confirmado; lo de baja confianza o que se parece a un movimiento ya
 * registrado (mismo tipo y monto, ±1 día) queda pendiente en la bandeja.
 * Usa el cliente de servicio: todo filtra por `userId`.
 */
export async function ingestMail(
  admin: SupabaseClient,
  mail: MailMessage,
  ctx: IngestContext,
): Promise<MailOutcome> {
  const parsed = parseEmail(mail, ctx.ownerName);
  let outcome: MailOutcome;
  let transactionId: string | null = null;

  if (parsed.kind === "ignore" || parsed.kind === "own_transfer" || parsed.amount <= 0) {
    outcome = parsed.kind === "own_transfer" ? "own_transfer" : "ignored";
  } else {
    const type = parsed.kind;
    const { data: similar } = await admin
      .from("transactions")
      .select("id")
      .eq("user_id", ctx.userId)
      .eq("type", type)
      .eq("amount", parsed.amount)
      // Lo confirmado y los recurrentes que esperan en la bandeja (Netflix ya vencido).
      .or("status.eq.confirmed,and(status.eq.pending,source.eq.recurring)")
      .gte("occurred_on", addDays(parsed.occurredOn, -1))
      .lte("occurred_on", addDays(parsed.occurredOn, 1))
      .limit(1);
    const possibleDuplicateOf = similar?.[0]?.id ?? null;

    const categoryId =
      matchCategory(parsed.description, type, ctx.categories, ctx.rules) ??
      fallbackCategory(type, ctx.categories);
    const status = possibleDuplicateOf || parsed.confidence === "low" ? "pending" : "confirmed";

    const { data, error } = await admin
      .from("transactions")
      .insert({
        user_id: ctx.userId,
        type,
        amount: parsed.amount,
        description: parsed.description,
        merchant: parsed.merchant,
        category_id: categoryId,
        occurred_on: parsed.occurredOn,
        occurred_at: occurredAt(parsed.occurredOn, mail.date),
        source: parsed.source,
        status,
        external_id: parsed.externalId,
        raw: {
          provider: parsed.provider,
          from: mail.from,
          subject: mail.subject.slice(0, 200),
          messageId: mail.messageId,
          text: cleanText(mail.text).slice(0, 2000),
          ...(possibleDuplicateOf ? { possibleDuplicateOf } : {}),
        },
      })
      .select("id")
      .single();

    if (error?.code === "23505") outcome = "duplicate";
    else if (error) throw error;
    else {
      transactionId = data.id;
      outcome = status === "pending" ? "pending" : "recorded";
    }
  }

  await admin.from("mail_messages").upsert(
    {
      user_id: ctx.userId,
      message_id: mail.messageId,
      received_at: mail.date.toISOString(),
      outcome,
      transaction_id: transactionId,
    },
    { onConflict: "user_id,message_id", ignoreDuplicates: true },
  );
  return outcome;
}
