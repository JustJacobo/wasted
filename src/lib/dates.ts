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

const short = new Intl.DateTimeFormat("es-CO", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
});

/** "15 oct": para espacios estrechos. */
export function formatShortDay(day: string): string {
  return short.format(toUtc(day)).replace(" de ", " ").replace(".", "");
}

const monthYear = new Intl.DateTimeFormat("es-CO", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

/** "Octubre 2026" */
export function formatMonth(day: string): string {
  const text = monthYear.format(toUtc(day)).replace(" de ", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "19 – 25 oct" o "27 oct – 2 nov" */
export function formatDayRange(start: string, end: string): string {
  const a = formatShortDay(start);
  const b = formatShortDay(end);
  return start.slice(0, 7) === end.slice(0, 7) ? `${a.split(" ")[0]} – ${b}` : `${a} – ${b}`;
}

const weekdayLetter = new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", weekday: "narrow" });

/** "L", "M", "X"… */
export function formatWeekdayLetter(day: string): string {
  return weekdayLetter.format(toUtc(day)).toUpperCase();
}

/** "Hoy", "Ayer" o "lun, 20 oct". */
export function formatDay(day: string, today: string = todayIn()): string {
  if (day === today) return "Hoy";
  if (day === addDays(today, -1)) return "Ayer";
  return relative.format(toUtc(day));
}

// Horas: los movimientos guardan el instante en `occurred_at` (timestamptz) y
// se muestran en hora de Colombia, que no tiene horario de verano (UTC-5 fijo).

const clock = new Intl.DateTimeFormat("es-CO", {
  timeZone: TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** "9:41 p. m." */
export function formatTime(at: string | Date): string {
  return clock.format(new Date(at)).replace(/\s/g, " ");
}

const clock24 = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "21:41": el valor de un <input type="time">. */
export function timeInputValue(at: string | Date): string {
  return clock24.format(new Date(at));
}

/** Instante ISO del día `day` a la hora "HH:MM" de Colombia. */
export function atTime(day: string, time: string): string {
  return new Date(`${day}T${time.slice(0, 5)}:00-05:00`).toISOString();
}

/** La hora de `now` si el movimiento es de hoy; si es de otro día no se sabe. */
export function occurredAt(day: string, now: Date = new Date()): string | null {
  return todayIn(now) === day ? now.toISOString() : null;
}
