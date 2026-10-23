"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { learnCategory, recordQuickEntry } from "@/lib/record";
import type { Transaction } from "@/lib/types";

export type QuickAddState =
  | { status: "idle" }
  | { status: "ok"; transaction: Transaction; at: number }
  | { status: "error"; error: string; at: number };

export async function quickAdd(text: string): Promise<QuickAddState> {
  const { supabase } = await requireUser();
  const result = await recordQuickEntry(supabase, text.slice(0, 200));
  if (!result.ok) return { status: "error", error: result.error, at: Date.now() };
  revalidatePath("/");
  return { status: "ok", transaction: result.transaction, at: Date.now() };
}

export async function deleteTransaction(id: string): Promise<void> {
  const { supabase } = await requireUser();
  await supabase.from("transactions").delete().eq("id", z.uuid().parse(id));
  revalidatePath("/");
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
  redirect("/");
}
