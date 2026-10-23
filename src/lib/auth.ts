import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Wasted es una app de un solo usuario. ALLOWED_EMAILS (separados por coma)
 * limita quién puede entrar; si está vacío, cualquier cuenta autenticada pasa.
 */
export function isAllowedEmail(email: string | undefined | null): boolean {
  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) return true;
  return !!email && allowed.includes(email.toLowerCase());
}

/**
 * Devuelve el cliente de Supabase y el usuario verificado, o redirige a /login.
 * Es la puerta de entrada de toda página y Server Action que lea datos.
 */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims?.sub) redirect("/login");
  if (!isAllowedEmail(claims.email as string | undefined)) {
    await supabase.auth.signOut();
    redirect("/login?error=no_autorizado");
  }

  return { supabase, userId: claims.sub };
});
