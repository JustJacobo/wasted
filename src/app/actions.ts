"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { safeReturnPath } from "@/lib/search";
import { learnCategory, recordQuickEntry } from "@/lib/record";
import { getSummary } from "@/lib/data";
import { todayIn } from "@/lib/dates";
import { notifyBudgetCrossing } from "@/lib/telegram/notify";
import type { Totals, Transaction } from "@/lib/types";

export type QuickAddState =
  | { status: "idle" }
  | { status: "ok"; transaction: Transaction; week: Totals; at: number }
  | { status: "error"; error: string; at: number };

export async function quickAdd(text: string): Promise<QuickAddState> {
  const { supabase, userId } = await requireUser();
  const result = await recordQuickEntry(supabase, text.slice(0, 200));
  if (!result.ok) return { status: "error", error: result.error, at: Date.now() };
  revalidatePath("/");
  revalidatePath("/movimientos");
  const today = todayIn();
  const { week } = await getSummary(today);
  after(() => notifyBudgetCrossing(userId, result.transaction, week, today));
  return { status: "ok", transaction: result.transaction, week, at: Date.now() };
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
      source: "manual",
    })
    .select(
      "id, type, amount, description, merchant, category_id, account_id, occurred_on, source, status, created_at",
    )
    .single();
  if (error) return { status: "error", error: "No pude guardar el movimiento.", at: Date.now() };

  // La nota con su categoría alimenta las reglas del modo texto y de Telegram.
  if (description) await learnCategory(supabase, description, categoryId);

  revalidatePath("/");
  revalidatePath("/movimientos");
  const today = todayIn();
  const { week } = await getSummary(today);
  after(() => notifyBudgetCrossing(userId, data, week, today));
  return { status: "ok", transaction: data, week, at: Date.now() };
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

  const { id, ...fields } = parsed.data;
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
