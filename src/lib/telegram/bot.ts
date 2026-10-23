import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { todayIn } from "@/lib/dates";
import { appUrl } from "@/lib/app-url";
import { canImportMail, syncMail, syncSummary } from "@/lib/mail-import/sync";
import { learnCategory, recordQuickEntry } from "@/lib/record";
import { fetchReport, fetchSummary } from "@/lib/report-data";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Category, Transaction } from "@/lib/types";
import { answerCallback, editMessage, sendMessage } from "./api";
import {
  categoryKeyboard,
  helpText,
  NOT_LINKED_TEXT,
  parseCallback,
  reportText,
  savedKeyboard,
  savedText,
  todayText,
  undoneText,
} from "./format";

// Solo lo que usa el bot de cada update de Telegram.
export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    date: number;
    chat: { id: number; type: string };
    from?: { username?: string };
    text?: string;
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: { message_id: number; chat: { id: number; type: string } };
  };
}

const TX_COLUMNS =
  "id, type, amount, description, merchant, category_id, account_id, occurred_on, source, status, created_at";

export const hashLinkCode = (code: string) => createHash("sha256").update(code).digest("hex");

/**
 * Atiende un update del webhook. Todo pasa por el cliente de servicio, así que
 * cada consulta filtra por el `user_id` del chat vinculado.
 */
export async function handleUpdate(update: TelegramUpdate): Promise<void> {
  const admin = createAdminClient();
  if (update.callback_query) return handleCallback(admin, update.callback_query);

  const msg = update.message;
  if (!msg || msg.chat.type !== "private") return;
  const chatId = msg.chat.id;
  const text = (msg.text ?? "").trim();

  const start = /^\/start(?:@\w+)?(?:\s+(\S+))?$/i.exec(text);
  if (start?.[1]) return linkChat(admin, chatId, msg.from?.username, start[1]);

  const user = await linkedUser(admin, chatId);
  if (!user) {
    await sendMessage(chatId, NOT_LINKED_TEXT);
    return;
  }
  if (!text) {
    await sendMessage(chatId, "Por ahora solo entiendo texto, como <b>25k almuerzo</b>.");
    return;
  }

  const today = todayIn(new Date(msg.date * 1000));
  const command = /^\/(\w+)/.exec(text)?.[1]?.toLowerCase();
  switch (command) {
    case undefined:
      return record(admin, user.userId, chatId, msg.message_id, text, new Date(msg.date * 1000));
    case "start":
    case "ayuda":
    case "help":
      await sendMessage(chatId, helpText(user.firstName));
      return;
    case "hoy":
      return sendToday(admin, user.userId, chatId, today);
    case "semana": {
      const report = await fetchReport(admin, "semana", today, today, user.userId);
      await sendMessage(chatId, reportText("semana", report, { title: "Esta semana", current: true }));
      return;
    }
    case "mes": {
      const report = await fetchReport(admin, "mes", today, today, user.userId);
      await sendMessage(chatId, reportText("mes", report, { title: "Este mes" }));
      return;
    }
    case "deshacer":
      return undoLast(admin, user.userId, chatId);
    case "correo":
      return checkMail(user.userId, user.email, chatId);
    default:
      await sendMessage(chatId, `No conozco ese comando.\n\n${helpText()}`);
  }
}

/** Usuario vinculado a este chat, si sigue invitado (tabla `members`). */
async function linkedUser(admin: SupabaseClient, chatId: number) {
  const { data: link } = await admin
    .from("telegram_links")
    .select("user_id")
    .eq("chat_id", chatId)
    .maybeSingle();
  if (!link) return null;
  return memberInfo(admin, link.user_id);
}

async function memberInfo(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  const email = data.user?.email?.toLowerCase();
  if (error || !email) return null;
  const { data: member } = await admin.from("members").select("email").eq("email", email).maybeSingle();
  if (!member) return null;
  const meta = data.user!.user_metadata ?? {};
  const name = String(meta.full_name ?? meta.name ?? "");
  return { userId, email, firstName: name.split(" ")[0] || undefined };
}

async function linkChat(
  admin: SupabaseClient,
  chatId: number,
  username: string | undefined,
  code: string,
): Promise<void> {
  const codeHash = hashLinkCode(code);
  const { data: row } = await admin
    .from("telegram_link_codes")
    .select("user_id, expires_at")
    .eq("code_hash", codeHash)
    .maybeSingle();
  // Un solo uso: se borra aunque esté vencido.
  if (row) await admin.from("telegram_link_codes").delete().eq("code_hash", codeHash);

  const user = row && new Date(row.expires_at) > new Date() ? await memberInfo(admin, row.user_id) : null;
  if (!user) {
    await sendMessage(chatId, "Ese enlace ya no sirve. Genera uno nuevo en Wasted → Ajustes → Conectar Telegram.");
    return;
  }

  // Un chat pertenece a una sola cuenta: si estaba con otra, se reemplaza.
  await admin.from("telegram_links").delete().eq("chat_id", chatId).neq("user_id", user.userId);
  const { error } = await admin
    .from("telegram_links")
    .upsert({ user_id: user.userId, chat_id: chatId, username: username ?? null, linked_at: new Date().toISOString() });
  if (error) {
    console.error("telegram: no pude vincular", error);
    await sendMessage(chatId, "No pude conectar tu cuenta. Intenta de nuevo en un momento.");
    return;
  }
  await sendMessage(chatId, `✓ Listo, quedó conectado.\n\n${helpText(user.firstName)}`);
}

async function categoriesFor(admin: SupabaseClient, userId: string): Promise<Category[]> {
  const { data } = await admin
    .from("categories")
    .select("id, key, name, emoji, type, monthly_budget, sort, archived")
    .eq("user_id", userId)
    .order("sort");
  return data ?? [];
}

