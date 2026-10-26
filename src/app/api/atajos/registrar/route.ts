import { revalidatePath } from "next/cache";
import { after, type NextRequest } from "next/server";
import { userFromRequest } from "@/lib/api-auth";
import { todayIn } from "@/lib/dates";
import { recordQuickEntry } from "@/lib/record";
import { fetchSummary, weekBudget } from "@/lib/report-data";
import { shortcutSavedText } from "@/lib/shortcut-format";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyBudgetCrossing } from "@/lib/telegram/notify";
import { respond, UNAUTHORIZED } from "../respond";

export const maxDuration = 30;

const HELP = "Escribe el monto y una nota, por ejemplo “25k almuerzo” o “+200k cuota semanal”.";

/** El texto a registrar: JSON `{ texto }`, formulario `texto=` o el cuerpo en texto plano. */
async function readText(request: NextRequest): Promise<string> {
  const type = request.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) {
      const body = (await request.json()) as { texto?: unknown } | null;
      return typeof body?.texto === "string" ? body.texto : "";
    }
    if (type.includes("form")) {
      const value = (await request.formData()).get("texto");
      return typeof value === "string" ? value : "";
    }
    return await request.text();
  } catch {
    return "";
  }
}

/**
 * Registra una línea de texto desde un atajo o widget, con el mismo parser y
 * las mismas categorías que Telegram. `Authorization: Bearer <clave>`.
 */
export async function POST(request: NextRequest) {
  const admin = createAdminClient();
  const user = await userFromRequest(admin, request);
  if (!user) return respond(request, UNAUTHORIZED, 401);

  const text = (await readText(request)).trim().slice(0, 200);
  if (!text) return respond(request, { ok: false, mensaje: HELP });

  const now = new Date();
  const result = await recordQuickEntry(admin, text, { source: "shortcut", userId: user.userId, now });
  if (!result.ok) return respond(request, { ok: false, mensaje: result.error });

  const tx = result.transaction;
  const today = todayIn(now);
  const [summary, { data: category }] = await Promise.all([
    fetchSummary(admin, today, user.userId),
    tx.category_id
      ? admin
          .from("categories")
          .select("emoji, name")
          .eq("id", tx.category_id)
          .eq("user_id", user.userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const week = weekBudget(summary);
  after(() => notifyBudgetCrossing(user.userId, tx, week, today));
  revalidatePath("/");
  revalidatePath("/movimientos");

  return respond(request, {
    ok: true,
    mensaje: shortcutSavedText(tx, category ?? undefined, today, week),
    id: tx.id,
    tipo: tx.type,
    monto: Number(tx.amount),
  });
}
