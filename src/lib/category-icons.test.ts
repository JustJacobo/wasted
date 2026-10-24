import { describe, expect, it } from "vitest";
import { CATEGORY_ICON_KEYS, emojiForIcon, isCategoryIcon } from "./category-icons";
import { ICON_COMPONENTS } from "@/components/category-icon";

describe("íconos de categoría", () => {
  it("reconoce solo claves conocidas", () => {
    expect(isCategoryIcon("taxi")).toBe(true);
    expect(isCategoryIcon("toString")).toBe(false);
    expect(isCategoryIcon("🚕")).toBe(false);
  });

  it("da el emoji equivalente para Telegram", () => {
    expect(emojiForIcon("fork-knife")).toBe("🍔");
  });

  it("cada clave tiene su componente", () => {
    for (const key of CATEGORY_ICON_KEYS) expect(ICON_COMPONENTS[key]).toBeDefined();
  });
});
