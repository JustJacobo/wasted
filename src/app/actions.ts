"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth";
import { safeReturnPath } from "@/lib/search";
import { learnCategory, recordQuickEntry } from "@/lib/record";
import { getSummary } from "@/lib/data";
import { weekBudget } from "@/lib/report-data";
import { addDays, atTime, occurredAt, todayIn } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import { notifyBudgetCrossing } from "@/lib/telegram/notify";
import { MAIL_SOURCES, TX_COLUMNS, type Transaction, type WeekBudget } from "@/lib/types";

/** Un movimiento igual que ya llegó del correo o ya está como recurrente (posible repetido). */
export interface Similar {
  label: string;
  from: "mail" | "recurring";
}

export type QuickAddState =
  | { status: "idle" }
  | { status: "ok"; transaction: Transaction; week: WeekBudget; similar: Similar | null; at: number }
  | { status: "error"; error: string; at: number };

/**
 * Si el correo ya trajo un movimiento igual (tipo y monto, ±1 día), o ya está
 * como recurrente (en la bandeja o confirmado), lo describe para avisar en la
 * confirmación; el usuario decide si deshace.
 */
async function similarImported(supabase: SupabaseClient, tx: Transaction): Promise<Similar | null> {
  const { data } = await supabase
    .from("transactions")
    .select("description, merchant, amount, source")
    .in("source", [...MAIL_SOURCES, "recurring"])
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
    from: data.source === "recurring" ? "recurring" : "mail",
  };
}

export async function quickAdd(text: string): Promise<QuickAddState> {
  const { supabase, userId } = await requireUser();
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
  await supabase.from("transactions").delete().eq("id", z.uuid().parse(id));
  revalidatePath("/");
  revalidatePath("/movimientos");
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
