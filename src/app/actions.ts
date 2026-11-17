"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth";
import { safeReturnPath } from "@/lib/search";
import { learnCategory, recordQuickEntry } from "@/lib/record";
import { recordMoneyMove } from "@/lib/record-move";
import { balance } from "@/lib/budget";
import { getSummary } from "@/lib/data";
import { weekBudget } from "@/lib/report-data";
import { addDays, atTime, occurredAt, todayIn } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import { notifyBudgetCrossing } from "@/lib/telegram/notify";
import { nextAfter, RECURRING_COLUMNS, type Recurring } from "@/lib/recurring";
import { learnFromCharge } from "@/lib/recurring-link";
import { linkWindow } from "@/lib/recurring-match";
import { IMPORTED_SOURCES, TX_COLUMNS, type Transaction, type WeekBudget } from "@/lib/types";

/** Un movimiento igual que ya llegó solo o ya está como recurrente (posible repetido). */
export interface Similar {
  label: string;
  from: "mail" | "notification" | "recurring";
}

export type QuickAddState =
  | { status: "idle" }
  /** `paid`: el nombre del recurrente que quedó pagado con este movimiento. */
  | { status: "ok"; transaction: Transaction; week: WeekBudget; similar: Similar | null; paid?: string; at: number }
  /** Un préstamo, un pago o una meta ("le presté 20k a juan"): no es un movimiento. */
  | { status: "moved"; message: string; at: number }
  | { status: "error"; error: string; at: number };

/**
 * Si el correo o una notificación ya trajo un movimiento igual (tipo y monto, ±1 día), o ya está
 * como recurrente (en la bandeja o confirmado), lo describe para avisar en la
 * confirmación; el usuario decide si deshace.
 */
async function similarImported(supabase: SupabaseClient, tx: Transaction): Promise<Similar | null> {
  const { data } = await supabase
    .from("transactions")
    .select("description, merchant, amount, source")
    .in("source", [...IMPORTED_SOURCES, "recurring"])
    .in("status", ["confirmed", "pending"])
    .eq("type", tx.type)
    .eq("amount", tx.amount)
    .neq("id", tx.id)
    .gte("occurred_on", addDays(tx.occurred_on, -1))
    .lte("occurred_on", addDays(tx.occurred_on, 1))
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    label: `${data.merchant || data.description || "movimiento"} ${formatCOP(Number(data.amount))}`,
    from: data.source === "recurring" || data.source === "notification" ? data.source : "mail",
  };
}

export async function quickAdd(text: string): Promise<QuickAddState> {
  const { supabase, userId } = await requireUser();
  const move = await recordMoneyMove(supabase, text.slice(0, 200));
  if (move) {
    if (!move.ok) return { status: "error", error: move.error, at: Date.now() };
    revalidatePath("/");
    revalidatePath("/prestamos");
    revalidatePath("/metas");
    const week = weekBudget(await getSummary(todayIn()));
    return { status: "moved", message: `${move.message}. Te quedan ${formatCOP(balance(week))}.`, at: Date.now() };
  }
  const result = await recordQuickEntry(supabase, text.slice(0, 200));
  if (!result.ok) return { status: "error", error: result.error, at: Date.now() };
  revalidatePath("/");
  revalidatePath("/movimientos");
  const today = todayIn();
  const [summary, similar] = await Promise.all([
    getSummary(today),
    similarImported(supabase, result.transaction),
  ]);
  const week = weekBudget(summary);
  after(() => notifyBudgetCrossing(userId, result.transaction, week, today));
  return { status: "ok", transaction: result.transaction, week, similar, at: Date.now() };
}

const NewTransaction = z.object({
  type: z.enum(["expense", "income"]),
  amount: z.number().int().positive().max(999_999_999_999),
  categoryId: z.uuid(),
  description: z.string().trim().max(200),
  occurredOn: z.iso.date(),
});

