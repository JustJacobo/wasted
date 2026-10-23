import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/lib/app-url";
import { telegramConfigured, tg, webhookSecret } from "@/lib/telegram/api";

/**
 * Registra el webhook y los comandos del bot. Se llama una vez después de
 * desplegar (o al cambiar de dominio), con `Authorization: Bearer CRON_SECRET`.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!telegramConfigured()) {
    return NextResponse.json({ error: "Falta TELEGRAM_BOT_TOKEN" }, { status: 500 });
  }

  const url = `${appUrl()}/api/telegram`;
  await tg("setWebhook", {
    url,
    secret_token: webhookSecret(),
    allowed_updates: ["message", "callback_query"],
  });
  await tg("setMyCommands", {
    commands: [
      { command: "hoy", description: "Lo que registraste hoy" },
      { command: "semana", description: "Cómo vas esta semana" },
      { command: "mes", description: "Resumen del mes" },
      { command: "deshacer", description: "Borra el último registro" },
      { command: "ayuda", description: "Cómo registrar" },
    ],
  });
  const me = await tg<{ username: string }>("getMe", {});
  return NextResponse.json({ ok: true, webhook: url, bot: `@${me.username}` });
}
