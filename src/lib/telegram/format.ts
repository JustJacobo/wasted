// Mensajes y botones del bot de Telegram. Todo puro: texto en HTML de Telegram
// (solo <b>, <i>; el resto escapado) y teclados en línea.

import { budgetMessage, budgetStatus } from "@/lib/budget";
import { formatDay, formatDayRange, formatMonth } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import { deltaRatio, type PeriodKind, type Report } from "@/lib/report";
import type { Category, Totals, Transaction, TxType } from "@/lib/types";

export interface InlineButton {
  text: string;
  callback_data: string;
}

const percent = new Intl.NumberFormat("es-CO", { style: "percent", maximumFractionDigits: 0 });

export function escapeHtml(text: string): string {
  return text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
}

// callback_data admite 64 bytes: los uuid van en base64url (22 caracteres).
export function encodeId(uuid: string): string {
  return Buffer.from(uuid.replace(/-/g, ""), "hex").toString("base64url");
}

export function decodeId(encoded: string): string | null {
  const hex = Buffer.from(encoded, "base64url").toString("hex");
  if (!/^[0-9a-f]{32}$/.test(hex)) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export type CallbackAction =
  | { action: "categories" | "back" | "undo"; txId: string }
  | { action: "set"; txId: string; categoryId: string };

/** "k:<tx>" lista categorías, "s:<tx>:<cat>" la cambia, "b:<tx>" vuelve, "u:<tx>" deshace. */
export function parseCallback(data: string): CallbackAction | null {
  const [kind, tx, cat] = data.split(":");
  const txId = tx ? decodeId(tx) : null;
  if (!txId) return null;
  if (kind === "k") return { action: "categories", txId };
  if (kind === "b") return { action: "back", txId };
  if (kind === "u") return { action: "undo", txId };
  if (kind === "s") {
    const categoryId = cat ? decodeId(cat) : null;
    return categoryId ? { action: "set", txId, categoryId } : null;
  }
  return null;
}

const typeLabel = (type: TxType) => (type === "income" ? "Ingreso" : "Gasto");

/** Confirmación de un registro, con aviso si la semana va en 80% o más de lo que entró. */
export function savedText(
  tx: Pick<Transaction, "type" | "amount" | "description" | "occurred_on">,
  category: Pick<Category, "emoji" | "name"> | undefined,
  today: string,
  week?: Totals,
): string {
  const lines = [
    `✓ ${typeLabel(tx.type)} <b>${formatCOP(Number(tx.amount))}</b>${
      tx.description ? ` · ${escapeHtml(tx.description)}` : ""
    }`,
    `${category ? `${escapeHtml(category.emoji)} ${escapeHtml(category.name)}` : "Sin categoría"} · ${formatDay(
      tx.occurred_on,
      today,
    )}`,
  ];
  const warning = week && tx.type === "expense" ? budgetWarning(week) : null;
  if (warning) lines.push("", warning);
  return lines.join("\n");
}

function budgetWarning(week: Totals): string | null {
  const status = budgetStatus(week.expense, week.income);
  if (status.level !== "warning" && status.level !== "over") return null;
  return `⚠️ ${budgetMessage(status, week.expense, week.income)}`;
}

export function savedKeyboard(txId: string): InlineButton[][] {
  const id = encodeId(txId);
  return [
    [
      { text: "🏷 Cambiar categoría", callback_data: `k:${id}` },
      { text: "↩️ Deshacer", callback_data: `u:${id}` },
    ],
  ];
}

export function categoryKeyboard(
  txId: string,
  categories: Pick<Category, "id" | "emoji" | "name">[],
  currentId: string | null,
): InlineButton[][] {
  const id = encodeId(txId);
  const rows: InlineButton[][] = [];
  categories.forEach((c, i) => {
    const button = {
      text: `${c.id === currentId ? "✓ " : ""}${c.emoji} ${c.name}`,
      callback_data: `s:${id}:${encodeId(c.id)}`,
    };
    if (i % 2 === 0) rows.push([button]);
    else rows[rows.length - 1].push(button);
  });
  rows.push([{ text: "← Volver", callback_data: `b:${id}` }]);
  return rows;
}

export function undoneText(tx: Pick<Transaction, "type" | "amount" | "description">): string {
  return `↩️ Deshecho: ${typeLabel(tx.type).toLowerCase()} de ${formatCOP(Number(tx.amount))}${
    tx.description ? ` · ${escapeHtml(tx.description)}` : ""
  }`;
}

/** Respuesta a /hoy. */
export function todayText(
  items: Pick<Transaction, "type" | "amount" | "description" | "category_id">[],
  categories: Pick<Category, "id" | "emoji" | "name">[],
): string {
  if (items.length === 0) return "Hoy no has registrado nada todavía.";
  const byId = new Map(categories.map((c) => [c.id, c]));
  const totals: Totals = { income: 0, expense: 0 };
  for (const t of items) totals[t.type] += Number(t.amount);

  const shown = items.slice(0, 15).map((t) => {
    const c = t.category_id ? byId.get(t.category_id) : undefined;
    const label = escapeHtml(t.description || c?.name || "Sin categoría");
    return `${escapeHtml(c?.emoji ?? "•")} ${label} · ${t.type === "income" ? "+" : "-"}${formatCOP(Number(t.amount))}`;
  });
  if (items.length > shown.length) shown.push(`… y ${items.length - shown.length} más`);

  return [
    `<b>Hoy</b> gastaste <b>${formatCOP(totals.expense)}</b>`,
    ...(totals.income ? [`Entró ${formatCOP(totals.income)}`] : []),
    "",
    ...shown,
  ].join("\n");
}

function deltaLine(current: number, previous: number, periodName: string): string {
  const ratio = deltaRatio(current, previous);
  if (ratio === null) return `Sin datos ${periodName}`;
  if (Math.abs(ratio) < 0.005) return `Igual que ${periodName}`;
  const magnitude = Math.abs(ratio) > 9.99 ? "más de 999%" : percent.format(Math.abs(ratio));
  return `${ratio > 0 ? "▲" : "▼"} ${magnitude} vs ${periodName}`;
}

/**
 * Resumen de una semana o un mes: lo de /semana y /mes y el reporte programado.
 * `current` agrega "Te quedan" y el aviso de presupuesto de la semana en curso.
 */
export function reportText(
  kind: PeriodKind,
  report: Report,
  { title, current = false }: { title?: string; current?: boolean } = {},
): string {
  const label =
    kind === "mes" ? formatMonth(report.range.start) : formatDayRange(report.range.start, report.range.end);
  const periodName = kind === "semana" ? "la semana anterior" : "el mes anterior";
  const balance = report.income - report.expense;

  const lines = [
    `<b>${escapeHtml(title ?? (kind === "semana" ? "Tu semana" : "Tu mes"))} · ${label}</b>`,
    "",
  ];
  if (current && kind === "semana" && report.income > 0) {
    lines.push(`Te quedan <b>${formatCOP(balance)}</b>`);
  }
  lines.push(
    `Gastaste <b>${formatCOP(report.expense)}</b> (${deltaLine(report.expense, report.previousExpense, periodName)})`,
    `Entró ${formatCOP(report.income)} · Balance ${balance < 0 ? "-" : "+"}${formatCOP(Math.abs(balance))}`,
    `Promedio diario ${formatCOP(report.dailyAverage)}`,
  );
  if (current && kind === "semana") {
    const warning = budgetWarning({ income: report.income, expense: report.expense });
    if (warning) lines.push(warning);
  }

  const top = report.byCategory.slice(0, 5);
  if (top.length) {
    lines.push("", "<b>En qué se fue</b>");
    for (const s of top) {
      lines.push(
        `${escapeHtml(s.category?.emoji ?? "❔")} ${escapeHtml(s.category?.name ?? "Sin categoría")} · ${formatCOP(
          s.amount,
        )} (${percent.format(s.share)})`,
      );
    }
  }
  return lines.join("\n");
}

/** Aviso cuando un gasto hace cruzar el 80% o el 100% de lo que entró en la semana. */
export function budgetAlertText(week: Totals): string | null {
  const status = budgetStatus(week.expense, week.income);
  if (status.level === "over") {
    return `🔴 ${budgetMessage(status, week.expense, week.income)}.\nSalió ${formatCOP(
      week.expense,
    )} y entró ${formatCOP(week.income)}.`;
  }
  if (status.level === "warning") {
    return `⚠️ ${budgetMessage(status, week.expense, week.income)}.\nTe quedan ${formatCOP(
      week.income - week.expense,
    )}.`;
  }
  return null;
}

const LEVEL_RANK = { none: 0, ok: 1, warning: 2, over: 3 } as const;

/** true si pasar de `before` a `after` cruza el umbral de aviso o el de exceso. */
export function crossedBudget(before: Totals, after: Totals): boolean {
  const a = budgetStatus(after.expense, after.income).level;
  if (a !== "warning" && a !== "over") return false;
  return LEVEL_RANK[a] > LEVEL_RANK[budgetStatus(before.expense, before.income).level];
}

export function helpText(name?: string): string {
  return [
    `${name ? `Hola, ${escapeHtml(name)}. ` : ""}Escríbeme lo que gastaste o te entró:`,
    "",
    "• <b>25k almuerzo</b>",
    "• <b>ayer 12.000 uber</b>",
    "• <b>+300k cuota semanal</b> (el + lo marca como ingreso)",
    "",
    "/hoy · lo de hoy",
    "/semana · cómo vas esta semana",
    "/mes · resumen del mes",
    "/deshacer · borra el último registro",
    "/correo · revisa tu correo ahora",
  ].join("\n");
}

export const NOT_LINKED_TEXT =
  "Todavía no conozco este chat. Abre Wasted → Ajustes → <b>Conectar Telegram</b> y toca el enlace desde tu celular.";
