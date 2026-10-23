import { describe, expect, it } from "vitest";
import { parseEmail } from "./parsers";
import { htmlText } from "./html";

describe("htmlText", () => {
  it("separa las celdas de las tablas", () => {
    const html =
      "<table><tr><td>Gracias por usar Uber, Jacobo</td></tr><tr><td>Total</td><td>COP 7,901</td></tr></table>";
    const text = htmlText(html);
    expect(text).toMatch(/Jacobo\s+Total\s+COP 7,901/);
  });

  it("no pone en mayúsculas los títulos ni copia los enlaces", () => {
    const text = htmlText('<h2>Total pagado</h2><a href="https://x.co/track">Ver pedido</a>');
    expect(text).toContain("Total pagado");
    expect(text).not.toContain("https://");
  });

  it("deja los recibos de Uber listos para el parser", () => {
    const html =
      "<table><tr><td>20/10/2026 5:09 p.m.</td></tr><tr><td>Gracias por usar Uber, Dev</td></tr><tr><td>Total</td><td>COP 7,901</td></tr></table>";
    const parsed = parseEmail(
      {
        messageId: "<u>",
        from: "noreply@uber.com",
        fromName: "Uber",
        subject: "Tu viaje",
        date: new Date("2026-10-20T22:38:18Z"),
        text: htmlText(html),
        attachments: [],
      },
      "Dev",
    );
    expect(parsed).toMatchObject({ kind: "expense", amount: 7901, occurredOn: "2026-10-20" });
  });
});