/** Registro desde los botones de la ventana de añadir (monto → categoría). */
export async function addTransaction(
  input: z.input<typeof NewTransaction>,
): Promise<QuickAddState> {
  const { supabase, userId } = await requireUser();
  const parsed = NewTransaction.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: "Revisa el monto y la categoría.", at: Date.now() };
  }

  const { type, amount, categoryId, description, occurredOn } = parsed.data;
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      type,
      amount,
      category_id: categoryId,
      description,
      occurred_on: occurredOn,
      occurred_at: occurredAt(occurredOn),
      source: "manual",
    })
    .select(TX_COLUMNS)
    .single();
  if (error) return { status: "error", error: "No pude guardar el movimiento.", at: Date.now() };

  // La nota con su categoría alimenta las reglas del modo texto y de Telegram.
  if (description) after(() => learnCategory(supabase, description, categoryId));

  revalidatePath("/");
  revalidatePath("/movimientos");
  const today = todayIn();
  const [summary, similar] = await Promise.all([getSummary(today), similarImported(supabase, data)]);
  const week = weekBudget(summary);
  after(() => notifyBudgetCrossing(userId, data, week, today));
  return { status: "ok", transaction: data, week, similar, at: Date.now() };
}

export async function deleteTransaction(id: string): Promise<void> {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("transactions")
    .delete()
    .eq("id", z.uuid().parse(id))
    .select("recurring_id, raw")
    .maybeSingle();
  // Era el pago adelantado de un recurrente: esa fecha vuelve a quedar por pagar.
  if (data) await restoreOccurrence(supabase, data);
  revalidatePath("/");
  revalidatePath("/movimientos");
  revalidatePath("/ajustes/recurrentes");
}

/** Lo que guarda un recurrente marcado pagado, para poder deshacerlo. */
interface PaidRaw {
  /** Era un pendiente: cómo estaba antes de confirmarlo (y la regla, si aprendió del correo). */
  before?: Pick<Transaction, "amount" | "description" | "category_id" | "occurred_on" | "occurred_at"> & {
    rule?: Pick<Recurring, "amount" | "match_hint">;
  };
  /** Se pagó antes de que venciera: la fecha de la serie que cubre. */
  paidOccurrence?: string;
}

type Raw = (PaidRaw & Record<string, unknown>) | null;

/** Devuelve `next_on` a la fecha que cubría un pago adelantado, si nadie la movió después. */
async function restoreOccurrence(supabase: SupabaseClient, tx: { recurring_id: string | null; raw: unknown }) {
  const occurrence = (tx.raw as Raw)?.paidOccurrence;
  if (!tx.recurring_id || !occurrence) return;
  const { data: rule } = await supabase
    .from("recurring")
    .select(RECURRING_COLUMNS)
    .eq("id", tx.recurring_id)
    .maybeSingle<Recurring>();
  if (!rule) return;
  await supabase
    .from("recurring")
    .update({ next_on: occurrence })
    .eq("id", rule.id)
    .eq("next_on", nextAfter(rule.starts_on, rule, occurrence));
}

function revalidateRecurringPayment() {
  revalidatePath("/");
  revalidatePath("/movimientos");
  revalidatePath("/bandeja");
  revalidatePath("/ajustes/recurrentes");
}

const PayRecurring = NewTransaction.omit({ type: true }).extend({
  ruleId: z.uuid(),
  /** El pendiente que se confirma; null si todavía no vence. */
  txId: z.uuid().nullable(),
  /** La fecha de la serie que se paga. */
  occurrence: z.iso.date(),
});

/**
 * "Marcar pagado" desde la ventana de registro: el gasto (o ingreso) es el de
 * un recurrente, así queda un solo movimiento. Si ya esperaba en la bandeja,
 * se confirma ese con el monto, la fecha y la categoría elegidos; si todavía no
 * vence, se registra unido al recurrente y su próxima fecha avanza (así no se
 * genera después).
 */
