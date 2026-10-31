import type { Session } from "@supabase/supabase-js";
import * as WebBrowser from "expo-web-browser";
import { createContext, useContext, useEffect, useState } from "react";
import { AUTH_REDIRECT } from "./config";
import { disconnectDevice } from "./device";
import { queryClient } from "./query";
import { supabase } from "./supabase";

interface AuthValue {
  session: Session | null;
  /** false mientras se lee la sesión guardada en el teléfono. */
  ready: boolean;
}

const AuthContext = createContext<AuthValue>({ session: null, ready: false });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<AuthValue>({ session: null, ready: false });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setValue({ session: data.session, ready: true }));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Lo guardado era de la cuenta que salió: otra cuenta no debe verlo ni un instante.
      if (event === "SIGNED_OUT") queryClient.clear();
      setValue({ session, ready: true });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/**
 * Canjea el código con que vuelve el login (Google o enlace mágico). Devuelve
 * el error para mostrar, o null si quedó con sesión.
 */
export async function completeLogin(url: string): Promise<string | null> {
  const params = new URL(url).searchParams;
  const failure = params.get("error_description");
  if (failure) return failure.includes("expired") ? "El enlace venció. Pide uno nuevo." : failure;
  const code = params.get("code");
  if (!code) return "El enlace no trae el código de acceso. Pide uno nuevo.";
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return error ? "El enlace venció o ya se usó. Pide uno nuevo." : null;
}

/**
 * Google en la pestaña segura del sistema (Chrome Custom Tab): Google bloquea
 * su login dentro de una vista web, no en el navegador del sistema.
 * Devuelve el error para mostrar, o null (con sesión o si se canceló).
 */
export async function signInWithGoogle(): Promise<string | null> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: AUTH_REDIRECT, skipBrowserRedirect: true },
  });
  if (error || !data.url) return "No pude abrir Google. Intenta de nuevo.";
  const result = await WebBrowser.openAuthSessionAsync(data.url, AUTH_REDIRECT);
  if (result.type !== "success") return null;
  return completeLogin(result.url);
}

/** Envía el enlace mágico; al tocarlo en el correo vuelve a la app. */
export async function sendMagicLink(email: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: AUTH_REDIRECT },
  });
  if (!error) return null;
  return error.status === 429 ? "Espera un momento antes de pedir otro enlace." : "No pude enviar el enlace. Revisa el correo.";
}

/** Desconecta el widget de este celular y cierra la sesión. */
export async function signOut(): Promise<void> {
  await disconnectDevice().catch(() => {});
  await supabase.auth.signOut();
}
