import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { getRole } from "@/lib/auth";
import { bearerSession, createClient } from "@/lib/supabase/server";
import { OPS } from "../ops";

export const maxDuration = 60;

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

/** Un redirect de una Server Action (p. ej. al guardar un movimiento) es un éxito para la app. */
const isRedirect = (error: unknown) =>
  typeof (error as { digest?: unknown })?.digest === "string" &&
  (error as { digest: string }).digest.startsWith("NEXT_REDIRECT");

/**
 * API de la app nativa: `POST /api/app/<op>` con `Authorization: Bearer <JWT de
 * Supabase>` y el input en JSON. Responde `{ ok: true, data }` o `{ ok: false, error }`.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/app/[op]">) {
  const { op } = await ctx.params;
  const run = Object.hasOwn(OPS, op) ? OPS[op] : undefined;
  if (!run) return json({ ok: false, error: "Operación desconocida." }, 404);

  // La sesión se revisa antes de llamar a la operación: requireUser() redirigiría a /login.
  const token = await bearerSession();
  if (!token) return json({ ok: false, error: "Sesión requerida." }, 401);
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims(token);
  if (!data?.claims?.sub) return json({ ok: false, error: "Sesión vencida." }, 401);
  if (!(await getRole(supabase, data.claims.email as string | undefined))) {
    return json({ ok: false, error: "Tu correo no tiene una invitación a Wasted." }, 403);
  }

  const input = await request.json().catch(() => undefined);
  try {
    return json({ ok: true, data: (await run(input)) ?? null });
  } catch (error) {
    if (isRedirect(error)) return json({ ok: true, data: null });
    if (error instanceof ZodError) return json({ ok: false, error: "Datos no válidos." }, 400);
    console.error(`api/app/${op}`, error);
    return json({ ok: false, error: "Algo falló. Intenta de nuevo." }, 500);
  }
}
