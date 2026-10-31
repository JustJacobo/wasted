// Convierte un correo en un movimiento. Todo puro: recibe el correo ya leído
// (texto plano y adjuntos) y no toca la base de datos.

import { strFromU8, unzipSync } from "fflate";
import { todayIn } from "@/lib/dates";
import { fold } from "@/lib/quick-add/parse";

export interface MailMessage {
  messageId: string;
  /** Dirección del remitente, en minúsculas. */
  from: string;
  fromName: string;
  subject: string;
  date: Date;
  text: string;
  attachments: { filename: string; content: Uint8Array }[];
}

export type MailProvider = "nequi" | "uber" | "rappi" | "dian" | "otro";
export type MailTxSource = "email_bank" | "email_invoice" | "email_other";

export type ParsedMail =
  | {
      kind: "expense" | "income" | "own_transfer";
      amount: number;
      merchant: string;
      description: string;
      /** "YYYY-MM-DD" en hora de Colombia. */
      occurredOn: string;
      /** "low" va a la bandeja aunque no parezca repetido. */
      confidence: "high" | "low";
      externalId: string;
      source: MailTxSource;
      provider: MailProvider;
    }
  | { kind: "ignore"; reason: string; provider: MailProvider };

/** Límite al descomprimir adjuntos de facturas (protege de ZIP bomba). */
export const MAX_UNZIPPED_BYTES = 5 * 1024 * 1024;

// NIT de comercios cuyo correo propio ya se importa (su factura sería repetida).
const ALREADY_COUNTED_NITS = new Set(["900843898"]); // Rappi S.A.S.

const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, sept: 9,
  oct: 10, nov: 11, dic: 12,
};

