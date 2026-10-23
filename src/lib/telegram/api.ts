import "server-only";

import { createHash } from "node:crypto";
import type { InlineButton } from "./format";

// Sobreescribible para pruebas locales con un servidor falso del Bot API.
const API_URL = process.env.TELEGRAM_API_URL ?? "https://api.telegram.org";

export function telegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

function token(): string {
  const value = process.env.TELEGRAM_BOT_TOKEN;
  if (!value) throw new Error("Falta TELEGRAM_BOT_TOKEN");
  return value;
}

/**
 * Secreto que Telegram envía en `X-Telegram-Bot-Api-Secret-Token`. Se deriva
 * del token del bot para no necesitar otra variable de entorno.
 */
export function webhookSecret(): string {
  return createHash("sha256").update(`wasted-webhook:${token()}`).digest("hex");
}

/** Llama un método del Bot API y devuelve `result`; lanza si Telegram responde error. */
export async function tg<T = unknown>(method: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_URL}/bot${token()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as
    | { ok: true; result: T }
    | { ok: false; description?: string }
    | null;
  if (!json?.ok) {
    throw new Error(`Telegram ${method}: ${json && !json.ok ? json.description : res.status}`);
  }
  return json.result;
}

export function sendMessage(
  chatId: number,
  text: string,
  keyboard?: InlineButton[][],
): Promise<unknown> {
  return tg("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  });
}

export function editMessage(
  chatId: number,
  messageId: number,
  text: string,
  keyboard?: InlineButton[][],
): Promise<unknown> {
  return tg("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: keyboard ?? [] },
  });
}

export function answerCallback(id: string, text?: string): Promise<unknown> {
  return tg("answerCallbackQuery", { callback_query_id: id, ...(text ? { text } : {}) });
}

const COMMANDS = [
  { command: "hoy", description: "Lo que registraste hoy" },
  { command: "semana", description: "Cómo vas esta semana" },
  { command: "mes", description: "Resumen del mes" },
  { command: "deshacer", description: "Borra el último registro" },
  { command: "correo", description: "Revisa tu correo ahora" },
  { command: "ayuda", description: "Cómo registrar" },
];

/**
 * Registra el webhook (y los comandos) si Telegram no apunta ya a esta app.
 * Se llama al conectar desde Ajustes, así no hace falta un paso manual al desplegar.
 */
export async function ensureWebhook(url: string): Promise<{ changed: boolean }> {
  const info = await tg<{ url: string }>("getWebhookInfo", {});
  if (info.url === url) return { changed: false };
  await tg("setWebhook", {
    url,
    secret_token: webhookSecret(),
    allowed_updates: ["message", "callback_query"],
  });
  await tg("setMyCommands", { commands: COMMANDS });
  return { changed: true };
}
