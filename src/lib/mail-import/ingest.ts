import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, occurredAt } from "@/lib/dates";
import {
  fallbackCategory,
  matchCategory,
  type CategoryOption,
  type CategoryRule,
} from "@/lib/quick-add/categorize";
import { linkForMail, retirePlaceholder } from "@/lib/recurring-link";
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
 * Si es el cobro de un recurrente, queda pendiente y unido a él (una sola
 * tarjeta en la bandeja) y reemplaza el pendiente del recurrente.
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
    let possibleDuplicateOf: string | null = similar?.[0]?.id ?? null;
    let categoryId =
      matchCategory(parsed.description, type, ctx.categories, ctx.rules) ??
      fallbackCategory(type, ctx.categories);
    let description = parsed.description;
    let status = possibleDuplicateOf || parsed.confidence === "low" ? "pending" : "confirmed";

    // ¿Es el cobro de un recurrente? Se confirma una sola vez, desde la bandeja.
    const body = cleanText(mail.text).slice(0, 2000);
    const link = await linkForMail(admin, ctx.userId, {
      type,
      amount: parsed.amount,
      occurredOn: parsed.occurredOn,
      merchant: parsed.merchant,
      description: parsed.description,
      subject: mail.subject,
      body,
    });
    if (link?.strength === "same") {
      status = "pending";
      categoryId = link.rule.category_id ?? categoryId;
      description = link.rule.description || description;
      if (link.kind === "pending") {
        // Hereda el parecido del pendiente del recurrente solo si es algo ya registrado
        // (si apuntaba a otro correo pendiente, ese queda como su propia tarjeta).
        const inherited = link.placeholder.raw?.possibleDuplicateOf as string | undefined;
        const { data: registered } = inherited
          ? await admin.from("transactions").select("id").eq("id", inherited).eq("user_id", ctx.userId).eq("status", "confirmed")
          : { data: [] };
        possibleDuplicateOf = registered?.[0]?.id ?? null;
      }
    } else if (link?.kind === "pending") {
      // Posible: una sola tarjeta "¿Es el mismo cobro?" con el pendiente del recurrente.
      status = "pending";
      possibleDuplicateOf = link.placeholder.id;
    }
    const recurringId = link?.strength === "same" ? link.rule.id : null;

    const { data, error } = await admin
      .from("transactions")
      .insert({
        user_id: ctx.userId,
        type,
        amount: parsed.amount,
        description,
        merchant: parsed.merchant,
        category_id: categoryId,
        occurred_on: parsed.occurredOn,
        occurred_at: occurredAt(parsed.occurredOn, mail.date),
        source: parsed.source,
        status,
        recurring_id: recurringId,
        external_id: parsed.externalId,
        raw: {
          provider: parsed.provider,
          from: mail.from,
          subject: mail.subject.slice(0, 200),
          messageId: mail.messageId,
          text: body,
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
      // El pendiente del recurrente se retira. Si el correo llegó antes de que venciera,
      // no hace falta tocar la regla: al generar, la fecha ya aparece cubierta (alreadyLinked).
      if (link?.strength === "same" && link.kind === "pending") {
        await retirePlaceholder(admin, link.placeholder, data.id, ctx.userId);
      }
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
