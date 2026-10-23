import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/lib/app-url";
import { addDays, todayIn, weekday } from "@/lib/dates";
import { mailConfigured, sendMail } from "@/lib/mailer";
import type { PeriodKind } from "@/lib/report";
import { fetchReport } from "@/lib/report-data";
import { renderReportEmail } from "@/lib/report-email";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMessage, telegramConfigured } from "@/lib/telegram/api";
import { reportText } from "@/lib/telegram/format";

export const maxDuration = 60;

/**
 * Envío programado (Vercel Cron, todos los días a las 7:00 de Colombia):
 * los lunes manda la semana anterior y el día 1 el mes anterior a cada miembro
 * que no lo haya desactivado, por correo y por Telegram si lo vinculó. `?forzar=semana|mes` para pruebas manuales.
 * Requiere `Authorization: Bearer CRON_SECRET` (Vercel lo envía solo).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const today = todayIn();
  const forced = request.nextUrl.searchParams.get("forzar");
  const jobs: { kind: PeriodKind; anchor: string }[] = [];
  if (forced === "semana" || (!forced && weekday(today) === 1)) {
    jobs.push({ kind: "semana", anchor: addDays(today, -7) });
  }
  if (forced === "mes" || (!forced && today.endsWith("-01"))) {
    jobs.push({ kind: "mes", anchor: addDays(today, -1) });
  }
  if (jobs.length === 0) return NextResponse.json({ sent: 0, motivo: "Hoy no toca reporte." });
  const mail = mailConfigured();
  const telegram = telegramConfigured();
  if (!mail && !telegram) {
    return NextResponse.json({ error: "Ni correo ni Telegram configurados" }, { status: 500 });
  }

  const admin = createAdminClient();
  const [{ data: members, error: membersError }, { data: settings }, { data: links }, usersPage] =
    await Promise.all([
      admin.from("members").select("email"),
      admin.from("user_settings").select("user_id, report_weekly, report_monthly"),
      admin.from("telegram_links").select("user_id, chat_id"),
      admin.auth.admin.listUsers({ perPage: 1000 }),
    ]);
  if (membersError || usersPage.error) {
    console.error("cron reportes:", membersError ?? usersPage.error);
    return NextResponse.json({ error: "No pude leer los usuarios" }, { status: 500 });
  }

  const allowed = new Set((members ?? []).map((m) => m.email));
  const prefs = new Map((settings ?? []).map((s) => [s.user_id, s]));
  const chats = new Map((links ?? []).map((l) => [l.user_id, Number(l.chat_id)]));
  const users = usersPage.data.users.filter((u) => u.email && allowed.has(u.email.toLowerCase()));

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const { kind, anchor } of jobs) {
    for (const user of users) {
      const pref = prefs.get(user.id);
      const enabled = kind === "semana" ? pref?.report_weekly ?? true : pref?.report_monthly ?? true;
      if (!enabled) {
        skipped++;
        continue;
      }
      let report;
      try {
        report = await fetchReport(admin, kind, anchor, today, user.id);
      } catch (error) {
        failed++;
        console.error(`cron reportes: no pude armar el reporte de ${user.id}`, error);
        continue;
      }
      if (report.expense === 0 && report.income === 0) {
        skipped++;
        continue;
      }

      // Cada canal por separado: si falla el correo, igual llega por Telegram.
      const meta = user.user_metadata ?? {};
      const name = String(meta.full_name ?? meta.name ?? user.email!.split("@")[0]);
      const chatId = chats.get(user.id);
      const deliveries = [
        mail && sendMail({ to: user.email!, ...renderReportEmail({ report, kind, name, appUrl: appUrl() }) }),
        telegram && chatId && sendMessage(chatId, reportText(kind, report)),
      ].filter((d): d is Promise<unknown> => Boolean(d));
      const results = await Promise.allSettled(deliveries);
      for (const r of results) {
        if (r.status === "rejected") console.error(`cron reportes: fallo un envío para ${user.id}`, r.reason);
      }
      if (results.some((r) => r.status === "fulfilled")) sent++;
      else failed++;
    }
  }

  return NextResponse.json({ jobs: jobs.map((j) => j.kind), sent, skipped, failed });
}
