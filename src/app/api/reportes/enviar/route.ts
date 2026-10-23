import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/lib/app-url";
import { addDays, todayIn, weekday } from "@/lib/dates";
import { mailConfigured, sendMail } from "@/lib/mailer";
import type { PeriodKind } from "@/lib/report";
import { fetchReport } from "@/lib/report-data";
import { renderReportEmail } from "@/lib/report-email";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

/**
 * Envío programado (Vercel Cron, todos los días a las 7:00 de Colombia):
 * los lunes manda la semana anterior y el día 1 el mes anterior a cada miembro
 * que no lo haya desactivado. `?forzar=semana|mes` para pruebas manuales.
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
  if (!mailConfigured()) {
    return NextResponse.json({ error: "Correo no configurado" }, { status: 500 });
  }

  const admin = createAdminClient();
  const [{ data: members, error: membersError }, { data: settings }, usersPage] = await Promise.all([
    admin.from("members").select("email"),
    admin.from("user_settings").select("user_id, report_weekly, report_monthly"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  if (membersError || usersPage.error) {
    console.error("cron reportes:", membersError ?? usersPage.error);
    return NextResponse.json({ error: "No pude leer los usuarios" }, { status: 500 });
  }

  const allowed = new Set((members ?? []).map((m) => m.email));
  const prefs = new Map((settings ?? []).map((s) => [s.user_id, s]));
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
      try {
        const report = await fetchReport(admin, kind, anchor, today, user.id);
        if (report.expense === 0 && report.income === 0) {
          skipped++;
          continue;
        }
        const meta = user.user_metadata ?? {};
        const name = String(meta.full_name ?? meta.name ?? user.email!.split("@")[0]);
        await sendMail({ to: user.email!, ...renderReportEmail({ report, kind, name, appUrl: appUrl() }) });
        sent++;
      } catch (error) {
        failed++;
        console.error(`cron reportes: fallo para ${user.id}`, error);
      }
    }
  }

  return NextResponse.json({ jobs: jobs.map((j) => j.kind), sent, skipped, failed });
}
