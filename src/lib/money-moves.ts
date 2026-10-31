// Préstamos y metas: plata que sale o entra de tu bolsillo sin ser un gasto ni
// un ingreso. Puro: entiende el texto y hace las cuentas, sin tocar la base.
//
// Cada movimiento guarda su efecto en el saldo: prestar o apartar es negativo;
// que te paguen, que te presten o sacar de una meta es positivo.

import { formatCOP } from "@/lib/money";
import { fold, parseQuickAdd } from "@/lib/quick-add/parse";

export type LoanDirection = "lent" | "borrowed";

export interface LoanIntent {
  /** lend: prestaste. borrow: te prestaron. repaid: te pagaron. repay: pagaste lo que debías. */
  kind: "lend" | "borrow" | "repaid" | "repay";
  person: string;
  amount: number;
  occurredOn: string;
}

export interface GoalIntent {
  kind: "save" | "withdraw";
  /**
   * "aparté 50k para el viaje" puede crear la meta; "guardé 15k parqueadero" (sin
   * "para" ni "en") solo cuenta si la meta ya existe: si no, es un gasto.
   */
  canCreate?: boolean;
  goal: string;
  amount: number;
  occurredOn: string;
}

export type MoneyMoveIntent = LoanIntent | GoalIntent;

export const isGoalIntent = (intent: MoneyMoveIntent): intent is GoalIntent =>
  intent.kind === "save" || intent.kind === "withdraw";

export interface Loan {
  id: string;
  person: string;
  direction: LoanDirection;
  created_at: string;
  closed_at: string | null;
}

export interface Goal {
  id: string;
  name: string;
  target: number | null;
  archived: boolean;
  created_at: string;
}

export interface BalanceMove {
  id: string;
  loan_id: string | null;
  goal_id: string | null;
  amount: number;
  occurred_on: string;
  created_at: string;
}

/** Préstamos y pagos: a qué préstamo van y con qué signo. */
export const LOAN_KINDS = {
  lend: { direction: "lent", sign: -1 },
  repaid: { direction: "lent", sign: 1 },
  borrow: { direction: "borrowed", sign: 1 },
  repay: { direction: "borrowed", sign: -1 },
} as const;

// Sobre la descripción plegada (sin tildes ni mayúsculas), ya sin monto ni fecha.
const PATTERNS: [MoneyMoveIntent["kind"], RegExp][] = [
  ["lend", /^(?:le |les )?preste(?: (?:a|al|para))? (.+)$/],
  ["lend", /^prestamo (?:a|al|para) (.+)$/],
  ["borrow", /^(.+?) me (?:presto|prestaron)$/],
  ["borrow", /^me (?:presto|prestaron)(?: (?:a|el|la))? (.+)$/],
  ["repaid", /^(.+?) me (?:pago|devolvio|abono)$/],
  ["repaid", /^me (?:pago|devolvio|abono) (.+)$/],
  // Con "le": "pagué 80k luz" es la factura, no un pago a Luz Marina.
  ["repay", /^(?:le|les) (?:pague|devolvi|abone)(?: (?:a|al))? (.+)$/],
  ["save", /^(?:aparte|ahorre|guarde|separe) (?:para|en) (.+)$/],
  ["save", /^(?:aparte|ahorre|guarde|separe)(?: (?:a|al))? (.+)$/],
  ["withdraw", /^(?:saque|retire|use)(?: (?:de|del))? (.+)$/],
];
/** Posición del patrón "aparté … para/en …", el único que crea metas. */
const SAVE_WITH_PURPOSE = PATTERNS.findIndex(([kind, re]) => kind === "save" && re.source.includes("para|en"));

/** "le presté 20k" o "me prestaron 50k" sin decir quién: se pregunta en vez de registrar un gasto. */
const WITHOUT_PERSON: [MoneyMoveIntent["kind"], RegExp][] = [
  ["lend", /^(?:le |les )?preste$/],
  ["borrow", /^me (?:presto|prestaron)$/],
];

/** Palabras que sobran delante del nombre: "mi mamá", "el viaje", "la meta viaje". */
const NAME_PREFIX = /^(?:(?:mi|mis|el|la|los|las|a|al|meta|la meta)\s+)+/;

function titleCase(text: string): string {
  return text.replace(/(^|\s)(\p{L})/gu, (_, space: string, ch: string) => space + ch.toUpperCase());
}

/** El nombre tal como se escribió (con tildes), sin "mi", "el"…, con mayúscula inicial. */
function nameAt(description: string, folded: string, match: string): string {
  const start = folded.lastIndexOf(match);
  const raw = start >= 0 ? description.slice(start, start + match.length) : match;
  const prefix = NAME_PREFIX.exec(fold(raw))?.[0].length ?? 0;
  return titleCase(raw.slice(prefix).trim()).slice(0, 60);
}

/**
 * "le presté 20k a juan", "juan me prestó 50k", "me pagó 10k juan", "le pagué
 * 50k a juan", "aparté 50k para el viaje", "saqué 20k del viaje". null si es un
 * gasto o un ingreso normal. Los pagos y "saqué" solo cuentan si existe el
 * préstamo o la meta: eso lo decide quien guarda.
 */
