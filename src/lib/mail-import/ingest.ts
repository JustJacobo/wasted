import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { occurredAt } from "@/lib/dates";
import { ingestCharge, type IngestContext } from "@/lib/ingest-charge";
import { cleanText, parseEmail, type MailMessage } from "./parsers";

export type { IngestContext };

export type MailOutcome = "recorded" | "pending" | "own_transfer" | "ignored" | "duplicate";

/**
 * Guarda un correo como movimiento por el camino común (`ingestCharge`: sin
 * repetidos y unido a su recurrente) y lo anota en `mail_messages` para no
 * volver a leerlo. Usa el cliente de servicio: todo filtra por `userId`.
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
    ({ outcome, transactionId } = await ingestCharge(
      admin,
      {
        type: parsed.kind,
        amount: parsed.amount,
        merchant: parsed.merchant,
        description: parsed.description,
        occurredOn: parsed.occurredOn,
        occurredAt: occurredAt(parsed.occurredOn, mail.date),
        confidence: parsed.confidence,
        externalId: parsed.externalId,
        source: parsed.source,
        provider: parsed.provider,
        subject: mail.subject,
        body: cleanText(mail.text).slice(0, 2000),
        meta: { from: mail.from, messageId: mail.messageId },
      },
      ctx,
    ));
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
