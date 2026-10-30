import { describe, expect, it } from "vitest";
import { bestMatch, foldText, linkWindow, matchCharge, usefulHint, words, type RuleForMatch } from "./recurring-match";

const youtube: RuleForMatch = {
  type: "expense",
  amount: 44900,
  description: "YouTube Premium",
  match_hint: null,
  every: 1,
  unit: "month",
};
const charge = (amount: number, occurred_on: string, text = "Google Play · YouTube Premium (YouTube)") => ({
  type: "expense" as const,
  amount,
  occurred_on,
  text,
});

describe("¿es el cobro del recurrente?", () => {
  it("mismo monto, fecha cercana y el correo lo nombra: es el mismo cobro", () => {
    expect(matchCharge(youtube, "2026-11-15", charge(44900, "2026-11-14"))).toBe("same");
    expect(matchCharge(youtube, "2026-11-15", charge(44900, "2026-11-18"))).toBe("same");
  });

  it("solo el mismo monto no basta: se pregunta", () => {
    expect(matchCharge(youtube, "2026-11-15", charge(44900, "2026-11-14", "Rappi · Pedido entregado"))).toBe("maybe");
  });

  it("fuera de ±3 días o de otro tipo no", () => {
    expect(matchCharge(youtube, "2026-11-15", charge(44900, "2026-11-19"))).toBeNull();
    expect(matchCharge(youtube, "2026-11-15", { ...charge(44900, "2026-11-15"), type: "income" })).toBeNull();
  });

  it("si subió el precio, lo reconoce por el nombre aprendido", () => {
    const learned = { ...youtube, match_hint: "google play" };
    expect(matchCharge(learned, "2026-12-15", charge(46900, "2026-12-13", "Google Play · Tu recibo"))).toBe("same");
    expect(matchCharge(learned, "2026-12-15", charge(46900, "2026-12-13", "Rappi"))).toBeNull();
    // El nombre tiene que aparecer como palabras completas.
    expect(matchCharge(learned, "2026-12-15", charge(46900, "2026-12-13", "Google Playground"))).toBeNull();
  });

  it("sin nombre aprendido, otro monto con el nombre lo deja como posible", () => {
    expect(matchCharge(youtube, "2026-12-15", charge(46900, "2026-12-15", "Tu recibo de YouTube"))).toBe("maybe");
    expect(matchCharge(youtube, "2026-12-15", charge(46900, "2026-12-15", "Google Play"))).toBeNull();
  });

  it("solo aprende nombres específicos", () => {
    expect(usefulHint("Google Play", "otro")).toBe("google play");
    expect(usefulHint("Sin Miseria - Metro", "rappi")).toBeNull();
    expect(usefulHint("Uber", "uber")).toBeNull();
    expect(usefulHint("ETB", "nequi")).toBeNull();
    expect(usefulHint(null, "otro")).toBeNull();
  });

  it("un cambio de más del 25% no es el mismo cobro", () => {
    const learned = { ...youtube, match_hint: "google play" };
    expect(matchCharge(learned, "2026-12-15", charge(60000, "2026-12-15"))).toBeNull();
  });

  it("en series de pocos días la ventana se achica", () => {
    expect(linkWindow({ every: 1, unit: "day" })).toBe(0);
    expect(linkWindow({ every: 10, unit: "day" })).toBe(3);
    expect(linkWindow({ every: 1, unit: "week" })).toBe(3);
    const daily = { ...youtube, every: 1, unit: "day" as const };
    expect(matchCharge(daily, "2026-11-15", charge(44900, "2026-11-16"))).toBeNull();
  });
});

describe("texto", () => {
  it("pliega tildes y quita relleno", () => {
    expect(foldText("Pago   de Música: Spotify™")).toBe("pago de musica spotify");
    expect([...words("Recibo de pago · Spotify AB")]).toEqual(["spotify"]);
  });

  it("prefiere el mismo cobro y luego la fecha más cercana", () => {
    const pick = bestMatch([
      { item: "lejos", strength: "same", days: 3 },
      { item: "posible", strength: "maybe", days: 0 },
      { item: "cerca", strength: "same", days: -1 },
      { item: "nada", strength: null, days: 0 },
    ]);
    expect(pick).toEqual({ item: "cerca", strength: "same" });
  });
});
