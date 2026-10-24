"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { requireOwner, requireUser } from "@/lib/auth";
import { startOfWeek, todayIn } from "@/lib/dates";
import { canImportMail } from "@/lib/mail-import/sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl } from "@/lib/app-url";
import { ensureWebhook, telegramConfigured, tg } from "@/lib/telegram/api";
import { hashLinkCode } from "@/lib/telegram/bot";
import { ACCENT_COOKIE, ACCENT_COOKIE_MAX_AGE, MODE_COOKIE, isAccent, isColorMode } from "@/lib/theme";

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

/** Guarda el tema de acento y lo copia a la cookie que lee el layout. */
export async function setAccent(accent: string): Promise<{ error?: string }> {
  const { supabase, userId } = await requireUser();
  if (!isAccent(accent)) return { error: "Ese tema no existe." };
  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: userId, accent, updated_at: new Date().toISOString() });
  if (error) return { error: "No pude guardar el tema." };
  (await cookies()).set(ACCENT_COOKIE, accent, {
    path: "/",
    maxAge: ACCENT_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
  return {};
}

/** Guarda el modo claro/oscuro/sistema y lo copia a la cookie que lee el layout. */
export async function setColorMode(mode: string): Promise<{ error?: string }> {
  const { supabase, userId } = await requireUser();
  if (!isColorMode(mode)) return { error: "Ese modo no existe." };
  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: userId, color_mode: mode, updated_at: new Date().toISOString() });
  if (error) return { error: "No pude guardar el modo." };
  (await cookies()).set(MODE_COOKIE, mode, {
    path: "/",
    maxAge: ACCENT_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
  return {};
}

/**
 * Crea un código de un solo uso (15 min) y devuelve el enlace t.me que abre el
 * bot con `/start <código>`. El webhook lo canjea y vincula el chat.
 */
export async function createTelegramLink(): Promise<{ url?: string; error?: string }> {
  const { supabase, userId } = await requireUser();
  if (!telegramConfigured()) return { error: "El bot de Telegram no está configurado." };

  const code = randomBytes(18).toString("base64url");
  await supabase.from("telegram_link_codes").delete().eq("user_id", userId);
  const { error } = await supabase
    .from("telegram_link_codes")
    .insert({ code_hash: hashLinkCode(code), user_id: userId });
  if (error) return { error: "No pude crear el enlace." };

  try {
    await ensureWebhook(`${appUrl()}/api/telegram`);
    const me = await tg<{ username: string }>("getMe", {});
    return { url: `https://t.me/${me.username}?start=${code}` };
  } catch {
    return { error: "No pude hablar con Telegram. Intenta de nuevo." };
  }
}

export async function unlinkTelegram(): Promise<void> {
  const { supabase, userId } = await requireUser();
  await supabase.from("telegram_links").delete().eq("user_id", userId);
  revalidatePath("/ajustes");
}

/** Pausa o reanuda la importación del correo. */
export async function setMailImport(enabled: boolean): Promise<void> {
  const { supabase, userId, email } = await requireUser();
  const value = z.boolean().parse(enabled);
  const { data } = await supabase
    .from("mail_sync")
    .update({ enabled: value })
    .eq("user_id", userId)
    .select("user_id");
  // Sin fila todavía (nunca se revisó): la crea el servidor, solo para el dueño del buzón.
  if (!data?.length && canImportMail(email)) {
    await createAdminClient()
      .from("mail_sync")
      .insert({ user_id: userId, enabled: value, since: startOfWeek(todayIn()) });
  }
  revalidatePath("/ajustes");
}
