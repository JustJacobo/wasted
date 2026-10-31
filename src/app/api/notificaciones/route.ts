import { revalidatePath } from "next/cache";
import { after, type NextRequest } from "next/server";
import { z } from "zod";
import { userFromRequest } from "@/lib/api-auth";
import { todayIn } from "@/lib/dates";
import { ingestNotification, type NotificationOutcome } from "@/lib/notifications/ingest";
import { fetchSummary, weekBudget } from "@/lib/report-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyBudgetCrossing } from "@/lib/telegram/notify";
import { respond, UNAUTHORIZED } from "../atajos/respond";

export const maxDuration = 60;

const Notification = z.object({
  paquete: z.string().min(1).max(100),
  titulo: z.string().max(4000).default(""),
  texto: z.string().max(4000).default(""),
  /** Hora de la notificación en milisegundos (`StatusBarNotification.getPostTime()`). */
  publicada: z.number().int().positive(),
});
// Una sola, o varias juntas cuando el teléfono estuvo sin señal.
const Body = z.union([Notification, z.object({ notificaciones: z.array(Notification).min(1).max(50) })]);

/**
 * Notificaciones de pagos que lee la app de Android (Nequi, Nu, DiDi, Uber,
 * Yango). `Authorization: Bearer <clave>`, la misma de los atajos.
 */
export async function POST(request: NextRequest) {
  const admin = createAdminClient();
  const user = await userFromRequest(admin, request);
  if (!user) return respond(request, UNAUTHORIZED, 401);

  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return respond(request, { ok: false, mensaje: "Notificación no válida." }, 400);
  const items = "notificaciones" in body.data ? body.data.notificaciones : [body.data];

  const [{ data: categories, error }, { data: rules, error: rulesError }] = await Promise.all([
    admin.from("categories").select("id, key, name, type").eq("user_id", user.userId).eq("archived", false),
    admin.from("category_rules").select("keyword, category_id").eq("user_id", user.userId),
  ]);
  if (error) throw error;
  if (rulesError) throw rulesError;
  const ctx = { userId: user.userId, ownerName: user.name, categories, rules };

  const outcomes: NotificationOutcome[] = [];
  let spent = 0;
  const today = todayIn();
  for (const item of items) {
    const postedAt = new Date(item.publicada);
    // Una hora absurda (reloj del teléfono mal puesto) se toma como ahora.
    const sane = Math.abs(postedAt.getTime() - Date.now()) < 7 * 86_400_000 ? postedAt : new Date();
    const result = await ingestNotification(admin, { package: item.paquete, title: item.titulo, text: item.texto, postedAt: sane }, ctx);
    outcomes.push(result.outcome);
    if (result.transaction?.type === "expense" && result.transaction.occurred_on === today) {
      spent += Number(result.transaction.amount);
    }
  }

  const recorded = outcomes.filter((o) => o === "recorded").length;
  const pending = outcomes.filter((o) => o === "pending").length;
  if (recorded || pending) {
    revalidatePath("/");
    revalidatePath("/movimientos");
    revalidatePath("/bandeja");
  }
  if (spent > 0) {
    after(async () => {
      const week = weekBudget(await fetchSummary(admin, today, user.userId));
      await notifyBudgetCrossing(user.userId, { type: "expense", amount: spent, occurred_on: today }, week, today);
    });
  }

  const parts = [recorded && `${recorded} registrado${recorded === 1 ? "" : "s"}`, pending && `${pending} por revisar`].filter(Boolean);
  return respond(request, {
    ok: true,
    mensaje: parts.length ? parts.join(" · ") : "Nada que registrar",
    resultados: outcomes,
  });
}
