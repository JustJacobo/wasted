import { describe, expect, it } from "vitest";
import { buildReport } from "./report";
import { renderReportEmail } from "./report-email";

const categories = [
  { id: "comida", name: "Comida", emoji: "🍔" },
  { id: "transporte", name: "Transporte <script>", emoji: "🚕" },
];

const report = buildReport(
  "semana",
  "2026-10-19",
  "2026-10-26",
  [
    { type: "expense", amount: 30_000, category_id: "comida", occurred_on: "2026-10-19" },
    { type: "expense", amount: 12_000, category_id: "transporte", occurred_on: "2026-10-20" },
    { type: "income", amount: 200_000, category_id: null, occurred_on: "2026-10-19" },
    { type: "expense", amount: 60_000, category_id: "comida", occurred_on: "2026-10-14" },
  ],
  categories,
);

const email = renderReportEmail({
  report,
  kind: "semana",
  name: "Jacobo Giraldo",
  appUrl: "https://wasted-lilac.vercel.app",
});
// Intl separa "$" del número con un espacio no separable.
const plain = (s: string) => s.replaceAll("\u00a0", " ");

describe("renderReportEmail", () => {
  it("resume el periodo en el asunto", () => {
    expect(plain(email.subject)).toBe("Wasted · Tu semana (19 – 25 oct): gastaste $ 42.000");
  });

  it("incluye cifras, variación y categorías en el texto plano", () => {
    const text = plain(email.text);
    expect(text).toContain("Hola, Jacobo.");
    expect(text).toContain("Gastaste: $ 42.000 (▼ 30% vs la semana anterior)");
    expect(text).toContain("Balance: +$ 158.000");
    expect(text).toContain("- Comida: $ 30.000 (71%)");
  });

  it("enlaza al dashboard del mismo periodo", () => {
    expect(email.html).toContain(
      'href="https://wasted-lilac.vercel.app/?vista=dashboard&periodo=semana&fecha=2026-10-19"',
    );
  });

  it("escapa el HTML de los nombres", () => {
    expect(email.html).toContain("Transporte &lt;script&gt;");
    expect(email.html).not.toContain("<script>");
  });
});
