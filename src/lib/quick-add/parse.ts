import { addDays, isValidDay, todayIn, weekday } from "@/lib/dates";

export type TxType = "expense" | "income";

export interface QuickEntry {
  type: TxType;
  /** Pesos colombianos, entero > 0. */
  amount: number;
  description: string;
  /** "YYYY-MM-DD" en hora de Colombia. */
  occurredOn: string;
}

/**
 * Minúsculas y sin tildes, conservando la longitud exacta del texto para que
 * los índices de un match sobre el texto plegado sirvan sobre el original.
 */
export function fold(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (/[̀-ͯ]/.test(ch)) {
      out += " ";
      continue;
    }
    const base = ch.normalize("NFD")[0];
    const lower = base.toLowerCase();
    out += lower.length === 1 ? lower : base;
  }
  return out;
}

const WEEKDAYS = [
  "domingo",
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
];

type Match = { start: number; end: number };

function findDate(
  folded: string,
  today: string,
): (Match & { day: string }) | null {
  const relative: [RegExp, number][] = [
    [/\b(?:antier|anteayer|antes de ayer)\b/, -2],
    [/\bayer\b/, -1],
    [/\bhoy\b/, 0],
  ];
  for (const [re, offset] of relative) {
    const m = re.exec(folded);
    if (m) {
      return { start: m.index, end: m.index + m[0].length, day: addDays(today, offset) };
    }
  }

  const wd = new RegExp(
    `\\b(?:el\\s+)?(${WEEKDAYS.join("|")})(?:\\s+pasado)?\\b`,
  ).exec(folded);
  if (wd) {
    const target = WEEKDAYS.indexOf(wd[1]);
    const back = (weekday(today) - target + 7) % 7;
    return { start: wd.index, end: wd.index + wd[0].length, day: addDays(today, -back) };
  }

  const dm = /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2}|\d{4}))?\b/.exec(folded);
  if (dm) {
    const d = Number(dm[1]);
    const mo = Number(dm[2]);
    let y = dm[3] ? Number(dm[3]) : Number(today.slice(0, 4));
    if (y < 100) y += 2000;
    if (isValidDay(y, mo, d)) {
      let day = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      // "28/12" escrito en octubre se refiere al diciembre pasado, no al futuro.
      if (!dm[3] && day > today && isValidDay(y - 1, mo, d)) {
        day = `${y - 1}${day.slice(4)}`;
      }
      return { start: dm.index, end: dm.index + dm[0].length, day };
    }
  }
  return null;
}

const MULTIPLIERS: Record<string, number> = {
  k: 1_000,
  mil: 1_000,
  luca: 1_000,
  lucas: 1_000,
  m: 1_000_000,
  millon: 1_000_000,
  millones: 1_000_000,
  palo: 1_000_000,
  palos: 1_000_000,
};

const AMOUNT_RE =
  /(?<![\w.,])([+-]?)\s*\$?\s*(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(millones|millon|mil|lucas|luca|palos|palo|k|m)?(?!\w)/;

function findAmount(
  folded: string,
): (Match & { amount: number; sign: string }) | null {
  const m = AMOUNT_RE.exec(folded);
  if (!m) return null;

  const [, sign, body, suffix] = m;
  const value = /^\d{1,3}(?:[.,]\d{3})+$/.test(body)
    ? Number(body.replace(/[.,]/g, ""))
    : Number(body.replace(",", "."));

  let multiplier = suffix ? MULTIPLIERS[suffix] : 1;
  // En pesos nadie gasta $25: "25 almuerzo" significa 25 mil.
  if (!suffix && value < 100) multiplier = 1_000;

  const amount = Math.round(value * multiplier);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { start: m.index, end: m.index + m[0].length, amount, sign };
}

const INCOME_RE =
  /\b(?:salario|sueldo|nomina|quincena|prima|cuota semanal|mesada|me pagaron|me pago|me consignaron|me transfirieron|me mandaron|me dieron|me regalaron|ingreso|cobre|reembolso|devolucion|honorarios|vendi|venta de)\b/;

const CONNECTORS = "(?:en|de|del|por|para|el|la|los|las|un|una|a)";

function blank(text: string, { start, end }: Match): string {
  return text.slice(0, start) + " ".repeat(end - start) + text.slice(end);
}

function cleanDescription(text: string): string {
  let s = text.replace(/\s+/g, " ").trim();
  const leading = new RegExp(`^${CONNECTORS}\\s+`, "i");
  const trailing = new RegExp(`\\s+${CONNECTORS}$`, "i");
  while (leading.test(s)) s = s.replace(leading, "");
  while (trailing.test(s)) s = s.replace(trailing, "");
  if (/^(?:en|de|por|para)$/i.test(s)) s = "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Interpreta una línea como "25k almuerzo", "+3.5M salario" o "ayer 30k taxi".
 * Devuelve null si no encuentra un monto.
 */
export function parseQuickAdd(
  input: string,
  now: Date = new Date(),
): QuickEntry | null {
  const today = todayIn(now);
  let original = input.trim();
  let folded = fold(original);

  const date = findDate(folded, today);
  if (date) {
    original = blank(original, date);
    folded = blank(folded, date);
  }

  const amount = findAmount(folded);
  if (!amount) return null;
  original = blank(original, amount);
  folded = blank(folded, amount);

  let type: TxType = "expense";
  if (amount.sign === "+") type = "income";
  else if (amount.sign !== "-" && INCOME_RE.test(folded)) type = "income";

  return {
    type,
    amount: amount.amount,
    description: cleanDescription(original),
    occurredOn: date?.day ?? today,
  };
}
