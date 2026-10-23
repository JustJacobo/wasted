import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { telegramConfigured, webhookSecret } from "@/lib/telegram/api";
import { handleUpdate, type TelegramUpdate } from "@/lib/telegram/bot";

export const maxDuration = 30;

function validSecret(received: string | null): boolean {
  if (!received || !telegramConfigured()) return false;
  const expected = Buffer.from(webhookSecret());
  const given = Buffer.from(received);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Webhook del bot. Telegram firma cada llamada con el secreto registrado en
 * `/api/telegram/setup`. Siempre responde 200 tras procesar, para que Telegram
 * no reintente por un error nuestro (los registros además no se duplican).
 */
export async function POST(request: NextRequest) {
  if (!validSecret(request.headers.get("x-telegram-bot-api-secret-token"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
  if (update) {
    try {
      await handleUpdate(update);
    } catch (error) {
      console.error("telegram: fallo al procesar el update", update.update_id, error);
    }
  }
  return NextResponse.json({ ok: true });
}
