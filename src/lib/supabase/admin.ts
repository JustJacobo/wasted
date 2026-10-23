import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con la clave secreta: se salta RLS. Solo para tareas del servidor
 * sin usuario en sesión (el envío programado de reportes). Siempre filtrar
 * explícitamente por `user_id`.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Falta SUPABASE_SECRET_KEY");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
