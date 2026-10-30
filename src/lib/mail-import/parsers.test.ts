import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  cleanText,
  invoiceXml,
  isOwnName,
  MAX_UNZIPPED_BYTES,
  parseAmount,
  parseEmail,
  spanishDate,
  type MailMessage,
} from "./parsers";

const OWNER = "Jacobo Giraldo Rios";

function mail(partial: Partial<MailMessage>): MailMessage {
  return {
    messageId: "<abc@mail>",
    from: "notificaciones@nequi.com.co",
    fromName: "Nequi",
    subject: "",
    date: new Date("2026-10-21T03:10:59Z"),
    text: "",
    attachments: [],
    ...partial,
  };
}

// Textos reales (convertidos de HTML a texto), sin datos personales.
const NEQUI_SENT = `NEQUI | | | ¡Realizaste un envío por Bre-B y todo salió bien! | | ¡Hola, JACOBO GIRALDO RIOS! |
| Enviaste de manera exitosa 7.500 a la llave 0012345678 de CRES CATERING SAS el 8 de septiembre de 2026 a las 7:51 p.m. Revisa el detalle en los movimientos de tu app o descarga el comprobante si lo necesitas. |`;
const NEQUI_RECEIVED_OWN = `| ¡Recibiste plata por Bre-B! | | ¡Hola, JACOBO GIRALDO RIOS! |
| Recibiste 42.000 de Jacobo Giraldo Rios el 20 de octubre de 2026 a las 10:10 p.m, desde el banco Nubank. Revisa el detalle |`;
const NEQUI_PSE = `| ¡Pago exitoso! | | Hiciste un pago en PEXTO COLOMBIA SAS por $38.069 Fecha: El 22 de agosto de 2026 Hora: 8:27 p. m. CUS: 123456789 Puedes ingresar a tu app Nequi |`;
const NEQUI_CIVICA = `| Recarga en Cívica - Metro de Medellín | | Hiciste una recarga a tu Cívica por $10.000 | | Estado: Exitoso | | Comprobante de Pago | | Valor: $10.000 | | Fecha del pago: 4/Oct/2026 |`;
const UBER = `| 20/10/2026 5:09 p.m. | | 20/10/2026 , 5:09 p.m. | | Gracias por usar Uber, Jacobo Esperamos que hayas disfrutado tu viaje de esta noche. | | | Total | COP 7,901 | | Tarifa del viaje | COP 9,522 | | Descuentos y ajustes | -COP 1,621 | | Pagos | | Cash | COP 7,901 |`;
const RAPPI = `| | ##### sin Miseria - Metro | ###### Orden # 1234567890 | # ¡Jacobo, aquí están los detalles de tu pedido! | ##### Entregado con cambios | ##### 2026-10-06 17:39:59 | | ## Total pagado | $23.800 | | ## Cargo neto | ## $23.800 |`;

describe("utilidades", () => {
  it("lee montos colombianos y en formato inglés", () => {
    expect(parseAmount("7.500")).toBe(7500);
    expect(parseAmount("$38.069")).toBe(38069);
    expect(parseAmount("COP 7,901")).toBe(7901);
    expect(parseAmount("1.234.567")).toBe(1234567);
    expect(parseAmount("38.069,50")).toBe(38070);
    expect(parseAmount("12500.00")).toBe(12500);
    expect(parseAmount("abc")).toBeNull();
  });

  it("lee fechas en español", () => {
    expect(spanishDate("el 8 de septiembre de 2026 a las 7:51")).toBe("2026-09-08");
    expect(spanishDate("Fecha del pago: 4/Oct/2026")).toBe("2026-10-04");
    expect(spanishDate("El 31 de febrero de 2026")).toBeNull();
  });

  it("reconoce el nombre propio sin importar mayúsculas ni tildes", () => {
    expect(isOwnName("JACOBO GIRALDO RÍOS", OWNER)).toBe(true);
    expect(isOwnName("Jacobo Giraldo", OWNER)).toBe(true);
    expect(isOwnName("Jacobo Pérez", OWNER)).toBe(false);
    expect(isOwnName("Samuel Duque Rios", OWNER)).toBe(false);
    expect(isOwnName("Tomás Giraldo Rios", OWNER)).toBe(false);
  });

  it("limpia el ruido de tablas", () => {
    expect(cleanText("| ## Total pagado | $23.800 |")).toBe("Total pagado $23.800");
  });
});

