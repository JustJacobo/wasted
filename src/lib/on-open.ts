import "server-only";

import { shouldAutoSync, syncMail } from "@/lib/mail-import/sync";
import { generateDue } from "@/lib/recurring-run";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyRecurringDue } from "@/lib/telegram/notify";

/**
 * Lo que se hace al abrir la app (web o nativa), dentro de `after()` para no
 * frenar la carga: recurrentes vencidos (respaldo del cron diario) y el correo
 * (máximo cada 10 min).
 */
export async function onAppOpen(userId: string, email: string, today: string): Promise<void> {
  try {
    const admin = createAdminClient();
    await notifyRecurringDue(admin, userId, await generateDue(admin, userId, today), today);
  } catch (error) {
    console.error("recurrentes: fallo la generación al abrir", error);
  }
  try {
    if (await shouldAutoSync(userId, email)) await syncMail(userId, email);
  } catch (error) {
    console.error("correo: fallo la revisión automática", error);
  }
}
