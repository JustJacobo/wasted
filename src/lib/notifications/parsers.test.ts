import { describe, expect, it } from "vitest";
import { parseNotification, type PhoneNotification } from "./parsers";

const OWNER = "Jacobo Giraldo Rios";
// 30 oct 2026, 9:41 p. m. en Colombia (ya es 31 en UTC).
const POSTED = new Date("2026-10-31T02:41:00Z");

const nequi = (title: string, text: string): PhoneNotification => ({ package: "com.nequi.MobileApp", title, text, postedAt: POSTED });
const nu = (title: string, text: string): PhoneNotification => ({ package: "com.nu.production", title, text, postedAt: POSTED });
const parse = (n: PhoneNotification) => parseNotification(n, OWNER);

describe("formatos conocidos", () => {
  it("pago en un comercio con Nequi", () => {
    expect(parse(nequi("Nequi", "Pagaste $38.069 en PEXTO COLOMBIA SAS el 30 de octubre."))).toEqual({
      kind: "expense",
      amount: 38069,
      merchant: "Pexto Colombia Sas",
      description: "Pexto Colombia Sas",
      occurredOn: "2026-10-30",
      confidence: "high",
      provider: "nequi",
    });
  });

  it("compra con la tarjeta Nu, con el comercio antes o después del monto", () => {
    expect(parse(nu("Compra aprobada", "Compra aprobada por $7.901 en UBER *TRIP HELP.UBER.COM con tu tarjeta"))).toMatchObject({
      kind: "expense",
      amount: 7901,
      merchant: "Uber Trip Help",
      confidence: "high",
    });
    expect(parse(nu("Nu", "Compra aprobada en RAPPI COLOMBIA por $23.800"))).toMatchObject({
      kind: "expense",
      amount: 23800,
      merchant: "Rappi Colombia",
    });
  });

  it("envíos y plata recibida de otras personas", () => {
    expect(parse(nequi("¡Listo!", "Enviaste $7.500 a CRES CATERING SAS"))).toMatchObject({ kind: "expense", amount: 7500, merchant: "Cres Catering Sas" });
    expect(parse(nequi("Te llegó plata", "Recibiste $42.000 de Maria Lopez"))).toMatchObject({ kind: "income", amount: 42000, merchant: "Maria Lopez" });
  });
});

describe("no cuenta", () => {
  it("pasar plata entre tus cuentas", () => {
    expect(parse(nu("Transferencia enviada", "Enviaste $50.000 a JACOBO GIRALDO RIOS")).kind).toBe("own_transfer");
    expect(parse(nequi("Te llegó plata", "Recibiste $50.000 de Jacobo Giraldo Rios desde Nu")).kind).toBe("own_transfer");
    expect(parse(nequi("Nequi", "Pagaste $120.000 en NU COMPAÑIA DE FINANCIAMIENTO")).kind).toBe("own_transfer");
    expect(parse(nu("Pago recibido", "Recibimos el pago de tu tarjeta por $120.000")).kind).toBe("own_transfer");
    expect(parse(nequi("Colchón", "Moviste $20.000 a tu Colchón")).kind).toBe("own_transfer");
  });

  it("compras rechazadas, códigos y publicidad", () => {
    expect(parse(nu("Compra rechazada", "Tu compra por $80.000 en AMAZON fue rechazada")).kind).toBe("ignore");
    expect(parse(nequi("Código", "Tu código de seguridad es 123456")).kind).toBe("ignore");
    expect(parse({ ...nequi("", ""), package: "com.ubercab", title: "20% de descuento", text: "Viajes desde $5.000 este fin de semana" }).kind).toBe("ignore");
  });

  it("apps que no están en la lista", () => {
    expect(parse({ ...nequi("Juan", "Pagaste $5.000 en algo"), package: "com.whatsapp" })).toMatchObject({ kind: "ignore", provider: null });
  });
});

describe("sin formato conocido", () => {
  it("un viaje con monto va a la bandeja como gasto de transporte", () => {
    expect(parse({ package: "com.didiglobal.passenger", title: "Viaje finalizado", text: "Total $8.500. Califica a tu conductor", postedAt: POSTED })).toMatchObject({
      kind: "expense",
      amount: 8500,
      merchant: "DiDi",
      confidence: "low",
      provider: "didi",
    });
  });

  it("otro aviso con monto va a la bandeja y adivina si entra o sale", () => {
    expect(parse(nequi("Nequi", "Se hizo un débito automático por $15.900"))).toMatchObject({ kind: "expense", amount: 15900, confidence: "low", merchant: "Nequi" });
    expect(parse(nu("Nu", "Devolución de $12.000 de tu compra"))).toMatchObject({ kind: "income", amount: 12000, confidence: "low" });
  });

  it("sin monto no hay movimiento", () => {
    expect(parse(nequi("Nequi", "Actualiza tu app")).kind).toBe("ignore");
  });
});