describe("Nequi", () => {
  it("envío Bre-B a un comercio", () => {
    expect(parseEmail(mail({ text: NEQUI_SENT, messageId: "<m1>" }), OWNER)).toEqual({
      kind: "expense",
      amount: 7500,
      merchant: "Cres Catering Sas",
      description: "Cres Catering Sas",
      occurredOn: "2026-09-08",
      confidence: "high",
      externalId: "mail:<m1>",
      source: "email_bank",
      provider: "nequi",
    });
  });

  it("envío Bre-B a sí mismo es transferencia propia", () => {
    const text = NEQUI_SENT.replace("CRES CATERING SAS", "JACOBO GIRALDO RIOS");
    expect(parseEmail(mail({ text }), OWNER).kind).toBe("own_transfer");
  });

  it("plata recibida de sí mismo (Nu → Nequi) no es ingreso", () => {
    const parsed = parseEmail(mail({ text: NEQUI_RECEIVED_OWN }), OWNER);
    expect(parsed).toMatchObject({ kind: "own_transfer", amount: 42000, occurredOn: "2026-10-20" });
  });

  it("plata recibida de otra persona es ingreso", () => {
    const text = NEQUI_RECEIVED_OWN.replace("de Jacobo Giraldo Rios el", "de Samuel Duque el");
    expect(parseEmail(mail({ text }), OWNER)).toMatchObject({ kind: "income", amount: 42000, merchant: "Samuel Duque" });
  });

  it("pago PSE usa el CUS como id", () => {
    expect(parseEmail(mail({ from: "somos@nequi.com.co", text: NEQUI_PSE }), OWNER)).toMatchObject({
      kind: "expense",
      amount: 38069,
      merchant: "Pexto Colombia Sas",
      occurredOn: "2026-08-22",
      externalId: "nequi:cus:123456789",
    });
  });

  it("pagar la tarjeta Nu desde Nequi no es gasto", () => {
    const text = NEQUI_PSE.replace("PEXTO COLOMBIA SAS", "NU Compañía de Financiamiento");
    expect(parseEmail(mail({ text }), OWNER).kind).toBe("own_transfer");
  });

  it("recarga de Cívica", () => {
    expect(parseEmail(mail({ from: "somos@nequi.com.co", text: NEQUI_CIVICA }), OWNER)).toMatchObject({
      kind: "expense",
      amount: 10000,
      description: "Recarga Cívica",
      occurredOn: "2026-10-04",
    });
  });

  it("avisos sin movimiento se ignoran", () => {
    const text = "Te enviamos el código de autenticación al centro de notificaciones de Nequi";
    expect(parseEmail(mail({ text }), OWNER).kind).toBe("ignore");
  });
});

describe("Uber y Rappi", () => {
  it("viaje de Uber", () => {
    expect(parseEmail(mail({ from: "noreply@uber.com", text: UBER, subject: "Tu viaje del martes" }), OWNER)).toMatchObject({
      kind: "expense",
      amount: 7901,
      description: "Uber",
      occurredOn: "2026-10-20",
      confidence: "high",
    });
  });

  it("viaje reembolsado se ignora y cancelado va a confirmar", () => {
    const refund = "14/10/2026 7:42 pm Reembolsado Total COP 0 fare adjustment Total anterior COP 2700";
    expect(parseEmail(mail({ from: "noreply@uber.com", text: refund }), OWNER).kind).toBe("ignore");
    const cancel = "14/10/2026 7:42 pm Cancelado Total COP 2700 Parece que no pagaste el monto total.";
    expect(parseEmail(mail({ from: "noreply@uber.com", text: cancel }), OWNER)).toMatchObject({
      kind: "expense",
      amount: 2700,
      confidence: "low",
    });
  });

  it("promociones de Uber sin total se ignoran", () => {
    expect(parseEmail(mail({ from: "noreply@uber.com", text: "Tú decides cuándo empieza tu viaje" }), OWNER).kind).toBe(
      "ignore",
    );
  });

  it("pedido de Rappi", () => {
    expect(
      parseEmail(
        mail({ from: "support@rappimail.com", subject: "Tu pedido de sin Miseria - Metro fue entregado", text: RAPPI }),
        OWNER,
      ),
    ).toMatchObject({
      kind: "expense",
      amount: 23800,
      merchant: "sin Miseria - Metro",
      description: "Rappi · sin Miseria - Metro",
      occurredOn: "2026-10-06",
      externalId: "rappi:1234567890",
    });
  });
});

