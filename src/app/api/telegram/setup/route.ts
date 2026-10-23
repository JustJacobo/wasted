import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/lib/app-url";
import { ensureWebhook, telegramConfigured, tg } from "@/lib/telegram/api";

/**
 * Registra el webhook y los comandos del bot a mano (con `Authorization: Bearer
 * CRON_SECRET`). Normalmente no hace falta: conectar desde Ajustes lo hace solo.
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
  const { changed } = await ensureWebhook(url);
  const me = await tg<{ username: string }>("getMe", {});
  return NextResponse.json({ ok: true, webhook: url, changed, bot: `@${me.username}` });
}