export function parseMoneyMove(text: string, now?: Date): MoneyMoveIntent | null {
  const entry = parseQuickAdd(text, now);
  if (!entry) return null;
  const description = entry.description.replace(/[.!¡¿?]+$/, "");
  const folded = fold(description);
  const base = { amount: entry.amount, occurredOn: entry.occurredOn };

  for (const [kind, pattern] of WITHOUT_PERSON) {
    if (pattern.test(folded)) return { kind: kind as "lend" | "borrow", person: "", ...base };
  }
  for (const [kind, pattern] of PATTERNS) {
    const m = pattern.exec(folded);
    if (!m) continue;
    const name = nameAt(description, folded, m[1]);
    if (!name) continue;
    if (kind === "save") return { kind, goal: name, canCreate: pattern === PATTERNS[SAVE_WITH_PURPOSE][1], ...base };
    return kind === "withdraw" ? { kind, goal: name, ...base } : { kind, person: name, ...base };
  }
  return null;
}

/** Misma persona o meta: igual sin tildes ni mayúsculas, o el primer nombre ("Juan" y "Juan Pérez"). */
export function sameName(a: string, b: string): boolean {
  const x = fold(a).trim().replace(/\s+/g, " ");
  const y = fold(b).trim().replace(/\s+/g, " ");
  if (!x || !y) return false;
  return x === y || x.split(" ")[0] === y || y.split(" ")[0] === x;
}

/** Lo que falta por pagar de un préstamo (positivo; 0 o menos ya está saldado). */
export function outstanding(direction: LoanDirection, moves: Pick<BalanceMove, "amount">[]): number {
  const sum = moves.reduce((total, m) => total + Number(m.amount), 0);
  return direction === "lent" ? -sum : sum;
}

/** Lo apartado en una meta. */
export function saved(moves: Pick<BalanceMove, "amount">[]): number {
  return -moves.reduce((total, m) => total + Number(m.amount), 0);
}

export interface LoanSummary {
  loan: Loan;
  outstanding: number;
  moves: BalanceMove[];
}

/** Préstamos con lo pendiente y sus movimientos; abiertos primero, del más reciente al más antiguo. */
export function summarizeLoans(loans: Loan[], moves: BalanceMove[]) {
  const items: LoanSummary[] = loans.map((loan) => {
    const own = moves
      .filter((m) => m.loan_id === loan.id)
      .sort((a, b) => (a.occurred_on === b.occurred_on ? b.created_at.localeCompare(a.created_at) : b.occurred_on.localeCompare(a.occurred_on)));
    return { loan, outstanding: outstanding(loan.direction, own), moves: own };
  });
  const open = (s: LoanSummary) => s.outstanding > 0;
  items.sort((a, b) =>
    open(a) === open(b) ? (b.moves[0]?.occurred_on ?? "").localeCompare(a.moves[0]?.occurred_on ?? "") : open(a) ? -1 : 1,
  );
  const total = (direction: LoanDirection) =>
    items.filter((s) => s.loan.direction === direction && open(s)).reduce((sum, s) => sum + s.outstanding, 0);
  return { items, owedToMe: total("lent"), iOwe: total("borrowed") };
}

export interface GoalSummary {
  goal: Goal;
  saved: number;
  /** 0 a 1 si hay meta; null sin meta. */
  progress: number | null;
}

/** Metas con lo apartado; las activas primero. */
export function summarizeGoals(goals: Goal[], moves: BalanceMove[]) {
  const items: GoalSummary[] = goals.map((goal) => {
    const amount = saved(moves.filter((m) => m.goal_id === goal.id));
    return { goal, saved: amount, progress: goal.target ? Math.min(1, Math.max(0, amount / goal.target)) : null };
  });
  items.sort((a, b) =>
    a.goal.archived === b.goal.archived ? b.goal.created_at.localeCompare(a.goal.created_at) : a.goal.archived ? 1 : -1,
  );
  return { items, total: items.reduce((sum, g) => sum + Math.max(0, g.saved), 0) };
}

/** Confirmación en tono neutro, sin punto final en la última frase. */
export function loanMessage(
  kind: "lend" | "borrow" | "repaid" | "repay",
  person: string,
  amount: number,
  left: number,
): string {
  const $ = formatCOP(amount);
  switch (kind) {
    case "lend":
      return `🤝 Le prestaste ${$} a ${person}. Te debe ${formatCOP(left)}`;
    case "borrow":
      return `🤝 ${person} te prestó ${$}. Le debes ${formatCOP(left)}`;
    case "repaid":
      return left > 0
        ? `✓ ${person} te pagó ${$}. Todavía te debe ${formatCOP(left)}`
        : `✓ ${person} te pagó ${$}. Ya no te debe nada`;
    case "repay":
      return left > 0
        ? `✓ Le pagaste ${$} a ${person}. Todavía le debes ${formatCOP(left)}`
        : `✓ Le pagaste ${$} a ${person}. Ya no le debes nada`;
  }
}

export function goalMessage(
  kind: "save" | "withdraw",
  goal: Pick<Goal, "name" | "target">,
  amount: number,
  total: number,
  created = false,
): string {
  const $ = formatCOP(amount);
  if (kind === "withdraw") return `🎯 Sacaste ${$} de ${goal.name}. Quedan ${formatCOP(total)}`;
  const of = goal.target ? ` de ${formatCOP(goal.target)}` : "";
  return `🎯 Apartaste ${$} para ${goal.name}${created ? " (meta nueva)" : ""}. Llevas ${formatCOP(total)}${of}`;
}
