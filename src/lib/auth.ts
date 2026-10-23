import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "owner" | "member";

/** Rol del usuario autenticado según la tabla `members`, o null si no fue invitado. */
export async function getRole(supabase: SupabaseClient, email: string | undefined) {
  if (!email) return null;
  const { data } = await supabase
    .from("members")
    .select("role")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  return (data?.role as Role | undefined) ?? null;
}

/**
 * Devuelve el cliente de Supabase y el usuario verificado, o redirige a /login.
 * Solo pasan los correos invitados (tabla `members`). Es la puerta de entrada
 * de toda página y Server Action que lea datos.
 */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login");

  const email = claims.email as string | undefined;
  const role = await getRole(supabase, email);
  if (!role) {
    await supabase.auth.signOut();
    redirect("/login?error=no_autorizado");
  }

  const metadata = (claims.user_metadata ?? {}) as Record<string, unknown>;
  const name = String(metadata.full_name ?? metadata.name ?? email?.split("@")[0] ?? "");

  return { supabase, userId: claims.sub, email: email!, name, role };
});

export async function requireOwner() {
  const user = await requireUser();
  if (user.role !== "owner") redirect("/");
  return user;
}
