import { describe, expect, it } from "vitest";
import { atTime, formatTime, occurredAt, timeInputValue } from "./dates";

describe("horas", () => {
  it("muestra la hora de Colombia aunque el instante sea de otro día en UTC", () => {
    // 02:15 UTC del 26 = 9:15 p. m. del 25 en Colombia.
    expect(formatTime("2026-10-26T02:15:00Z")).toBe("9:15 p. m.");
    expect(formatTime("2026-10-25T13:05:00Z")).toBe("8:05 a. m.");
    expect(timeInputValue("2026-10-26T02:15:00Z")).toBe("21:15");
    expect(timeInputValue("2026-10-25T05:00:00Z")).toBe("00:00");
  });

  it("arma el instante desde fecha y hora locales", () => {
    expect(atTime("2026-10-25", "21:15")).toBe("2026-10-26T02:15:00.000Z");
    expect(atTime("2026-10-25", "07:30:00")).toBe("2026-10-25T12:30:00.000Z");
    expect(timeInputValue(atTime("2026-10-25", "21:15"))).toBe("21:15");
  });

  it("solo guarda la hora si el movimiento es de hoy", () => {
    const now = new Date("2026-10-26T02:15:00Z"); // 25 oct, 9:15 p. m.
    expect(occurredAt("2026-10-25", now)).toBe(now.toISOString());
    expect(occurredAt("2026-10-24", now)).toBeNull();
  });
});
