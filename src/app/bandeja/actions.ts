"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { syncMail, syncSummary } from "@/lib/mail-import/sync";
import { learnCategory } from "@/lib/record";
import { learnFromCharge, retirePlaceholder, type Raw } from "@/lib/recurring-link";
import { IMPORTED_SOURCES } from "@/lib/types";

function revalidate() {
  revalidatePath("/");
  revalidatePath("/bandeja");
  revalidatePath("/movimientos");
  revalidatePath("/ajustes/recurrentes");
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
    .select("description, recurring_id, source, merchant, amount, raw")
    .maybeSingle();
  if (error || !data) return { error: "No pude agregarlo." };
  if (data.description) await learnCategory(supabase, data.description, parsed.data.categoryId);
  // Cobro del correo unido a un recurrente: la regla aprende su nombre en el correo y el monto.
  await learnFromCharge(supabase, data);
  revalidate();
  return {};
}

/** Descarta un pendiente. Se conserva marcado para que el correo no lo vuelva a traer. */
export async function discardPending(id: string): Promise<{ error?: string }> {
  const { supabase } = await requireUser();
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { error: "No pude descartarlo." };
  const { data, error } = await supabase
    .from("transactions")
    .update({ status: "discarded" })
    .eq("id", parsed.data)
    .eq("status", "pending")
    .select("source, recurring_id, raw")
    .maybeSingle();

  // "Ya lo tenía" en algo de un recurrente (su pendiente o su cobro del correo):
  // lo que ya estaba registrado pasa a ser el cobro de esa fecha.
  const similarId = (data?.raw as Raw)?.possibleDuplicateOf as string | undefined;
  if (data?.recurring_id && similarId) {
    const { data: linked } = await supabase
      .from("transactions")
      .update({ recurring_id: data.recurring_id })
      .eq("id", similarId)
      .eq("status", "confirmed")
      .is("recurring_id", null)
      .select("recurring_id, source, merchant, amount, raw")
      .maybeSingle();
    if (linked) await learnFromCharge(supabase, linked);
  }
  revalidate();
  return error ? { error: "No pude descartarlo." } : {};
}

/**
 * "Es el mismo cobro": agrega el del correo (con su monto y fecha reales) como
 * el cobro del recurrente y retira el pendiente del recurrente.
 */
export async function mergePending(
  recurringTxId: string,
  mailTxId: string,
  categoryId: string,
): Promise<{ error?: string }> {
  const { supabase } = await requireUser();
  const parsed = z
    .object({ recurringTxId: z.uuid(), mailTxId: z.uuid(), categoryId: z.uuid() })
    .safeParse({ recurringTxId, mailTxId, categoryId });
  if (!parsed.success) return { error: "Revisa la categoría." };

  const { data: placeholder } = await supabase
    .from("transactions")
    .select("id, recurring_id, description, raw")
    .eq("id", parsed.data.recurringTxId)
    .eq("source", "recurring")
    .eq("status", "pending")
    .maybeSingle();
  if (!placeholder?.recurring_id) return { error: "Ese recurrente ya no está pendiente." };

  // Primero se retira el pendiente del recurrente; si el correo no se puede agregar,
  // se devuelve a la bandeja. Así nunca quedan los dos contando.
  const raw = placeholder.raw as Raw;
  if (!(await retirePlaceholder(supabase, { id: placeholder.id, raw }, parsed.data.mailTxId))) {
    return { error: "Ese recurrente ya no está pendiente." };
  }
  const { data: mail } = await supabase
    .from("transactions")
    .update({
      status: "confirmed",
      recurring_id: placeholder.recurring_id,
      category_id: parsed.data.categoryId,
      ...(placeholder.description ? { description: placeholder.description } : {}),
    })
    .eq("id", parsed.data.mailTxId)
    .eq("status", "pending")
    .in("source", IMPORTED_SOURCES)
    // No se lleva un correo que ya es el cobro de otro recurrente.
    .or(`recurring_id.is.null,recurring_id.eq.${placeholder.recurring_id}`)
    .select("description, recurring_id, source, merchant, amount, raw")
    .maybeSingle();
  if (!mail) {
    await supabase.from("transactions").update({ status: "pending", raw }).eq("id", placeholder.id);
    return { error: "Ese movimiento del correo ya no está pendiente." };
  }

  if (mail.description) await learnCategory(supabase, mail.description, parsed.data.categoryId);
  await learnFromCharge(supabase, mail);
  revalidate();
  return {};
}

/** "Son distintos": los dos quedan como pendientes separados. */
export async function splitPending(ids: string[]): Promise<{ error?: string }> {
  const { supabase } = await requireUser();
  const parsed = z.array(z.uuid()).max(2).safeParse(ids);
  if (!parsed.success) return { error: "No pude separarlos." };
  const { data } = await supabase.from("transactions").select("id, raw").in("id", parsed.data).eq("status", "pending");
  for (const tx of data ?? []) {
    const raw = { ...((tx.raw as Raw) ?? {}) };
    delete raw.possibleDuplicateOf;
    await supabase.from("transactions").update({ raw }).eq("id", tx.id).eq("status", "pending");
  }
  revalidate();
  return {};
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
