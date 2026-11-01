import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { isAuthRetryableFetchError, type SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { redirect } from "next/navigation";
import { bearerSession, createClient } from "@/lib/supabase/server";

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

export interface User {
  supabase: SupabaseClient;
  userId: string;
  email: string;
  name: string;
  role: Role;
}

/** Por qué no hay usuario: sin sesión (o vencida), correo sin invitación, o Auth no respondió. */
export type NoUser = "session" | "invite" | "unavailable";

async function loadUser(): Promise<User | NoUser> {
  const supabase = await createClient();
  // La app nativa manda su sesión por Bearer: se verifica ese JWT (firma y vigencia).
  const token = await bearerSession();
  const { data, error } = await supabase.auth.getClaims(token ?? undefined);
  const claims = data?.claims;
  if (!claims?.sub) {
    // Sin red o Auth caído no es una sesión vencida: la app no debe cerrarla por eso.
    return error && (isAuthRetryableFetchError(error) || (error.status ?? 0) >= 500) ? "unavailable" : "session";
  }

  const email = claims.email as string | undefined;
  const role = await getRole(supabase, email);
  if (!role) return "invite";

  const metadata = (claims.user_metadata ?? {}) as Record<string, unknown>;
  const name = String(metadata.full_name ?? metadata.name ?? email?.split("@")[0] ?? "");

  return { supabase, userId: claims.sub, email: email!, name, role };
}

// cache() solo sirve al renderizar páginas; en un Route Handler no guarda nada.
// La API de la app corre cada llamada aquí para verificar la sesión una sola vez.
const appCall = new AsyncLocalStorage<{ user?: Promise<User | NoUser> }>();

export const inAppCall = <T>(run: () => Promise<T>) => appCall.run({}, run);

/** El usuario de esta página, Server Action o llamada de la app, o por qué no lo hay. */
export const currentUser = cache((): Promise<User | NoUser> => {
  const call = appCall.getStore();
  return call ? (call.user ??= loadUser()) : loadUser();
});

/**
 * Devuelve el cliente de Supabase y el usuario verificado, o redirige a /login.
 * Solo pasan los correos invitados (tabla `members`). Es la puerta de entrada
 * de toda página y Server Action que lea datos.
 */
export const requireUser = cache(async (): Promise<User> => {
  const user = await currentUser();
  if (user === "invite") {
    await (await createClient()).auth.signOut();
    redirect("/login?error=no_autorizado");
  }
  if (typeof user === "string") redirect("/login");
  return user;
});

export async function requireOwner() {
  const user = await requireUser();
  if (user.role !== "owner") redirect("/");
  return user;
}
