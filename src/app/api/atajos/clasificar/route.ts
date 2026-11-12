import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { userFromRequest } from "@/lib/api-auth";
import { classifyTransaction } from "@/lib/classify";
import { createAdminClient } from "@/lib/supabase/admin";
import { respond, UNAUTHORIZED } from "../respond";

const Body = z.object({ id: z.uuid(), categoria: z.uuid() });

/**
 * "¿Qué fue?" desde la notificación del celular: pone la categoría a una
 * transferencia a una persona y la aprende para la próxima. `Authorization:
 * Bearer <clave>`, la del celular.
 */
export async function POST(request: NextRequest) {
  const admin = createAdminClient();
  const user = await userFromRequest(admin, request);
  if (!user) return respond(request, UNAUTHORIZED, 401);

  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return respond(request, { ok: false, mensaje: "Datos no válidos." }, 400);

  const result = await classifyTransaction(admin, user.userId, body.data.id, body.data.categoria);
  if (result.error) return respond(request, { ok: false, mensaje: result.error }, 400);
  revalidatePath("/");
  revalidatePath("/movimientos");
  return respond(request, { ok: true, mensaje: "Listo" });
}
