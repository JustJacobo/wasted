// Fechas de calendario como strings "YYYY-MM-DD" en hora de Colombia (UTC-5, sin
// horario de verano). Evita que un gasto de las 9pm quede registrado "mañana"
// porque el servidor corre en UTC.

export const TIME_ZONE = "America/Bogota";

export function todayIn(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function toUtc(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(day: string, days: number): string {
  const date = toUtc(day);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUtc(date);
}

/** 0 = domingo … 6 = sábado */
export function weekday(day: string): number {
  return toUtc(day).getUTCDay();
}

/** Lunes de la semana del día dado (semana colombiana: lunes a domingo). */
export function startOfWeek(day: string): string {
  return addDays(day, -((weekday(day) + 6) % 7));
}

export function startOfMonth(day: string): string {
  return `${day.slice(0, 8)}01`;
}

export function isValidDay(y: number, m: number, d: number): boolean {
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

const relative = new Intl.DateTimeFormat("es-CO", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** "Hoy", "Ayer" o "lun, 20 oct". */
export function formatDay(day: string, today: string = todayIn()): string {
  if (day === today) return "Hoy";
  if (day === addDays(today, -1)) return "Ayer";
  return relative.format(toUtc(day));
}
