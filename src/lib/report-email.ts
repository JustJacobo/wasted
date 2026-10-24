import { formatDayRange, formatMonth } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import { deltaRatio, type PeriodKind, type Report } from "@/lib/report";

const percent = new Intl.NumberFormat("es-CO", { style: "percent", maximumFractionDigits: 0 });

// Colores fijos (los clientes de correo no entienden variables CSS ni modo oscuro fiable).
// Papel y tinta, como la app; el correo no sigue el tema de acento.
const C = {
  ink: "#161513",
  muted: "#6b6860",
  border: "#e4e2dc",
  surface: "#fdfcfa",
  page: "#f6f5f1",
  bar: "#57544d",
  track: "#ecebe6",
  good: "#161513",
  bad: "#c62828",
};

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function periodLabel(kind: PeriodKind, report: Report): string {
  return kind === "mes"
    ? formatMonth(report.range.start)
    : formatDayRange(report.range.start, report.range.end);
}

function deltaText(current: number, previous: number, upIsGood: boolean, periodName: string) {
  const ratio = deltaRatio(current, previous);
  if (ratio === null) return { text: `Sin datos ${periodName}`, color: C.muted, arrow: "" };
  if (Math.abs(ratio) < 0.005) return { text: `Igual que ${periodName}`, color: C.muted, arrow: "" };
  const up = ratio > 0;
  const magnitude = Math.abs(ratio) > 9.99 ? "más de 999%" : percent.format(Math.abs(ratio));
  return {
    text: `${magnitude} vs ${periodName}`,
    color: up === upIsGood ? C.good : C.bad,
    arrow: up ? "▲" : "▼",
  };
}

/**
 * Correo del reporte semanal o mensual. Devuelve asunto, HTML (tablas y estilos
 * en línea, compatible con Gmail/Outlook) y texto plano.
 */
export function renderReportEmail({
  report,
  kind,
  name,
  appUrl,
}: {
  report: Report;
  kind: PeriodKind;
  name: string;
  appUrl: string;
}): { subject: string; html: string; text: string } {
  const label = periodLabel(kind, report);
  const periodName = kind === "semana" ? "la semana anterior" : "el mes anterior";
  const balance = report.income - report.expense;
  const delta = deltaText(report.expense, report.previousExpense, false, periodName);
  const top = report.byCategory.slice(0, 5);
  const max = top[0]?.amount ?? 1;
  const link = `${appUrl}/?vista=dashboard&periodo=${kind}&fecha=${report.range.start}`;
  const first = name.split(" ")[0] || "hola";

  const subject = `Wasted · ${kind === "semana" ? "Tu semana" : "Tu mes"} (${label}): gastaste ${formatCOP(report.expense)}`;

  const rows = top
    .map((s) => {
      const width = Math.max(Math.round((s.amount / max) * 100), 2);
      const catName = escape(s.category?.name ?? "Sin categoría");
      return `
        <tr><td style="padding:10px 0 2px;font-size:15px;color:${C.ink}">${escape(s.category?.emoji ?? "❔")}&nbsp; ${catName}</td>
            <td align="right" style="padding:10px 0 2px;font-size:15px;color:${C.ink};white-space:nowrap">${formatCOP(s.amount)}</td></tr>
        <tr><td colspan="2" style="padding:0 0 2px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.track}"><tr>
            <td width="${width}%" style="background:${C.bar};height:8px;font-size:0;line-height:0">&nbsp;</td>
            <td style="font-size:0;line-height:0">&nbsp;</td>
          </tr></table>
        </td></tr>
        <tr><td colspan="2" style="padding:0 0 4px;font-size:12px;color:${C.muted}">${percent.format(s.share)} del gasto</td></tr>`;
    })
    .join("");

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(subject)}</title></head>
<body style="margin:0;background:${C.page};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
  <tr><td style="padding:0 4px 12px;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:30px;line-height:1;color:${C.ink}">w<span style="color:#8a867d">.</span></td></tr>
  <tr><td style="padding:0 4px 16px;font-size:14px;color:${C.muted}">Hola, ${escape(first)}. Este es tu resumen de <strong style="color:${C.ink}">${escape(label)}</strong>.</td></tr>
  <tr><td style="background:${C.surface};border:1px solid ${C.border};border-radius:20px;padding:20px">
    <div style="font-size:14px;color:${C.muted}">Gastaste</div>
    <div style="font-size:36px;font-weight:700;color:${C.ink};letter-spacing:-0.5px">${formatCOP(report.expense)}</div>
    <div style="font-size:13px;color:${C.muted};margin-top:4px"><span style="color:${delta.color}">${delta.arrow}</span> ${escape(delta.text)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-top:1px solid ${C.border}"><tr>
      <td style="padding-top:12px;font-size:13px;color:${C.muted}">Ingresos<br><span style="font-size:17px;color:${C.ink}">${formatCOP(report.income)}</span></td>
      <td style="padding-top:12px;font-size:13px;color:${C.muted}">Balance<br><span style="font-size:17px;color:${balance < 0 ? C.bad : C.ink}">${balance < 0 ? "-" : "+"}${formatCOP(Math.abs(balance))}</span></td>
      <td style="padding-top:12px;font-size:13px;color:${C.muted}">Promedio diario<br><span style="font-size:17px;color:${C.ink}">${formatCOP(report.dailyAverage)}</span></td>
    </tr></table>
  </td></tr>
  ${
    top.length
      ? `<tr><td style="height:12px"></td></tr>
  <tr><td style="background:${C.surface};border:1px solid ${C.border};border-radius:20px;padding:20px">
    <div style="font-size:16px;font-weight:600;color:${C.ink};margin-bottom:4px">En qué se fue</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
  </td></tr>`
      : ""
  }
  <tr><td align="center" style="padding:20px 0 8px">
    <a href="${link}" style="display:inline-block;background:${C.ink};color:#ffffff;text-decoration:none;font-weight:600;border-radius:14px;padding:12px 22px;font-size:15px">Abrir el dashboard</a>
  </td></tr>
  <tr><td align="center" style="font-size:12px;color:${C.muted};padding-top:8px">Puedes desactivar estos correos en Ajustes de Wasted.</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    `Hola, ${first}. Tu resumen de ${label}:`,
    "",
    `Gastaste: ${formatCOP(report.expense)} (${delta.arrow ? `${delta.arrow} ` : ""}${delta.text})`,
    `Ingresos: ${formatCOP(report.income)}`,
    `Balance: ${balance < 0 ? "-" : "+"}${formatCOP(Math.abs(balance))}`,
    `Promedio diario: ${formatCOP(report.dailyAverage)}`,
    ...(top.length ? ["", "En qué se fue:"] : []),
    ...top.map(
      (s) => `- ${s.category?.name ?? "Sin categoría"}: ${formatCOP(s.amount)} (${percent.format(s.share)})`,
    ),
    "",
    `Abrir el dashboard: ${link}`,
  ].join("\n");

  return { subject, html, text };
}