const INVOICE_XML = `<?xml version="1.0"?><AttachedDocument><cac:Attachment><cbc:Description><![CDATA[<Invoice>
<cbc:UUID schemeName="CUFE-SHA384">ABCDEF0123456789abcdef0123456789abcdef0123456789abcdef0123456789</cbc:UUID>
<cbc:IssueDate>2026-10-19</cbc:IssueDate>
<cac:LegalMonetaryTotal><cbc:PayableAmount currencyID="COP">45900.00</cbc:PayableAmount></cac:LegalMonetaryTotal>
</Invoice>]]></cbc:Description></cac:Attachment></AttachedDocument>`;

describe("facturas DIAN", () => {
  const zip = zipSync({ "ad0001.xml": strToU8(INVOICE_XML), "factura.pdf": new Uint8Array(10) });

  it("lee monto, fecha y CUFE del XML dentro del ZIP", () => {
    expect(
      parseEmail(
        mail({
          from: "facturacion@tienda.com",
          subject: "901234567;FARMACIA EL ROBLE SAS;FE123;01;Farmacia El Roble",
          attachments: [{ filename: "FE123.zip", content: zip }],
        }),
        OWNER,
      ),
    ).toMatchObject({
      kind: "expense",
      amount: 45900,
      merchant: "Farmacia El Roble Sas",
      occurredOn: "2026-10-19",
      externalId: "dian:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
      source: "email_invoice",
      confidence: "high",
    });
  });

  it("omite las de Rappi (ya se cuenta el pedido) y las notas crédito", () => {
    const rappi = mail({ subject: "900843898;RAPPI S.A.S;SFEE103874786;01;RAPPI S.A.S", attachments: [{ filename: "a.zip", content: zip }] });
    expect(parseEmail(rappi, OWNER).kind).toBe("ignore");
    const credit = mail({ subject: "901234567;TIENDA SAS;NC1;91;Tienda", attachments: [{ filename: "a.zip", content: zip }] });
    expect(parseEmail(credit, OWNER).kind).toBe("ignore");
  });

  it("rechaza un ZIP que descomprimido pasa el límite", () => {
    const big = zipSync({ "big.xml": new Uint8Array(MAX_UNZIPPED_BYTES + 1) });
    expect(() => invoiceXml([{ filename: "x.zip", content: big }])).toThrow();
    const parsed = parseEmail(
      mail({ subject: "901234567;TIENDA SAS;FE1;01;Tienda", attachments: [{ filename: "x.zip", content: big }] }),
      OWNER,
    );
    expect(parsed.kind).toBe("ignore");
  });
});

describe("genérico", () => {
  it("toma el total y siempre pide confirmación", () => {
    expect(
      parseEmail(
        mail({ from: "ventas@libreria.co", fromName: "Librería Nacional", text: "Gracias por tu compra. Total a pagar: $ 54.900" }),
        OWNER,
      ),
    ).toMatchObject({ kind: "expense", amount: 54900, merchant: "Librería Nacional", confidence: "low" });
  });

  it("ignora correos sin total, en dólares o con totales que no son pesos", () => {
    const ignore = (text: string) => parseEmail(mail({ from: "x@tienda.com", text }), OWNER).kind;
    expect(ignore("Cambiaste tu contraseña correctamente")).toBe("ignore");
    expect(ignore("Total: US$ 9.99")).toBe("ignore");
    expect(ignore("Total 3 productos")).toBe("ignore");
  });
});
