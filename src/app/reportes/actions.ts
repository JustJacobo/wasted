"use server";

import { z } from "zod";
import { appUrl } from "@/lib/app-url";
import { requireUser } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { mailConfigured, sendMail } from "@/lib/mailer";
import { renderReportEmail } from "@/lib/report-email";
import { fetchReport } from "@/lib/report-data";

const COOLDOWN_MS = 60_000;

export type SendResult = { ok: true; to: string } | { ok: false; error: string };

/** Envía al correo del usuario el reporte del periodo que está viendo. */
export async function sendReportNow(kind: string, anchor: string): Promise<SendResult> {
  const { supabase, userId, email, name } = await requireUser();
  const input = z
    .object({ kind: z.enum(["semana", "mes"]), anchor: z.iso.date() })
    .safeParse({ kind, anchor });
  if (!input.success) return { ok: false, error: "Periodo inválido." };
  if (!mailConfigured()) return { ok: false, error: "El envío de correos aún no está configurado." };

  const { data: settings } = await supabase
    .from("user_settings")
    .select("last_manual_report_at")
    .maybeSingle();
  const last = settings?.last_manual_report_at ? Date.parse(settings.last_manual_report_at) : 0;
  if (Date.now() - last < COOLDOWN_MS) {
    return { ok: false, error: "Ya te lo enviamos hace un momento. Intenta en un minuto." };
  }

  const today = todayIn();
  const report = await fetchReport(supabase, input.data.kind, input.data.anchor, today);
  const message = renderReportEmail({ report, kind: input.data.kind, name, appUrl: appUrl() });

  try {
    await sendMail({ to: email, ...message });
  } catch (error) {
    console.error("sendReportNow falló:", error);
    return { ok: false, error: "No pude enviar el correo. Intenta de nuevo más tarde." };
  }

  await supabase
    .from("user_settings")
    .upsert({ user_id: userId, last_manual_report_at: new Date().toISOString() });
  return { ok: true, to: email };
}