export async function payRecurring(input: z.input<typeof PayRecurring>): Promise<QuickAddState> {
  const { supabase, userId } = await requireUser();
  const parsed = PayRecurring.safeParse(input);
  const fail = (error: string): QuickAddState => ({ status: "error", error, at: Date.now() });
  if (!parsed.success) return fail("Revisa el monto y la categoría.");
  const { ruleId, occurrence, amount, categoryId, description, occurredOn } = parsed.data;

  // Si venció mientras tanto (el inicio lo genera al abrir), el pendiente ya está en la bandeja: se confirma ese.
  const [{ data: rule }, { data: placeholder }] = await Promise.all([
    supabase.from("recurring").select(RECURRING_COLUMNS).eq("id", ruleId).maybeSingle<Recurring>(),
    parsed.data.txId
      ? Promise.resolve({ data: null })
      : supabase
          .from("transactions")
          .select("id")
          .eq("recurring_id", ruleId)
          .eq("source", "recurring")
          .eq("status", "pending")
          .eq("occurred_on", occurrence)
          .maybeSingle(),
  ]);
  if (!rule) return fail("Ese recurrente ya no existe.");
  const txId = parsed.data.txId ?? placeholder?.id ?? null;

  let transaction: Transaction;
  if (txId) {
    const { data: current } = await supabase
      .from("transactions")
      .select("amount, description, category_id, occurred_on, occurred_at, source, raw")
      .eq("id", txId)
      .eq("recurring_id", ruleId)
      .eq("status", "pending")
      .maybeSingle();
    if (!current) return fail("Ese cobro ya se agregó o se descartó.");
    const { raw, source, ...fields } = current;
    // Un cobro del correo le enseña a la regla su monto y su nombre: Deshacer los devuelve.
    const before: NonNullable<PaidRaw["before"]> = IMPORTED_SOURCES.includes(source)
      ? { ...fields, rule: { amount: rule.amount, match_hint: rule.match_hint } }
      : fields;
    const { data, error } = await supabase
      .from("transactions")
      .update({
        status: "confirmed",
        amount,
        category_id: categoryId,
        ...(description ? { description } : {}),
        occurred_on: occurredOn,
        // Un cobro del correo trae su hora: se conserva si la fecha no cambió.
        occurred_at: occurredOn === fields.occurred_on ? (fields.occurred_at ?? occurredAt(occurredOn)) : occurredAt(occurredOn),
        raw: { ...((raw as Raw) ?? {}), before } satisfies PaidRaw,
      })
      .eq("id", txId)
      .eq("status", "pending")
      .select(`${TX_COLUMNS}, raw`)
      .single();
    if (error) return fail("No pude marcarlo pagado.");
    const { raw: confirmedRaw, ...confirmed } = data;
    transaction = confirmed;
    after(async () => {
      if (confirmed.description) await learnCategory(supabase, confirmed.description, categoryId);
      // Un cobro del correo: la regla aprende cómo se llama ahí y el monto cobrado.
      await learnFromCharge(supabase, { ...confirmed, raw: confirmedRaw });
    });
  } else {
    // ¿Esa fecha ya tiene su pago (registrado antes, o del correo)?
    const days = linkWindow(rule);
    const { data: linked } = await supabase
      .from("transactions")
      .select("id")
      .eq("recurring_id", ruleId)
      .in("status", ["pending", "confirmed"])
      .gte("occurred_on", addDays(occurrence, -days))
      .lte("occurred_on", addDays(occurrence, days))
      .limit(1);
    if (linked?.length) return fail("Ese pago ya está registrado.");

    const { data, error } = await supabase
      .from("transactions")
      .insert({
        type: rule.type,
        amount,
        category_id: categoryId,
        description: description || rule.description,
        occurred_on: occurredOn,
        occurred_at: occurredAt(occurredOn),
        source: "manual",
        recurring_id: ruleId,
        raw: { paidOccurrence: occurrence } satisfies PaidRaw,
      })
      .select(TX_COLUMNS)
      .single();
    if (error) return fail("No pude marcarlo pagado.");
    transaction = data;
    // Solo avanza si nadie lo cambió entretanto (el cron, otra edición).
    await supabase
      .from("recurring")
      .update({ next_on: nextAfter(rule.starts_on, rule, occurrence) })
      .eq("id", ruleId)
      .eq("next_on", occurrence);
  }

  revalidateRecurringPayment();
  const today = todayIn();
  const week = weekBudget(await getSummary(today));
  after(() => notifyBudgetCrossing(userId, transaction, week, today));
  return { status: "ok", transaction, week, similar: null, paid: rule.description || "Recurrente", at: Date.now() };
}

