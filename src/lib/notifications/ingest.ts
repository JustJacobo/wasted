import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ingestCharge, type ChargeOutcome, type IngestContext } from "@/lib/ingest-charge";
import type { Transaction } from "@/lib/types";
import { parseNotification, WATCHED_PACKAGES, type PhoneNotification } from "./parsers";

export type NotificationOutcome = ChargeOutcome | "own_transfer" | "ignored";

/** Una notificación vuelve a publicarse (se actualiza) con otra hora: mismo texto en este margen es la misma. */
const REPOST_WINDOW_MS = 10 * 60 * 1000;

export const notificationId = (n: PhoneNotification) =>
  createHash("sha256").update(`${n.package}\n${n.postedAt.getTime()}\n${n.title}\n${n.text}`).digest("hex");

/**
 * Convierte una notificación del teléfono en movimiento por el camino común
 * (`ingestCharge`) y la anota en `notification_log`. Las de apps que no están
 * en la lista no se guardan. Cliente de servicio: todo filtra por `userId`.
 */
export async function ingestNotification(
  admin: SupabaseClient,
  notification: PhoneNotification,
  ctx: IngestContext,
): Promise<{ outcome: NotificationOutcome; transaction: Pick<Transaction, "type" | "amount" | "occurred_on"> | null }> {
  if (!WATCHED_PACKAGES[notification.package]) return { outcome: "ignored", transaction: null };
  const n = { ...notification, title: notification.title.trim().slice(0, 300), text: notification.text.trim().slice(0, 1000) };

  const id = notificationId(n);
  const { data: seen } = await admin
    .from("notification_log")
    .select("id")
    .eq("user_id", ctx.userId)
    .eq("package", n.package)
    .eq("title", n.title)
    .eq("text", n.text)
    .gte("posted_at", new Date(n.postedAt.getTime() - REPOST_WINDOW_MS).toISOString())
    .lte("posted_at", new Date(n.postedAt.getTime() + REPOST_WINDOW_MS).toISOString())
    .limit(1);
  if (seen?.length) return { outcome: "duplicate", transaction: null };

  const parsed = parseNotification(n, ctx.ownerName);
  let outcome: NotificationOutcome;
  let transactionId: string | null = null;
  let transaction: Pick<Transaction, "type" | "amount" | "occurred_on"> | null = null;

  if (parsed.kind === "ignore" || parsed.kind === "own_transfer") {
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
        occurredAt: n.postedAt.toISOString(),
        confidence: parsed.confidence,
        externalId: `notif:${id}`,
        source: "notification",
        provider: parsed.provider,
        subject: n.title,
        body: n.text,
        meta: { package: n.package },
      },
      ctx,
    ));
    if (outcome === "recorded") {
      transaction = { type: parsed.kind, amount: parsed.amount, occurred_on: parsed.occurredOn };
    }
  }

  await admin.from("notification_log").upsert(
    {
      user_id: ctx.userId,
      id,
      package: n.package,
      title: n.title,
      text: n.text,
      posted_at: n.postedAt.toISOString(),
      outcome,
      transaction_id: transactionId,
    },
    { onConflict: "user_id,id", ignoreDuplicates: true },
  );
  return { outcome, transaction };
}
