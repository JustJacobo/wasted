import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient as createTokenClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";

/**
 * El JWT de Supabase que manda la app nativa (`Authorization: Bearer …`), o
 * null. Las claves de atajos (`wst_…`) no son sesiones: se ignoran aquí.
 */
export async function bearerSession(): Promise<string | null> {
  const value = (await headers()).get("authorization");
  const token = value?.match(/^Bearer\s+(\S+)$/i)?.[1];
  return token && !token.startsWith("wst_") ? token : null;
}

/**
 * Cliente con la sesión del usuario: la de las cookies (web) o la del Bearer
 * (app nativa). En los dos casos RLS limita al usuario.
 */
export async function createClient() {
  const token = await bearerSession();
  if (token) {
    return createTokenClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Llamado desde un Server Component: no puede escribir cookies.
            // El proxy ya refresca la sesión en cada request.
          }
        },
      },
    },
  );
}
