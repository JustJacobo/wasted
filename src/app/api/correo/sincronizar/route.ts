import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/lib/app-url";
import { mailboxEmail } from "@/lib/mail-import/source";
import { syncMail, syncSummary } from "@/lib/mail-import/sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMessage, telegramConfigured } from "@/lib/telegram/api";
import { chatFor } from "@/lib/telegram/bot";

export const maxDuration = 60;

/**
 * Revisión diaria del correo (Vercel Cron, 7:30 a. m. de Colombia), por si
 * nadie abrió la app. Si entró algo y Telegram está conectado, avisa por ahí.
 * Requiere `Authorization: Bearer CRON_SECRET`.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const mailbox = mailboxEmail();
  if (!mailbox) return NextResponse.json({ status: "unavailable" });

  const admin = createAdminClient();
  const [{ data: member }, usersPage] = await Promise.all([
    admin.from("members").select("email").eq("email", mailbox).maybeSingle(),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  const user = usersPage.data.users.find((u) => u.email?.toLowerCase() === mailbox);
  if (!member || !user) return NextResponse.json({ status: "unavailable" });

  try {
    const result = await syncMail(user.id, mailbox);
    if (result.status === "done" && result.counts.recorded + result.counts.pending > 0 && telegramConfigured()) {
      const chatId = await chatFor(admin, user.id);
      if (chatId) {
        const review = result.counts.pending ? `\nRevísalos en ${appUrl()}/bandeja` : "";
        await sendMessage(chatId, `📧 ${syncSummary(result)}${review}`);
      }
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("cron correo:", error);
    return NextResponse.json({ error: "No pude revisar el correo" }, { status: 500 });
  }
}