async function record(
  admin: SupabaseClient,
  userId: string,
  chatId: number,
  messageId: number,
  text: string,
  now: Date,
): Promise<void> {
  const result = await recordQuickEntry(admin, text.slice(0, 200), {
    source: "telegram",
    userId,
    // Telegram reintenta si no respondemos a tiempo: el mismo mensaje no se registra dos veces.
    externalId: `tg:${chatId}:${messageId}`,
    now,
  });
  if (!result.ok) {
    if (!result.duplicate) await sendMessage(chatId, result.error);
    return;
  }

  const tx = result.transaction;
  const today = todayIn(now);
  const [categories, summary] = await Promise.all([
    categoriesFor(admin, userId),
    fetchSummary(admin, today, userId),
  ]);
  const category = categories.find((c) => c.id === tx.category_id);
  await sendMessage(chatId, savedText(tx, category, today, summary.week), savedKeyboard(tx.id));
}

/** /correo: revisa el correo ahora y cuenta qué entró. */
async function checkMail(userId: string, email: string, chatId: number) {
  if (!canImportMail(email)) {
    await sendMessage(chatId, "El correo no está conectado para tu cuenta.");
    return;
  }
  await sendMessage(chatId, "📧 Revisando tu correo…");
  try {
    const result = await syncMail(userId, email);
    const review =
      result.status === "done" && result.counts.pending ? `\nRevísalos en ${appUrl()}/bandeja` : "";
    await sendMessage(chatId, `${syncSummary(result)}${review}`);
  } catch (error) {
    console.error("telegram: fallo /correo", error);
    await sendMessage(chatId, "No pude revisar el correo. Intenta de nuevo en un momento.");
  }
}

async function sendToday(admin: SupabaseClient, userId: string, chatId: number, today: string) {
  const [{ data }, categories] = await Promise.all([
    admin
      .from("transactions")
      .select("type, amount, description, category_id")
      .eq("user_id", userId)
      .eq("status", "confirmed")
      .eq("occurred_on", today)
      .order("created_at"),
    categoriesFor(admin, userId),
  ]);
  await sendMessage(chatId, todayText(data ?? [], categories));
}

/** /deshacer: borra el último movimiento creado en las últimas 24 horas. */
async function undoLast(admin: SupabaseClient, userId: string, chatId: number) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: tx } = await admin
    .from("transactions")
    .select(TX_COLUMNS)
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<Transaction>();
  if (!tx) {
    await sendMessage(chatId, "No hay nada de las últimas 24 horas para deshacer.");
    return;
  }
  await admin.from("transactions").delete().eq("id", tx.id).eq("user_id", userId);
  await sendMessage(chatId, undoneText(tx));
}

async function handleCallback(
  admin: SupabaseClient,
  query: NonNullable<TelegramUpdate["callback_query"]>,
): Promise<void> {
  const message = query.message;
  const parsed = query.data ? parseCallback(query.data) : null;
  if (!message || message.chat.type !== "private" || !parsed) {
    await answerCallback(query.id);
    return;
  }
  const chatId = message.chat.id;
  const user = await linkedUser(admin, chatId);
  if (!user) {
    await answerCallback(query.id, "Este chat no está conectado a Wasted.");
    return;
  }

  const { data: tx } = await admin
    .from("transactions")
    .select(TX_COLUMNS)
    .eq("id", parsed.txId)
    .eq("user_id", user.userId)
    .maybeSingle<Transaction>();
  if (!tx) {
    await answerCallback(query.id, "Ese movimiento ya no existe.");
    await editMessage(chatId, message.message_id, "Este movimiento ya no existe.").catch(() => {});
    return;
  }

  const today = todayIn();
  const categories = await categoriesFor(admin, user.userId);
  const byId = (id: string | null) => categories.find((c) => c.id === id);

  switch (parsed.action) {
    case "categories": {
      const options = categories.filter((c) => c.type === tx.type && (!c.archived || c.id === tx.category_id));
      await editMessage(
        chatId,
        message.message_id,
        `${savedText(tx, byId(tx.category_id), today)}\n\n¿Qué categoría es?`,
        categoryKeyboard(tx.id, options, tx.category_id),
      );
      await answerCallback(query.id);
      return;
    }
    case "back":
      await editMessage(chatId, message.message_id, savedText(tx, byId(tx.category_id), today), savedKeyboard(tx.id));
      await answerCallback(query.id);
      return;
    case "set": {
      const category = byId(parsed.categoryId);
      if (!category || category.type !== tx.type) {
        await answerCallback(query.id, "Esa categoría ya no existe.");
        return;
      }
      await admin
        .from("transactions")
        .update({ category_id: category.id })
        .eq("id", tx.id)
        .eq("user_id", user.userId);
      if (tx.description) await learnCategory(admin, tx.description, category.id, user.userId);
      await editMessage(chatId, message.message_id, savedText(tx, category, today), savedKeyboard(tx.id));
      await answerCallback(query.id, `Ahora es ${category.name}`);
      return;
    }
    case "undo":
      await admin.from("transactions").delete().eq("id", tx.id).eq("user_id", user.userId);
      await editMessage(chatId, message.message_id, undoneText(tx));
      await answerCallback(query.id, "Deshecho");
      return;
  }
}

/** Chat de Telegram vinculado al usuario, o null. */
export async function chatFor(admin: SupabaseClient, userId: string): Promise<number | null> {
  const { data } = await admin.from("telegram_links").select("chat_id").eq("user_id", userId).maybeSingle();
  return data ? Number(data.chat_id) : null;
}