/**
 * Deshace "Marcar pagado": un pendiente vuelve a la bandeja como estaba; un pago
 * adelantado se borra y su fecha vuelve a quedar por pagar.
 */
export async function undoRecurringPayment(id: string): Promise<{ error?: string }> {
  const { supabase } = await requireUser();
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { error: "No pude deshacer." };
  const { data: tx } = await supabase
    .from("transactions")
    .select("recurring_id, raw")
    .eq("id", parsed.data)
    .maybeSingle();
  if (!tx) return { error: "No pude deshacer." };

  const { before, ...raw } = (tx.raw as Raw) ?? {};
  if (before) {
    const { rule, ...fields } = before;
    const { error } = await supabase
      .from("transactions")
      .update({ ...fields, status: "pending", raw })
      .eq("id", parsed.data)
      .eq("status", "confirmed");
    if (error) return { error: "No pude deshacer." };
    if (rule && tx.recurring_id) await supabase.from("recurring").update(rule).eq("id", tx.recurring_id);
  } else {
    const { error } = await supabase.from("transactions").delete().eq("id", parsed.data);
    if (error) return { error: "No pude deshacer." };
    await restoreOccurrence(supabase, tx);
  }
  revalidateRecurringPayment();
  return {};
}

/** Cambio rápido de categoría desde la confirmación; aprende la regla. */
export async function setCategory(id: string, categoryId: string): Promise<void> {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("transactions")
    .update({ category_id: z.uuid().parse(categoryId) })
    .eq("id", z.uuid().parse(id))
    .select("description")
    .single();
  if (data) await learnCategory(supabase, data.description, categoryId);
  revalidatePath("/");
  revalidatePath("/movimientos");
}

const TransactionForm = z.object({
  id: z.uuid(),
  type: z.enum(["expense", "income"]),
  amount: z.coerce.number().int().positive(),
  description: z.string().trim().max(200),
  category_id: z.uuid(),
  occurred_on: z.iso.date(),
  /** "HH:MM"; vacío si no se sabe la hora. */
  occurred_time: z.union([z.literal(""), z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/)]).default(""),
});

export type EditState = { error?: string };

export async function updateTransaction(
  _prev: EditState,
  formData: FormData,
): Promise<EditState> {
  const { supabase } = await requireUser();
  const parsed = TransactionForm.safeParse({
    ...Object.fromEntries(formData),
    amount: String(formData.get("amount") ?? "").replace(/\D/g, ""),
  });
  if (!parsed.success) return { error: "Revisa el monto, la fecha y la categoría." };

  const { id, occurred_time, ...rest } = parsed.data;
  const fields = {
    ...rest,
    occurred_at: occurred_time ? atTime(rest.occurred_on, occurred_time) : null,
  };
  const { data: before } = await supabase
    .from("transactions")
    .select("category_id")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("transactions").update(fields).eq("id", id);
  if (error) return { error: "No pude guardar los cambios." };

  if (before && before.category_id !== fields.category_id) {
    await learnCategory(supabase, fields.description, fields.category_id);
  }

  revalidatePath("/");
  revalidatePath("/movimientos");
  redirect(safeReturnPath(formData.get("volver")));
}
