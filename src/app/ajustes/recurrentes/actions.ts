"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { addDays, todayIn } from "@/lib/dates";
import { firstOnOrAfter, MAX_EVERY, sameFrequency, UNITS, type Frequency } from "@/lib/recurring";

export type RecurringResult = { error?: string };

const Freq = z
  .object({ every: z.number().int().min(1, "Elige cada cuánto."), unit: z.enum(UNITS) })
  .refine((f) => f.every <= MAX_EVERY[f.unit], "Es demasiado espaciado.");

const Fields = z.object({
  type: z.enum(["expense", "income"]),
  amount: z.number().int().positive("Escribe el monto.").max(999_999_999_999, "El monto es demasiado grande."),
  description: z.string().trim().min(1, "Ponle un nombre, como Arriendo.").max(200, "Máximo 200 caracteres."),
  categoryId: z.uuid("Elige una categoría."),
  nextOn: z.iso.date("Revisa la fecha."),
});

const Input = Fields.and(Freq);
export type RecurringInput = z.input<typeof Input>;

function refresh() {
  revalidatePath("/ajustes/recurrentes");
  revalidatePath("/bandeja");
  revalidatePath("/");
}

/** La categoría tiene que ser del usuario (RLS) y del mismo tipo. */
async function checkCategory(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  categoryId: string,
  type: string,
): Promise<boolean> {
  const { data } = await supabase.from("categories").select("type").eq("id", categoryId).maybeSingle();
  return data?.type === type;
}

export async function createRecurring(input: RecurringInput): Promise<RecurringResult> {
  const { supabase } = await requireUser();
  const parsed = Input.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { type, amount, description, categoryId, nextOn, every, unit } = parsed.data;
  if (nextOn < todayIn()) return { error: "La próxima fecha no puede ser anterior a hoy." };
  if (!(await checkCategory(supabase, categoryId, type))) return { error: "Elige una categoría." };

  const { error } = await supabase.from("recurring").insert({
    type,
    amount,
    description,
    category_id: categoryId,
    every,
    unit,
    starts_on: nextOn,
    next_on: nextOn,
  });
  refresh();
  return error ? { error: "No pude crear el recurrente." } : {};
}

export async function updateRecurring(input: RecurringInput & { id: string }): Promise<RecurringResult> {
  const { supabase } = await requireUser();
  const parsed = Input.and(z.object({ id: z.uuid() })).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, type, amount, description, categoryId, nextOn, every, unit } = parsed.data;

  const { data: current } = await supabase
    .from("recurring")
    .select("starts_on, next_on, every, unit")
    .eq("id", id)
    .maybeSingle();
  if (!current) return { error: "No encontré el recurrente." };
  if (nextOn !== current.next_on && nextOn < todayIn()) {
    return { error: "La próxima fecha no puede ser anterior a hoy." };
  }
  if (!(await checkCategory(supabase, categoryId, type))) return { error: "Elige una categoría." };

  // Si cambia la fecha o la frecuencia, la serie arranca de nuevo en la próxima fecha;
  // si no, se conserva el inicio (un mensual del 31 sigue cayendo el 31).
  const reanchor = nextOn !== current.next_on || !sameFrequency(current as Frequency, { every, unit });
  const { error } = await supabase
    .from("recurring")
    .update({
      type,
      amount,
      description,
      category_id: categoryId,
      every,
      unit,
      starts_on: reanchor ? nextOn : current.starts_on,
      next_on: nextOn,
    })
    .eq("id", id);
  // Lo omitido desde la nueva fecha conserva su external_id y bloquearía la serie nueva.
  if (!error && reanchor) {
    await supabase
      .from("transactions")
      .delete()
      .eq("recurring_id", id)
      .eq("status", "discarded")
      .gte("occurred_on", nextOn);
  }
  refresh();
  return error ? { error: "No pude guardar los cambios." } : {};
}

/** Pausar o reanudar. Al reanudar sigue en la próxima fecha, sin lo que venció en la pausa. */
export async function setRecurringPaused(id: string, paused: boolean): Promise<RecurringResult> {
  const { supabase } = await requireUser();
  const { data: rule } = await supabase
    .from("recurring")
    .select("starts_on, every, unit")
    .eq("id", z.uuid().parse(id))
    .maybeSingle();
  if (!rule) return { error: "No encontré el recurrente." };

  const { error } = await supabase
    .from("recurring")
    .update(paused ? { paused } : { paused, next_on: firstOnOrAfter(rule.starts_on, rule as Frequency, todayIn()) })
    .eq("id", id);
  refresh();
  return error ? { error: paused ? "No pude pausarlo." : "No pude reanudarlo." } : {};
}

/** Borra el recurrente y lo que generó sin confirmar; los movimientos confirmados se quedan. */
export async function deleteRecurring(id: string): Promise<RecurringResult> {
  const { supabase } = await requireUser();
  const ruleId = z.uuid().parse(id);
  await supabase
    .from("transactions")
    .delete()
    .eq("recurring_id", ruleId)
    .in("status", ["pending", "discarded"]);
  const { error } = await supabase.from("recurring").delete().eq("id", ruleId);
  refresh();
  revalidatePath("/movimientos");
  return error ? { error: "No pude eliminarlo." } : {};
}

/**
 * Convierte un movimiento ya registrado en recurrente, con lo que tiene guardado:
 * ese movimiento cuenta como la primera vez y el siguiente sale en su fecha.
 */
export async function makeRecurring(transactionId: string, freq: Frequency): Promise<RecurringResult> {
  const { supabase } = await requireUser();
  const parsed = z.object({ id: z.uuid(), freq: Freq }).safeParse({ id: transactionId, freq });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, freq: frequency } = parsed.data;

  const { data: tx } = await supabase
    .from("transactions")
    .select("type, amount, description, category_id, occurred_on, status, recurring_id")
    .eq("id", id)
    .maybeSingle();
  if (!tx || tx.status !== "confirmed") return { error: "No encontré el movimiento." };
  if (tx.recurring_id) return { error: "Este movimiento ya se repite." };

  // Si el movimiento es viejo, se arranca desde hoy en vez de llenar la bandeja con lo atrasado.
  const today = todayIn();
  const from = tx.occurred_on < today ? today : addDays(tx.occurred_on, 1);
  const { data: rule, error } = await supabase
    .from("recurring")
    .insert({
      type: tx.type,
      amount: tx.amount,
      description: tx.description,
      category_id: tx.category_id,
      every: frequency.every,
      unit: frequency.unit,
      starts_on: tx.occurred_on,
      next_on: firstOnOrAfter(tx.occurred_on, frequency, from),
    })
    .select("id")
    .single();
  if (error || !rule) return { error: "No pude crear el recurrente." };

  const { data: linked } = await supabase
    .from("transactions")
    .update({ recurring_id: rule.id })
    .eq("id", id)
    .is("recurring_id", null)
    .select("id");
  if (!linked?.length) {
    await supabase.from("recurring").delete().eq("id", rule.id);
    return { error: "No pude crear el recurrente." };
  }
  refresh();
  revalidatePath(`/movimientos/${id}`);
  return {};
}
