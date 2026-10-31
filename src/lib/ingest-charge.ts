import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { channel, pickMatch, type ChargeLike } from "@/lib/charge-match";
import { addDays } from "@/lib/dates";
import {
  fallbackCategory,
  matchCategory,
  type CategoryOption,
  type CategoryRule,
} from "@/lib/quick-add/categorize";
import { linkForCharge, retirePlaceholder, type Raw } from "@/lib/recurring-link";
import type { TxType } from "@/lib/types";

// Un solo camino para lo que llega solo (correo y notificaciones del teléfono):
// evita repetidos, se une con los recurrentes y guarda. Cliente de servicio:
// todo filtra por `userId`.

export interface IngestContext {
  userId: string;
  ownerName: string;
  categories: CategoryOption[];
  rules: CategoryRule[];
}

export interface IncomingCharge {
  type: TxType;
  amount: number;
  merchant: string;
  description: string;
  /** "YYYY-MM-DD" en hora de Colombia. */
  occurredOn: string;
  occurredAt: string | null;
  /** "low" va a la bandeja aunque no parezca repetido. */
  confidence: "high" | "low";
  externalId: string;
  source: "email_bank" | "email_invoice" | "email_other" | "notification";
  provider: string;
  /** Asunto del correo o título de la notificación. */
  subject: string;
  /** Texto recortado: a veces solo ahí aparece el nombre ("YouTube Premium"). */
  body: string;
  /** Lo propio de cada fuente que se guarda en `raw` (remitente, paquete…). */
  meta: Record<string, unknown>;
}

export type ChargeOutcome = "recorded" | "pending" | "duplicate";

const CANDIDATE_COLUMNS = "id, type, amount, occurred_on, source, status, merchant, description, category_id, recurring_id, raw";

/**
 * Lo claro y sin parecido a nada queda confirmado; lo de baja confianza o que
 * se parece a algo ya registrado queda pendiente en la bandeja.
 * - Si ya llegó por otro lado (la notificación de Nu y el correo de Uber) es el
 *   mismo cobro: no se crea otro, se completa el que estaba.
 * - Si es el cobro de un recurrente, queda pendiente y unido a él (una sola
 *   tarjeta en la bandeja) y reemplaza el pendiente del recurrente.
 */
export async function ingestCharge(
  admin: SupabaseClient,
  charge: IncomingCharge,
  ctx: IngestContext,
): Promise<{ outcome: ChargeOutcome; transactionId: string | null }> {
  const { type, amount } = charge;
  let categoryId =
    matchCategory(charge.description, type, ctx.categories, ctx.rules) ?? fallbackCategory(type, ctx.categories);
  const incoming: ChargeLike = {
    type,
    amount,
    occurred_on: charge.occurredOn,
    source: charge.source,
    provider: charge.provider,
    text: [charge.merchant, charge.description].join(" · "),
    category_id: categoryId,
  };

  // Lo confirmado y lo que espera en la bandeja, con un monto parecido y ±1 día.
  const { data: found } = await admin
    .from("transactions")
    .select(CANDIDATE_COLUMNS)
    .eq("user_id", ctx.userId)
    .eq("type", type)
    .in("status", ["confirmed", "pending"])
    .gte("amount", Math.floor(amount * 0.9))
    .lte("amount", Math.ceil(amount * 1.1))
    .gte("occurred_on", addDays(charge.occurredOn, -1))
    .lte("occurred_on", addDays(charge.occurredOn, 1))
    .limit(20);
  const arriving = channel(incoming);
  const candidates = (found ?? [])
    // Uno que ya recibió un aviso por este mismo canal no recibe otro (sería otro cobro).
    .filter((t) => !((t.raw as Raw)?.twins as string[] | undefined)?.includes(arriving))
    .map((t) => ({
      ...t,
      provider: ((t.raw as Raw)?.provider as string | undefined) ?? null,
      text: [t.merchant, t.description].filter(Boolean).join(" · "),
    }));
  const match = pickMatch(incoming, candidates);

  if (match?.strength === "same") {
    const twin = match.item;
    const raw = (twin.raw as Raw) ?? {};
    // Si el que estaba solo esperaba por no ser seguro y este sí lo es, ya cuenta.
    const confirm =
      twin.status === "pending" && charge.confidence === "high" && !raw.possibleDuplicateOf && !twin.recurring_id;
    await admin
      .from("transactions")
      .update({
        raw: { ...raw, twins: [...((raw.twins as string[] | undefined) ?? []), arriving] },
        ...(twin.merchant ? {} : { merchant: charge.merchant }),
        ...(confirm ? { status: "confirmed" } : {}),
      })
      .eq("id", twin.id)
      .eq("user_id", ctx.userId);
    return { outcome: "duplicate", transactionId: twin.id };
  }

  let possibleDuplicateOf: string | null = match?.item.id ?? null;
  let description = charge.description;
  let status = possibleDuplicateOf || charge.confidence === "low" ? "pending" : "confirmed";

  // ¿Es el cobro de un recurrente? Se confirma una sola vez, desde la bandeja.
  const link = await linkForCharge(admin, ctx.userId, {
    type,
    amount,
    occurredOn: charge.occurredOn,
    merchant: charge.merchant,
    description: charge.description,
    subject: charge.subject,
    body: charge.body,
  });
  if (link?.strength === "same") {
    status = "pending";
    categoryId = link.rule.category_id ?? categoryId;
    description = link.rule.description || description;
    if (link.kind === "pending") {
      // Hereda el parecido del pendiente del recurrente solo si es algo ya registrado
      // (si apuntaba a otro movimiento pendiente, ese queda como su propia tarjeta).
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
      amount,
      description,
      merchant: charge.merchant,
      category_id: categoryId,
      occurred_on: charge.occurredOn,
      occurred_at: charge.occurredAt,
      source: charge.source,
      status,
      recurring_id: recurringId,
      external_id: charge.externalId,
      raw: {
        provider: charge.provider,
        ...charge.meta,
        subject: charge.subject.slice(0, 200),
        text: charge.body,
        ...(possibleDuplicateOf ? { possibleDuplicateOf } : {}),
      },
    })
    .select("id")
    .single();

  if (error?.code === "23505") return { outcome: "duplicate", transactionId: null };
  if (error) throw error;
  // El pendiente del recurrente se retira. Si el cobro llegó antes de que venciera,
  // no hace falta tocar la regla: al generar, la fecha ya aparece cubierta (alreadyLinked).
  if (link?.strength === "same" && link.kind === "pending") {
    await retirePlaceholder(admin, link.placeholder, data.id, ctx.userId);
  }
  return { outcome: status === "pending" ? "pending" : "recorded", transactionId: data.id };
}
