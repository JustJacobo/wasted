import "server-only";

import nodemailer from "nodemailer";

/**
 * Envío por SMTP. En producción, el Gmail del dueño con una contraseña de
 * aplicación (GMAIL_USER / GMAIL_APP_PASSWORD). En local, Mailpit
 * (SMTP_HOST=127.0.0.1, SMTP_PORT=54325), sin autenticación.
 */
function transport() {
  const port = Number(process.env.SMTP_PORT ?? 465);
  const user = process.env.GMAIL_USER;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port,
    secure: port === 465,
    auth: user ? { user, pass: process.env.GMAIL_APP_PASSWORD } : undefined,
  });
}

export function mailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST || (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD));
}

export async function sendMail(message: { to: string; subject: string; html: string; text: string }) {
  const from = process.env.GMAIL_USER ?? "wasted@localhost";
  await transport().sendMail({ from: `Wasted <${from}>`, ...message });
}
