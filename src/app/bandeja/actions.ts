"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { syncMail, syncSummary } from "@/lib/mail-import/sync";
import { learnCategory } from "@/lib/record";

function revalidate() {
  revalidatePath("/");
  revalidatePath("/bandeja");
  revalidatePath("/movimientos");
}

/** Agrega un pendiente a los movimientos con la categoría elegida (y la aprende). */
export async function confirmPending(id: string, categoryId: string): Promise<{ error?: string }> {
  const { supabase } = await requireUser();
  const parsed = z.object({ id: z.uuid(), categoryId: z.uuid() }).safeParse({ id, categoryId });
  if (!parsed.success) return { error: "Revisa la categoría." };

  const { data, error } = await supabase
    .from("transactions")
    .update({ status: "confirmed", category_id: parsed.data.categoryId })
    .eq("id", parsed.data.id)
    .eq("status", "pending")
    .select("description")
    .maybeSingle();
  if (error || !data) return { error: "No pude agregarlo." };
  if (data.description) await learnCategory(supabase, data.description, parsed.data.categoryId);
  revalidate();
  return {};
}

/** Descarta un pendiente. Se conserva marcado para que el correo no lo vuelva a traer. */
export async function discardPending(id: string): Promise<{ error?: string }> {
  const { supabase } = await requireUser();
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { error: "No pude descartarlo." };
  const { error } = await supabase
    .from("transactions")
    .update({ status: "discarded" })
    .eq("id", parsed.data)
    .eq("status", "pending");
  revalidate();
  return error ? { error: "No pude descartarlo." } : {};
}

export async function syncMailNow(): Promise<{ message: string }> {
  const { userId, email } = await requireUser();
  try {
    const result = await syncMail(userId, email);
    revalidate();
    revalidatePath("/ajustes");
    return { message: syncSummary(result) };
  } catch (error) {
    console.error("correo: fallo al sincronizar", error);
    return { message: "No pude revisar el correo. Intenta de nuevo en un momento." };
  }
}
