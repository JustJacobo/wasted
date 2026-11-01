import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { currentUser, inAppCall } from "@/lib/auth";
import { bearerSession } from "@/lib/supabase/server";
import { isRedirect, OPS } from "../ops";

export const maxDuration = 60;

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

/**
 * API de la app nativa: `POST /api/app/<op>` con `Authorization: Bearer <JWT de
 * Supabase>` y el input en JSON. Responde `{ ok: true, data }` o `{ ok: false, error }`.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/app/[op]">) {
  const { op } = await ctx.params;
  const run = Object.hasOwn(OPS, op) ? OPS[op] : undefined;
  if (!run) return json({ ok: false, error: "Operación desconocida." }, 404);

  // Solo la sesión por Bearer: la cookie de la web no sirve aquí.
  if (!(await bearerSession())) return json({ ok: false, error: "Sesión requerida." }, 401);

  return inAppCall(async () => {
    // La sesión se revisa antes de la operación: requireUser() redirigiría a /login.
    const user = await currentUser();
    if (user === "session") return json({ ok: false, error: "Sesión vencida." }, 401);
    if (user === "invite") return json({ ok: false, error: "Tu correo no tiene una invitación a Wasted." }, 403);
    if (user === "unavailable") return json({ ok: false, error: "No pude verificar la sesión. Intenta de nuevo." }, 503);

    const input = await request.json().catch(() => undefined);
    try {
      return json({ ok: true, data: (await run(input)) ?? null });
    } catch (error) {
      // El único redirect esperado (guardar un movimiento) lo atiende su operación; otro es requireOwner.
      if (isRedirect(error)) return json({ ok: false, error: "Solo el dueño de la cuenta puede hacer esto." }, 403);
      if (error instanceof ZodError) return json({ ok: false, error: "Datos no válidos." }, 400);
      console.error(`api/app/${op}`, error);
      return json({ ok: false, error: "Algo falló. Intenta de nuevo." }, 500);
    }
  });
}
