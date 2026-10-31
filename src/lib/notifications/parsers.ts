// Notificaciones del teléfono (las lee la app de Android) → movimiento. Puro:
// recibe la notificación ya leída y no toca la base de datos.
//
// Los textos exactos de cada app cambian sin aviso: lo que coincide con un
// formato estricto se registra solo; lo demás con un monto va a la bandeja y
// queda en `notification_log` para escribir su formato.

import { todayIn } from "@/lib/dates";
import { cleanMerchant, isOwnName, parseAmount, titleCase } from "@/lib/mail-import/parsers";
import { fold } from "@/lib/quick-add/parse";

export type NotificationProvider = "nequi" | "nu" | "didi" | "uber" | "yango";

/** Apps que se leen. Debe coincidir con `Packages.WATCHED` de la app de Android. */
export const WATCHED_PACKAGES: Record<string, NotificationProvider> = {
  "com.nequi.MobileApp": "nequi",
  "com.nu.production": "nu",
  "com.didiglobal.passenger": "didi",
  "com.sdu.didi.psnger": "didi",
  "com.ubercab": "uber",
  "com.yandex.yango": "yango",
};

export const PROVIDER_NAMES: Record<NotificationProvider, string> = {
  nequi: "Nequi",
  nu: "Nu",
  didi: "DiDi",
  uber: "Uber",
  yango: "Yango",
};

const RIDES = new Set<NotificationProvider>(["didi", "uber", "yango"]);

export interface PhoneNotification {
  package: string;
  title: string;
  text: string;
  postedAt: Date;
}

export type ParsedNotification =
  | {
      kind: "expense" | "income";
      amount: number;
      merchant: string;
      description: string;
      /** "YYYY-MM-DD" en hora de Colombia. */
      occurredOn: string;
      /** "low" va a la bandeja aunque no parezca repetido. */
      confidence: "high" | "low";
      provider: NotificationProvider;
    }
  | { kind: "own_transfer"; reason: string; provider: NotificationProvider }
  | { kind: "ignore"; reason: string; provider: NotificationProvider | null };

// "$38.069", "$ 15000", "COP 7,901", "$38.069,50" (sin el punto final de la frase).
const MONEY = String.raw`(?:\$|COP)\s?(\d{1,3}(?:[.,]\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)`;
// Un comercio o una persona: hasta "el", "con", "desde"… o el fin de la frase.
const NAME = String.raw`(.+?)(?=\s+(?:el|con|desde|por|a las|hoy)\b|[.,!;]|$)`;

const PURCHASE = [
  new RegExp(String.raw`(?:pagaste|compraste|hiciste (?:un pago|una compra) (?:de|por))\s+${MONEY}\s+(?:en|a)\s+${NAME}`, "i"),
  new RegExp(String.raw`compra (?:aprobada |exitosa )?(?:por|de)\s+${MONEY}\s+en\s+${NAME}`, "i"),
];
// Mismo dato con el comercio primero: "Compra aprobada en RAPPI por $25.000".
const PURCHASE_NAME_FIRST = new RegExp(String.raw`compra (?:aprobada |exitosa )?en\s+(.+?)\s+por\s+${MONEY}`, "i");
const SENT = new RegExp(String.raw`(?:enviaste|transferiste)\s+${MONEY}\s+a\s+${NAME}`, "i");
const RECEIVED = new RegExp(String.raw`(?:recibiste|te (?:enviaron|llegaron|transfirieron))\s+${MONEY}\s+de\s+${NAME}`, "i");
const ANY_MONEY = new RegExp(MONEY, "i");

// Sobre el texto plegado (sin tildes, minúsculas).
const DECLINED = /rechazad|declinad|no (?:fue|pudo ser) (?:aprobad|procesad)|fondos insuficientes|fallid|no se pudo/;
const OWN_MOVES =
  /colchon|bolsillo|tus metas|tu meta\b|cajita|caja de ahorro|pago (?:de|a) (?:tu )?tarjeta|pagaste tu tarjeta|factura de tu tarjeta|entre tus cuentas/;
const NOISE = /codigo|clave|contrasena|promo|descuento|oferta|cupon|cashback|\d\s?%|gana\b|ahorra\b|desde \$/;
const INCOMING = /recib|te llego|te enviaron|abono|devoluc|reembols/;
/** A dónde va la plata cuando es a una cuenta propia (pagar la tarjeta Nu, pasar a Nequi). */
const OWN_ACCOUNT = /^(?:nu|nubank|nequi|tu cuenta.*|tu nequi|tu tarjeta.*)$|^nu (?:colombia|compania|financiera)|nubank/;

const label = (name: string) => titleCase(cleanMerchant(name.replace(/[*#]+/g, " ")));

export function parseNotification(n: PhoneNotification, ownerName: string): ParsedNotification {
  const provider = WATCHED_PACKAGES[n.package] ?? null;
  if (!provider) return { kind: "ignore", reason: "App que no se lee", provider: null };

  const text = `${n.title}. ${n.text}`.replace(/\s+/g, " ").trim();
  const folded = fold(text);
  const occurredOn = todayIn(n.postedAt);
  if (DECLINED.test(folded)) return { kind: "ignore", reason: "No se cobró", provider };
  if (OWN_MOVES.test(folded)) return { kind: "own_transfer", reason: "Movimiento entre tus cuentas", provider };

  const charge = (kind: "expense" | "income", rawAmount: string, name: string, confidence: "high" | "low"): ParsedNotification => {
    const amount = parseAmount(rawAmount) ?? 0;
    if (amount <= 0) return { kind: "ignore", reason: "Monto en cero", provider };
    const merchant = name === PROVIDER_NAMES[provider] ? name : label(name) || PROVIDER_NAMES[provider];
    return { kind, amount, merchant, description: merchant, occurredOn, confidence, provider };
  };

  for (const pattern of PURCHASE) {
    const m = pattern.exec(text);
    if (m) {
      return OWN_ACCOUNT.test(fold(m[2].trim()))
        ? { kind: "own_transfer", reason: "Pago a una cuenta propia", provider }
        : charge("expense", m[1], m[2], "high");
    }
  }
  const nameFirst = PURCHASE_NAME_FIRST.exec(text);
  if (nameFirst) return charge("expense", nameFirst[2], nameFirst[1], "high");

  const sent = SENT.exec(text);
  if (sent) {
    const to = sent[2].trim();
    return isOwnName(to, ownerName) || OWN_ACCOUNT.test(fold(to))
      ? { kind: "own_transfer", reason: "Envío a ti mismo", provider }
      : charge("expense", sent[1], to, "high");
  }
  const received = RECEIVED.exec(text);
  if (received) {
    const from = received[2].trim();
    return isOwnName(from, ownerName) || OWN_ACCOUNT.test(fold(from))
      ? { kind: "own_transfer", reason: "Plata de tu otra cuenta", provider }
      : charge("income", received[1], from, "high");
  }

  // Sin formato conocido: si hay un monto y no es publicidad, a la bandeja.
  const amount = ANY_MONEY.exec(text);
  if (!amount) return { kind: "ignore", reason: "Sin monto", provider };
  if (NOISE.test(folded)) return { kind: "ignore", reason: "Publicidad o código", provider };
  if (RIDES.has(provider)) return charge("expense", amount[1], PROVIDER_NAMES[provider], "low");
  return charge(INCOMING.test(folded) ? "income" : "expense", amount[1], PROVIDER_NAMES[provider], "low");
}
