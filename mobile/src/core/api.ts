import { API_URL } from "./config";
import { supabase } from "./supabase";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Llama una operación de la API de la app (`POST /api/app/<op>`) con la sesión
 * actual. Las operaciones son las mismas consultas y acciones que usa la web.
 */
export async function api<T>(op: string, input?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError("Sesión requerida.", 401);

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/app/${op}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(input ?? {}),
    });
  } catch {
    throw new ApiError("Sin conexión. Revisa el internet e intenta de nuevo.", 0);
  }
  const body = (await response.json().catch(() => null)) as { ok: boolean; data?: T; error?: string } | null;
  if (!response.ok || !body?.ok) {
    // Sesión vencida o revocada: se cierra y la app vuelve al login (y el widget se desconecta).
    if (response.status === 401) await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    throw new ApiError(body?.error ?? "Algo falló. Intenta de nuevo.", response.status);
  }
  return body.data as T;
}
