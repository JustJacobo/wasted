import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export interface MemberInfo {
  userId: string;
  email: string;
  firstName?: string;
}

/**
 * Datos del usuario si sigue invitado (tabla `members`), o null. Para los
 * canales sin sesión (Telegram, atajos), que usan el cliente de servicio.
 */
export async function memberInfo(admin: SupabaseClient, userId: string): Promise<MemberInfo | null> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  const email = data.user?.email?.toLowerCase();
  if (error || !email) return null;
  const { data: member } = await admin.from("members").select("email").eq("email", email).maybeSingle();
  if (!member) return null;
  const meta = data.user!.user_metadata ?? {};
  const name = String(meta.full_name ?? meta.name ?? "");
  return { userId, email, firstName: name.split(" ")[0] || undefined };
}
