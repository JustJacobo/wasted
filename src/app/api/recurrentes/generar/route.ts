import { NextResponse, type NextRequest } from "next/server";
import { todayIn } from "@/lib/dates";
import { memberInfo } from "@/lib/members";
import { generateDue, usersWithDue } from "@/lib/recurring-run";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyRecurringDue } from "@/lib/telegram/notify";

export const maxDuration = 60;

/**
 * Recurrentes que vencen hoy (Vercel Cron, 6:00 a. m. de Colombia): los deja
 * pendientes en la bandeja de cada miembro y avisa por Telegram si lo vinculó.
 * Requiere `Authorization: Bearer CRON_SECRET`.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const today = todayIn();
  const admin = createAdminClient();
  let created = 0;
  let failed = 0;
  for (const userId of await usersWithDue(admin, today)) {
    try {
      // Quien ya no está invitado no recibe nada nuevo.
      if (!(await memberInfo(admin, userId))) continue;
      const items = await generateDue(admin, userId, today);
      created += items.length;
      await notifyRecurringDue(admin, userId, items, today);
    } catch (error) {
      failed++;
      console.error("cron recurrentes:", error);
    }
  }
  return NextResponse.json({ created, failed });
}