/** Quita el ruido de tablas y markdown que deja la conversión de HTML a texto. */
export function cleanText(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[|#*_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * "7.500", "$38.069", "COP 7,901", "38.069,50" → pesos enteros. Un separador
 * seguido de exactamente 3 dígitos es de miles; si hay dos, el último es decimal.
 */
export function parseAmount(raw: string): number | null {
  const body = raw.replace(/[^\d.,]/g, "");
  if (!/\d/.test(body)) return null;
  let value: number;
  const lastDot = body.lastIndexOf(".");
  const lastComma = body.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    const decimal = Math.max(lastDot, lastComma);
    value = Number(body.slice(0, decimal).replace(/[.,]/g, "") + "." + body.slice(decimal + 1));
  } else if (/^\d{1,3}([.,]\d{3})+$/.test(body)) {
    value = Number(body.replace(/[.,]/g, ""));
  } else {
    value = Number(body.replace(",", "."));
  }
  if (!Number.isFinite(value)) return null;
  return Math.round(value);
}

const pad = (n: number) => String(n).padStart(2, "0");

function ymd(y: number, m: number, d: number): string | null {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** "8 de septiembre de 2026" o "4/Oct/2026" → "2026-09-08". */
export function spanishDate(text: string): string | null {
  const long = /(\d{1,2}) de ([a-z]+)\.? de (\d{4})/.exec(fold(text));
  if (long && MONTHS[long[2]]) return ymd(Number(long[3]), MONTHS[long[2]], Number(long[1]));
  const short = /(\d{1,2})\/([a-z]{3,4})\.?\/(\d{4})/.exec(fold(text));
  if (short && MONTHS[short[2]]) return ymd(Number(short[3]), MONTHS[short[2]], Number(short[1]));
  return null;
}

/**
 * true si `counterparty` es el mismo usuario: su primer nombre y al menos otra
 * palabra de su nombre (un hermano con los mismos apellidos no cuenta).
 */
export function isOwnName(counterparty: string, ownerName: string): boolean {
  const words = (s: string) => fold(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  const own = words(ownerName);
  if (own.length === 0) return false;
  const theirs = new Set(words(counterparty));
  if (!theirs.has(own[0])) return false;
  const hits = own.filter((w) => theirs.has(w)).length;
  return hits >= Math.min(2, own.length);
}

export const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());

export function cleanMerchant(name: string): string {
  return name.replace(/\s+/g, " ").replace(/[.,;:]+$/, "").trim().slice(0, 80);
}

const domainOf = (address: string) => address.split("@")[1] ?? "";

export function parseEmail(mail: MailMessage, ownerName: string): ParsedMail {
  const domain = domainOf(mail.from);
  if (/^\s*\d{6,10};[^;]+;[^;]+;\d{2};/.test(mail.subject)) return parseDian(mail);
  if (domain.endsWith("nequi.com.co")) return parseNequi(mail, ownerName);
  if (domain === "uber.com" || domain.endsWith(".uber.com")) return parseUber(mail);
  if (domain === "rappimail.com" || domain.endsWith(".rappimail.com")) return parseRappi(mail);
  return parseGeneric(mail);
}

function parseNequi(mail: MailMessage, ownerName: string): ParsedMail {
  const text = cleanText(mail.text);
  const fallbackDay = todayIn(mail.date);
  const base = { source: "email_bank" as const, provider: "nequi" as const, confidence: "high" as const };

  const sent = /enviaste de manera exitosa \$?\s*([\d.,]+) a (?:la llave \S+ de )?(.+?) el (\d{1,2} de \w+ de \d{4})/i.exec(text);
  if (sent) {
    const merchant = cleanMerchant(sent[2]);
    return {
      ...base,
      kind: isOwnName(merchant, ownerName) ? "own_transfer" : "expense",
      amount: parseAmount(sent[1]) ?? 0,
      merchant: titleCase(merchant),
      description: titleCase(merchant),
      occurredOn: spanishDate(sent[3]) ?? fallbackDay,
      externalId: `mail:${mail.messageId}`,
    };
  }

  const received = /recibiste \$?\s*([\d.,]+) de (.+?) el (\d{1,2} de \w+ de \d{4})/i.exec(text);
  if (received) {
    const from = cleanMerchant(received[2]);
    return {
      ...base,
      kind: isOwnName(from, ownerName) ? "own_transfer" : "income",
      amount: parseAmount(received[1]) ?? 0,
      merchant: titleCase(from),
      description: titleCase(from),
      occurredOn: spanishDate(received[3]) ?? fallbackDay,
      externalId: `mail:${mail.messageId}`,
    };
  }

  const pse = /hiciste un pago en (.+?) por \$?\s*([\d.,]+)/i.exec(text);
  if (pse) {
    const merchant = cleanMerchant(pse[1]);
    const cus = /CUS:?\s*(\d+)/i.exec(text)?.[1];
    // Pagar la tarjeta Nu desde Nequi no es un gasto nuevo: las compras ya se contaron.
    const cardPayment = /^nu\b|nubank/.test(fold(merchant));
    return {
      ...base,
      kind: cardPayment ? "own_transfer" : "expense",
      amount: parseAmount(pse[2]) ?? 0,
      merchant: titleCase(merchant),
      description: titleCase(merchant),
      occurredOn: spanishDate(text) ?? fallbackDay,
      externalId: cus ? `nequi:cus:${cus}` : `mail:${mail.messageId}`,
    };
  }

  const civica = /recarga a tu c[ií]vica por \$?\s*([\d.,]+)/i.exec(text);
  if (civica) {
    return {
      ...base,
      kind: "expense",
      amount: parseAmount(civica[1]) ?? 0,
      merchant: "Cívica - Metro de Medellín",
      description: "Recarga Cívica",
      occurredOn: spanishDate(text) ?? fallbackDay,
      externalId: `mail:${mail.messageId}`,
    };
  }

  return { kind: "ignore", reason: "Aviso de Nequi sin movimiento", provider: "nequi" };
}

function parseUber(mail: MailMessage): ParsedMail {
  const text = cleanText(mail.text);
  const total = /\bTotal\s*:?\s*COP\s*([\d.,]+)/i.exec(text);
  if (!total) return { kind: "ignore", reason: "Correo de Uber sin total", provider: "uber" };
  if (/reembolsad/i.test(text)) return { kind: "ignore", reason: "Viaje reembolsado", provider: "uber" };
  const amount = parseAmount(total[1]) ?? 0;
  if (amount <= 0) return { kind: "ignore", reason: "Total en cero", provider: "uber" };

  const date = /(\d{2})\/(\d{2})\/(\d{4})/.exec(text);
  const eats = /uber eats|tu pedido/i.test(`${mail.subject} ${text.slice(0, 300)}`);
  return {
    kind: "expense",
    amount,
    merchant: eats ? "Uber Eats" : "Uber",
    description: eats ? "Uber Eats" : "Uber",
    occurredOn: (date && ymd(Number(date[3]), Number(date[2]), Number(date[1]))) || todayIn(mail.date),
    // Un viaje cancelado o con error de pago puede no haberse cobrado.
    confidence: /cancelad|error de pago|no pagaste/i.test(`${mail.subject} ${text}`) ? "low" : "high",
    externalId: `mail:${mail.messageId}`,
    source: "email_other",
    provider: "uber",
  };
}

function parseRappi(mail: MailMessage): ParsedMail {
  const text = cleanText(mail.text);
  const total = /Total pagado\s*:?\s*\$?\s*([\d.,]+)/i.exec(text);
  if (!total) return { kind: "ignore", reason: "Correo de Rappi sin total", provider: "rappi" };
  const amount = parseAmount(total[1]) ?? 0;
  if (amount <= 0) return { kind: "ignore", reason: "Total en cero", provider: "rappi" };

  const store = cleanMerchant(/Tu pedido de (.+?) (?:fue|ha sido|está)/i.exec(mail.subject)?.[1] ?? "");
  const order = /Orden\s*#?\s*(\d+)/i.exec(text)?.[1];
  const date = /(\d{4})-(\d{2})-(\d{2}) \d{2}:\d{2}/.exec(text);
  return {
    kind: "expense",
    amount,
    merchant: store || "Rappi",
    description: store ? `Rappi · ${store}` : "Rappi",
    occurredOn: (date && ymd(Number(date[1]), Number(date[2]), Number(date[3]))) || todayIn(mail.date),
    confidence: "high",
    externalId: order ? `rappi:${order}` : `mail:${mail.messageId}`,
    source: "email_other",
    provider: "rappi",
  };
}

/** XML de los adjuntos (directos o dentro de un ZIP), con límite de tamaño. */
export function invoiceXml(attachments: MailMessage["attachments"]): string | null {
  for (const file of attachments) {
    const name = file.filename.toLowerCase();
    if (name.endsWith(".xml")) return strFromU8(file.content);
    if (!name.endsWith(".zip")) continue;
    let total = 0;
    let tooBig = false;
    const files = unzipSync(file.content, {
      filter: (f) => {
        if (!f.name.toLowerCase().endsWith(".xml")) return false;
        total += f.originalSize;
        if (total > MAX_UNZIPPED_BYTES) tooBig = true;
        return !tooBig;
      },
    });
    if (tooBig) throw new Error("Adjunto de factura demasiado grande");
    const xml = Object.values(files)[0];
    if (xml) return strFromU8(xml);
  }
  return null;
}

function parseDian(mail: MailMessage): ParsedMail {
  const [nit, issuer, , type] = mail.subject.trim().split(";");
  const merchant = titleCase(cleanMerchant(issuer));
  if (type !== "01") return { kind: "ignore", reason: "Documento DIAN que no es factura de venta", provider: "dian" };
  if (ALREADY_COUNTED_NITS.has(nit) || /rappi|uber/i.test(issuer)) {
    return { kind: "ignore", reason: `Factura de ${merchant}: ya se cuenta por su propio correo`, provider: "dian" };
  }

  let xml: string | null = null;
  try {
    xml = invoiceXml(mail.attachments);
  } catch {
    return { kind: "ignore", reason: "Adjunto de factura demasiado grande", provider: "dian" };
  }
  const amount = xml ? parseAmount(/<cbc:PayableAmount[^>]*>\s*([\d.]+)\s*</.exec(xml)?.[1] ?? "") : null;
  if (xml && amount) {
    const issue = /<cbc:IssueDate>\s*(\d{4}-\d{2}-\d{2})\s*</.exec(xml)?.[1];
    const cufe = /<cbc:UUID[^>]*>\s*([0-9a-f]{40,})\s*</i.exec(xml)?.[1];
    return {
      kind: "expense",
      amount,
      merchant,
      description: merchant,
      occurredOn: issue ?? todayIn(mail.date),
      confidence: "high",
      externalId: cufe ? `dian:${cufe.toLowerCase()}` : `mail:${mail.messageId}`,
      source: "email_invoice",
      provider: "dian",
    };
  }
  // Sin XML legible: intenta con el texto del correo, pero que lo confirme el usuario.
  const generic = parseGeneric(mail);
  return generic.kind === "ignore"
    ? { ...generic, provider: "dian" }
    : { ...generic, merchant, description: merchant, source: "email_invoice", provider: "dian" };
}

const TOTAL_RE =
  /(?:total pagado|total a pagar|valor total|valor pagado|monto pagado|importe total|total de la compra|\btotal\b)\s*:?\s*(cop|us\$|usd|\$)?\s*\$?\s*(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/i;

/** "Todo lo que parezca factura": toma el total del texto y siempre pide confirmación. */
function parseGeneric(mail: MailMessage): ParsedMail {
  const text = cleanText(mail.text);
  const total = TOTAL_RE.exec(text);
  if (!total) return { kind: "ignore", reason: "No encontré un total", provider: "otro" };
  const currency = (total[1] ?? "").toLowerCase();
  if (currency === "us$" || currency === "usd" || /\b(?:usd|us\$)\s*$/i.test(text.slice(0, total.index))) {
    return { kind: "ignore", reason: "Monto en moneda extranjera", provider: "otro" };
  }
  const amount = parseAmount(total[2]);
  // En pesos, un "total" menor a $100 casi siempre es otra cosa (cantidades, porcentajes).
  if (!amount || amount < 100) return { kind: "ignore", reason: "Total muy bajo para ser pesos", provider: "otro" };

  const merchant = cleanMerchant(mail.fromName || domainOf(mail.from).split(".")[0] || "Compra");
  return {
    kind: "expense",
    amount,
    merchant,
    description: merchant,
    occurredOn: todayIn(mail.date),
    confidence: "low",
    externalId: `mail:${mail.messageId}`,
    source: "email_other",
    provider: "otro",
  };
}
