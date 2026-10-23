import "server-only";

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail as RawMail } from "mailparser";
import { htmlText } from "./html";
import type { MailMessage } from "./parsers";

/** Correo cuyo buzón se importa: el Gmail configurado (o el de prueba en local). */
export function mailboxEmail(): string | null {
  if (process.env.MAIL_FIXTURES_DIR) return process.env.MAIL_FIXTURES_USER?.toLowerCase() ?? null;
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return null;
  return process.env.GMAIL_USER.toLowerCase();
}

const MAX_MESSAGES = 150;
// El texto se genera aparte desde el HTML (ver `htmlText`).
const PARSER_OPTIONS = { skipHtmlToText: true, skipTextToHtml: true, skipTextLinks: true };
const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;

// Remitentes y asuntos que pueden ser un movimiento. La promoción se excluye.
function gmailQuery(since: string): string {
  return [
    `after:${since.replaceAll("-", "/")}`,
    "-category:promotions -category:social",
    "{from:nequi.com.co from:uber.com from:rappimail.com category:purchases",
    "subject:factura subject:recibo subject:comprobante subject:compra subject:pago filename:zip}",
  ].join(" ");
}

function toMessage(raw: RawMail, fallbackId: string): MailMessage {
  const sender = raw.from?.value[0];
  return {
    messageId: raw.messageId ?? fallbackId,
    from: (sender?.address ?? "").toLowerCase(),
    fromName: sender?.name ?? "",
    subject: raw.subject ?? "",
    date: raw.date ?? new Date(),
    text: typeof raw.html === "string" && raw.html ? htmlText(raw.html) : (raw.text ?? ""),
    attachments: raw.attachments
      .filter((a) => /\.(zip|xml)$/i.test(a.filename ?? "") && a.size <= MAX_ATTACHMENT_BYTES)
      .map((a) => ({ filename: a.filename!, content: new Uint8Array(a.content) })),
  };
}

/**
 * Correos desde `since` ("YYYY-MM-DD") que podrían ser movimientos, sin los que
 * ya se procesaron (`known`, por Message-ID). Del más antiguo al más nuevo.
 */
export async function fetchMail(since: string, known: Set<string>): Promise<MailMessage[]> {
  const fixtures = process.env.MAIL_FIXTURES_DIR;
  if (fixtures) return fetchFixtures(fixtures, since, known);

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: process.env.GMAIL_USER!, pass: process.env.GMAIL_APP_PASSWORD! },
    logger: false,
  });
  await client.connect();
  try {
    // "Todos" en Gmail (el nombre cambia con el idioma; se busca por su marca especial).
    const all = (await client.list()).find((box) => box.specialUse === "\\All")?.path ?? "INBOX";
    const lock = await client.getMailboxLock(all);
    try {
      const uids = (await client.search({ gmraw: gmailQuery(since) }, { uid: true })) || [];
      const recent = uids.slice(-MAX_MESSAGES);
      if (recent.length === 0) return [];

      const pending: number[] = [];
      for await (const msg of client.fetch(recent, { envelope: true }, { uid: true })) {
        const id = msg.envelope?.messageId;
        if (!id || !known.has(id)) pending.push(msg.uid);
      }
      if (pending.length === 0) return [];

      const messages: MailMessage[] = [];
      for await (const msg of client.fetch(pending, { source: true }, { uid: true })) {
        if (!msg.source) continue;
        messages.push(toMessage(await simpleParser(msg.source, PARSER_OPTIONS), `uid:${msg.uid}`));
      }
      return messages.sort((a, b) => a.date.getTime() - b.date.getTime());
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

/** En local: lee archivos .eml de una carpeta en lugar de Gmail. */
async function fetchFixtures(dir: string, since: string, known: Set<string>): Promise<MailMessage[]> {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".eml")).sort();
  const messages: MailMessage[] = [];
  for (const file of files) {
    const message = toMessage(await simpleParser(await readFile(join(dir, file)), PARSER_OPTIONS), `file:${file}`);
    if (message.date.toISOString().slice(0, 10) >= since && !known.has(message.messageId)) messages.push(message);
  }
  return messages.sort((a, b) => a.date.getTime() - b.date.getTime());
}
