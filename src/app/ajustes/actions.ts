"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner, requireUser } from "@/lib/auth";

export type InviteState = { error?: string; invited?: string };

export async function inviteMember(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const { supabase, userId } = await requireOwner();
  const parsed = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) return { error: "Ese correo no parece válido." };

  const { error } = await supabase
    .from("members")
    .insert({ email: parsed.data, role: "member", invited_by: userId });
  if (error?.code === "23505") return { error: "Ese correo ya tiene acceso." };
  if (error) return { error: "No pude agregar el correo." };

  revalidatePath("/ajustes");
  return { invited: parsed.data };
}

export async function removeMember(email: string): Promise<void> {
  const { supabase } = await requireOwner();
  // RLS impide borrar dueños; aquí solo se quitan invitados.
  await supabase.from("members").delete().eq("email", z.email().parse(email)).eq("role", "member");
  revalidatePath("/ajustes");
}

/** Activa o desactiva el reporte semanal o mensual por correo. */
export async function setReportPreference(
  field: "report_weekly" | "report_monthly",
  enabled: boolean,
): Promise<{ error?: string }> {
  const { supabase, userId } = await requireUser();
  const parsed = z
    .object({ field: z.enum(["report_weekly", "report_monthly"]), enabled: z.boolean() })
    .safeParse({ field, enabled });
  if (!parsed.success) return { error: "Preferencia inválida." };
  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: userId, [parsed.data.field]: parsed.data.enabled, updated_at: new Date().toISOString() });
  revalidatePath("/ajustes");
  return error ? { error: "No pude guardar la preferencia." } : {};
}
