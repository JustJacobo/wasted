// Recurrentes (arriendo, suscripciones, la cuota semanal): cada cuánto se
// repiten y qué fechas tocan. Puro: fechas "YYYY-MM-DD" como en dates.ts.

import { addDays, addMonths, daysBetween, weekday } from "@/lib/dates";
import type { TxType } from "@/lib/types";

export const UNITS = ["day", "week", "month", "year"] as const;

export type FrequencyUnit = (typeof UNITS)[number];

export interface Frequency {
  every: number;
  unit: FrequencyUnit;
}

export interface Recurring extends Frequency {
  id: string;
  type: TxType;
  amount: number;
  description: string;
  category_id: string | null;
  /** Primera fecha de la serie: todas las demás se calculan desde aquí. */
  starts_on: string;
  /** Próxima fecha que falta generar. */
  next_on: string;
  paused: boolean;
}

/** Tope de "cada N" por unidad (la base de datos admite hasta 365). */
export const MAX_EVERY: Record<FrequencyUnit, number> = { day: 365, week: 52, month: 24, year: 10 };

const UNIT_NAMES: Record<FrequencyUnit, [string, string]> = {
  day: ["día", "días"],
  week: ["semana", "semanas"],
  month: ["mes", "meses"],
  year: ["año", "años"],
};

export function unitName(unit: FrequencyUnit, every: number): string {
  return UNIT_NAMES[unit][every === 1 ? 0 : 1];
}

export const PRESETS: { label: string; freq: Frequency }[] = [
  { label: "Cada semana", freq: { every: 1, unit: "week" } },
  { label: "Cada 2 semanas", freq: { every: 2, unit: "week" } },
  { label: "Cada mes", freq: { every: 1, unit: "month" } },
  { label: "Cada 2 meses", freq: { every: 2, unit: "month" } },
  { label: "Cada 3 meses", freq: { every: 3, unit: "month" } },
  { label: "Cada 6 meses", freq: { every: 6, unit: "month" } },
  { label: "Cada año", freq: { every: 1, unit: "year" } },
];

export const sameFrequency = (a: Frequency, b: Frequency) => a.every === b.every && a.unit === b.unit;

const stepMonths = ({ every, unit }: Frequency) => (unit === "year" ? every * 12 : every);
const stepDays = ({ every, unit }: Frequency) => (unit === "week" ? every * 7 : every);

/**
 * La k-ésima fecha de la serie (k = 0 es `startsOn`). Se calcula siempre desde
 * el inicio: un mensual del 31 cae el 30 en noviembre y vuelve al 31 en diciembre.
 */
export function occurrence(startsOn: string, freq: Frequency, k: number): string {
  return freq.unit === "day" || freq.unit === "week"
    ? addDays(startsOn, k * stepDays(freq))
    : addMonths(startsOn, k * stepMonths(freq));
}

/** Primera fecha de la serie que cae en `day` o después. */
export function firstOnOrAfter(startsOn: string, freq: Frequency, day: string): string {
  if (day <= startsOn) return startsOn;
  if (freq.unit === "day" || freq.unit === "week") {
    return occurrence(startsOn, freq, Math.ceil(daysBetween(startsOn, day) / stepDays(freq)));
  }
  const [y1, m1] = startsOn.split("-").map(Number);
  const [y2, m2] = day.split("-").map(Number);
  let k = Math.floor((y2 * 12 + m2 - (y1 * 12 + m1)) / stepMonths(freq));
  while (occurrence(startsOn, freq, k) < day) k++;
  return occurrence(startsOn, freq, k);
}

/** Primera fecha de la serie estrictamente después de `day`. */
export function nextAfter(startsOn: string, freq: Frequency, day: string): string {
  return firstOnOrAfter(startsOn, freq, addDays(day, 1));
}

/**
 * Fechas vencidas desde `nextOn` hasta hoy y la siguiente que queda pendiente.
 * Si se acumularon muchas (la app no corrió en meses), solo devuelve las
 * últimas `max` para no llenar la bandeja.
 */
export function dueDates(
  rule: Pick<Recurring, "starts_on" | "next_on" | "every" | "unit">,
  today: string,
  max = 12,
): { dates: string[]; nextOn: string } {
  const dates: string[] = [];
  let day = rule.next_on;
  while (day <= today) {
    dates.push(day);
    if (dates.length > max) dates.shift();
    day = nextAfter(rule.starts_on, rule, day);
  }
  return { dates, nextOn: day };
}

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const dayAndMonth = new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", day: "numeric", month: "long" });

/** "Cada lunes", "Cada 2 semanas, los lunes", "Cada mes, el día 15", "Cada año, el 3 de marzo". */
export function frequencyLabel(startsOn: string, { every, unit }: Frequency): string {
  const each = every === 1 ? "Cada" : `Cada ${every}`;
  switch (unit) {
    case "day":
      return every === 1 ? "Cada día" : `Cada ${every} días`;
    case "week": {
      const name = WEEKDAYS[weekday(startsOn)];
      return every === 1 ? `Cada ${name}` : `Cada ${every} semanas, los ${name.endsWith("s") ? name : `${name}s`}`;
    }
    case "month": {
      const day = Number(startsOn.slice(8));
      return `${each} ${unitName("month", every)}, ${day === 31 ? "el último día" : `el día ${day}`}`;
    }
    case "year": {
      const [y, m, d] = startsOn.split("-").map(Number);
      return `${each} ${unitName("year", every)}, el ${dayAndMonth.format(new Date(Date.UTC(y, m - 1, d)))}`;
    }
  }
}
