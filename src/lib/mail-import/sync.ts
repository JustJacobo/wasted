import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, startOfWeek, todayIn } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestMail, type MailOutcome } from "./ingest";
import { fetchMail, mailboxEmail } from "./source";

export type SyncResult =
  | { status: "done"; counts: Record<MailOutcome, number> }
  | { status: "busy" | "disabled" | "unavailable" };

/** Cada cuánto se revisa el correo al abrir la app. */
export const AUTO_SYNC_MINUTES = 10;

/** true si el buzón configurado es el de este usuario. */
export function canImportMail(email: string | undefined): boolean {
  const mailbox = mailboxEmail();
  return Boolean(mailbox && email && email.toLowerCase() === mailbox);
}

/** Fila de estado; la crea al primer uso con inicio en el lunes de esta semana. */
async function syncState(admin: SupabaseClient, userId: string) {
  const { data } = await admin
    .from("mail_sync")
    .select("enabled, since, last_synced_at, running_until")
    .eq("user_id", userId)
    .maybeSingle();
  if (data) return data;
  const row = { user_id: userId, since: startOfWeek(todayIn()), enabled: true };
  await admin.from("mail_sync").upsert(row, { onConflict: "user_id", ignoreDuplicates: true });
  return { ...row, last_synced_at: null, running_until: null };
}

/** true si conviene revisar el correo ahora (al abrir la app). */
export async function shouldAutoSync(userId: string, email: string): Promise<boolean> {
  if (!canImportMail(email)) return false;
  const state = await syncState(createAdminClient(), userId);
  if (!state.enabled) return false;
  if (!state.last_synced_at) return true;
  return Date.now() - new Date(state.last_synced_at).getTime() > AUTO_SYNC_MINUTES * 60_000;
}

/**
 * Trae los correos nuevos del buzón y los convierte en movimientos. Un candado
 * en `mail_sync.running_until` evita dos sincronizaciones a la vez.
 */
export async function syncMail(userId: string, email: string): Promise<SyncResult> {
  if (!canImportMail(email)) return { status: "unavailable" };
  const admin = createAdminClient();
  const state = await syncState(admin, userId);
  if (!state.enabled) return { status: "disabled" };

  const now = new Date();
  const { data: locked } = await admin
    .from("mail_sync")
    .update({ running_until: new Date(now.getTime() + 2 * 60_000).toISOString() })
    .eq("user_id", userId)
    .or(`running_until.is.null,running_until.lt.${now.toISOString()}`)
    .select("user_id");
  if (!locked?.length) return { status: "busy" };

  try {
    // Margen de 2 días sobre la última revisión, sin ir antes del inicio.
    const lastDay = state.last_synced_at ? addDays(todayIn(new Date(state.last_synced_at)), -2) : state.since;
    const since = lastDay > state.since ? lastDay : state.since;

    const [{ data: known }, { data: categories }, { data: rules }, { data: user }] = await Promise.all([
      admin.from("mail_messages").select("message_id").eq("user_id", userId).gte("received_at", `${since}T00:00:00Z`),
      admin.from("categories").select("id, key, name, type").eq("user_id", userId).eq("archived", false),
      admin.from("category_rules").select("keyword, category_id").eq("user_id", userId),
      admin.auth.admin.getUserById(userId),
    ]);
    const meta = user.user?.user_metadata ?? {};
    const ctx = {
      userId,
      ownerName: String(meta.full_name ?? meta.name ?? ""),
      categories: categories ?? [],
      rules: rules ?? [],
    };

    const mails = await fetchMail(since, new Set((known ?? []).map((k) => k.message_id)));
    const counts: Record<MailOutcome, number> = { recorded: 0, pending: 0, own_transfer: 0, ignored: 0, duplicate: 0 };
    for (const mail of mails) {
      counts[await ingestMail(admin, mail, ctx)]++;
    }
    await admin
      .from("mail_sync")
      .update({ last_synced_at: new Date().toISOString(), running_until: null })
      .eq("user_id", userId);
    return { status: "done", counts };
  } catch (error) {
    await admin.from("mail_sync").update({ running_until: null }).eq("user_id", userId);
    throw error;
  }
}

/** "3 nuevos, 1 por revisar" para botones y Telegram. */
export function syncSummary(result: SyncResult): string {
  if (result.status !== "done") {
    return {
      busy: "Ya estoy revisando el correo, espera un momento.",
      disabled: "La importación del correo está en pausa (Ajustes).",
      unavailable: "El correo no está conectado para esta cuenta.",
    }[result.status];
  }
  const { recorded, pending } = result.counts;
  if (recorded + pending === 0) return "No hay movimientos nuevos en el correo.";
  const parts = [];
  if (recorded) parts.push(`${recorded} ${recorded === 1 ? "registrado" : "registrados"}`);
  if (pending) parts.push(`${pending} por revisar`);
  return `Del correo: ${parts.join(", ")}.`;
}
