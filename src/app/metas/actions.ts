"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { saveGoalMove } from "@/lib/record-move";

export type GoalActionResult = { error?: string; message?: string };

const Amount = z.number().int().positive("Escribe el monto.").max(999_999_999_999, "El monto es demasiado grande.");

function refresh() {
  revalidatePath("/metas");
  revalidatePath("/");
}

const NewGoal = z.object({
  name: z.string().trim().min(1, "Ponle un nombre, como Viaje.").max(60, "Máximo 60 caracteres."),
  target: Amount.nullable(),
});

export async function createGoal(input: z.input<typeof NewGoal>): Promise<GoalActionResult> {
  const { supabase } = await requireUser();
  const parsed = NewGoal.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { error } = await supabase.from("goals").insert({ name: parsed.data.name, target: parsed.data.target });
  if (error) return { error: "No pude crear la meta." };
  refresh();
  return {};
}

const Move = z.object({ goalId: z.uuid(), kind: z.enum(["save", "withdraw"]), amount: Amount });

/** Apartar o sacar plata de una meta. */
export async function moveGoal(input: z.input<typeof Move>): Promise<GoalActionResult> {
  const { supabase } = await requireUser();
  const parsed = Move.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { goalId, kind, amount } = parsed.data;
  const result = await saveGoalMove(supabase, { kind, goal: "", amount, occurredOn: todayIn() }, { goalId });
  if (!result?.ok) return { error: result?.error ?? "No pude guardarlo." };
  refresh();
  return { message: result.message };
}

const Target = z.object({ goalId: z.uuid(), target: Amount.nullable() });

export async function setGoalTarget(input: z.input<typeof Target>): Promise<GoalActionResult> {
  const { supabase } = await requireUser();
  const parsed = Target.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { error } = await supabase.from("goals").update({ target: parsed.data.target }).eq("id", parsed.data.goalId);
  if (error) return { error: "No pude cambiar la meta." };
  refresh();
  return {};
}

/**
 * Archivar solo con la meta vacía: lo apartado sigue fuera de tu saldo, así que
 * primero hay que sacarlo (o borrar la meta).
 */
export async function archiveGoal(goalId: string, archived: boolean): Promise<GoalActionResult> {
  const { supabase } = await requireUser();
  if (!z.uuid().safeParse(goalId).success) return { error: "Meta no válida." };
  if (archived) {
    const { data: moves } = await supabase.from("balance_moves").select("amount").eq("goal_id", goalId);
    const left = -(moves ?? []).reduce((sum, m) => sum + Number(m.amount), 0);
    if (left > 0) return { error: "Saca lo apartado antes de archivarla." };
  }
  const { error } = await supabase.from("goals").update({ archived }).eq("id", goalId);
  if (error) return { error: "No pude archivarla." };
  refresh();
  return {};
}

/** Borra la meta y su historial: lo apartado vuelve a tu saldo. */
export async function deleteGoal(goalId: string): Promise<GoalActionResult> {
  const { supabase } = await requireUser();
  if (!z.uuid().safeParse(goalId).success) return { error: "Meta no válida." };
  const { error } = await supabase.from("goals").delete().eq("id", goalId);
  if (error) return { error: "No pude borrarla." };
  refresh();
  return {};
}
