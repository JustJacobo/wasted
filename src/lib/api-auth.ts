import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { bearerToken, hashToken } from "@/lib/api-token";
import { memberInfo, type MemberInfo } from "@/lib/members";

/**
 * Usuario dueño de la clave de atajos que trae la petición, si sigue invitado.
 * Con el cliente de servicio: cada consulta posterior debe filtrar por `userId`.
 */
export async function userFromRequest(admin: SupabaseClient, request: Request): Promise<MemberInfo | null> {
  const token = bearerToken(request.headers.get("authorization"));
  if (!token) return null;

  const { data: row } = await admin
    .from("api_tokens")
    .select("user_id")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!row) return null;

  const user = await memberInfo(admin, row.user_id);
  if (user) {
    after(async () => {
      await admin.from("api_tokens").update({ last_used_at: new Date().toISOString() }).eq("user_id", user.userId);
    });
  }
  return user;
}
