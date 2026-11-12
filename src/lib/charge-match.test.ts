import { describe, expect, it } from "vitest";
import { pickMatch, rideAndTransfer, sameCharge, type ChargeLike } from "./charge-match";

const nuPush: ChargeLike = {
  type: "expense",
  amount: 7901,
  occurred_on: "2026-10-30",
  source: "notification",
  provider: "nu",
  text: "Uber Trip Help",
  category_id: "transporte",
};
const uberMail: ChargeLike = { ...nuPush, source: "email_other", provider: "uber", text: "Uber · Uber" };

describe("dos avisos del mismo cobro", () => {
  it("la tarjeta y el correo con el mismo monto y nombre son uno solo", () => {
    expect(sameCharge(uberMail, nuPush)).toBe("same");
    expect(sameCharge(nuPush, { ...uberMail, occurred_on: "2026-10-29" })).toBe("same");
  });

  it("mismo monto sin nombre en común: se pregunta", () => {
    expect(sameCharge({ ...nuPush, text: "Pexto Colombia" }, uberMail)).toBe("maybe");
  });

  it("dos avisos de la misma app no se unen solos: pueden ser dos viajes iguales", () => {
    expect(sameCharge(nuPush, { ...nuPush })).toBe("maybe");
    expect(sameCharge(uberMail, { ...uberMail })).toBe("maybe");
  });

  it("otro monto, otro tipo o más de un día: no es el mismo", () => {
    expect(sameCharge({ ...uberMail, amount: 7900 }, nuPush)).toBeNull();
    expect(sameCharge({ ...uberMail, type: "income" }, nuPush)).toBeNull();
    expect(sameCharge({ ...uberMail, occurred_on: "2026-11-01" }, nuPush)).toBeNull();
  });
});

describe("con lo registrado a mano", () => {
  const hand: ChargeLike = { type: "expense", amount: 8000, occurred_on: "2026-10-30", source: "manual", provider: null, text: "uber", category_id: "transporte" };

  it("nunca se une solo: monto parecido y mismo nombre o categoría se pregunta", () => {
    expect(sameCharge(nuPush, hand)).toBe("maybe");
    expect(sameCharge({ ...nuPush, text: "Didi" }, hand)).toBe("maybe");
    expect(sameCharge({ ...nuPush, text: "Didi", category_id: "comida" }, hand)).toBeNull();
  });

  it("monto exacto se pregunta aunque no compartan nada", () => {
    expect(sameCharge({ ...nuPush, amount: 8000, text: "Tienda", category_id: null }, hand)).toBe("maybe");
  });

  it("más de 10% de diferencia no se parece", () => {
    expect(sameCharge({ ...nuPush, amount: 7000 }, hand)).toBeNull();
  });
});

describe("el mejor candidato", () => {
  it("prefiere el mismo cobro y luego el monto más cercano", () => {
    const hand = { ...nuPush, id: "a", source: "manual", provider: null, amount: 8000 };
    const mail = { ...uberMail, id: "b" };
    expect(pickMatch(nuPush, [hand, mail])?.item.id).toBe("b");
    expect(pickMatch(nuPush, [hand, { ...hand, id: "c", amount: 7901 }])).toMatchObject({ item: { id: "c" }, strength: "maybe" });
    expect(pickMatch(nuPush, [])).toBeNull();
  });
});

describe("el viaje y la transferencia al conductor", () => {
  const transfer: ChargeLike = {
    type: "expense",
    amount: 15000,
    occurred_on: "2026-11-12",
    occurred_at: "2026-11-12T13:05:00Z",
    source: "notification",
    provider: "nequi",
    text: "Juan Perez · Juan Perez",
    category_id: null,
    transfer: true,
  };
  const didi: ChargeLike = { ...transfer, provider: "didi", text: "DiDi · DiDi", category_id: "transporte", transfer: false, occurred_at: "2026-11-12T12:50:00Z" };

  it("mismo monto y pocos minutos: es el mismo cobro aunque no compartan nombre", () => {
    expect(sameCharge(didi, transfer)).toBe("same");
    expect(sameCharge(transfer, didi)).toBe("same");
  });

  it("más de una hora, otro monto o sin hora: no se unen por esta regla", () => {
    expect(rideAndTransfer({ ...didi, occurred_at: "2026-11-12T10:00:00Z" }, transfer)).toBe(false);
    expect(rideAndTransfer({ ...didi, amount: 15100 }, transfer)).toBe(false);
    expect(rideAndTransfer({ ...didi, occurred_at: null }, transfer)).toBe(false);
  });

  it("dos transferencias del mismo monto no son un viaje", () => {
    const other = { ...transfer, provider: "nu", text: "Maria Lopez · Maria Lopez" };
    expect(rideAndTransfer(other, transfer)).toBe(false);
    expect(sameCharge(other, transfer)).toBe("maybe");
  });
});

