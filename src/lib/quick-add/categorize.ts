import { DEFAULT_KEYWORDS } from "./keywords";
import { fold, type TxType } from "./parse";

export interface CategoryOption {
  id: string;
  key: string | null;
  name: string;
  type: TxType;
}

export interface CategoryRule {
  keyword: string;
  category_id: string;
}

/** Texto normalizado con el que se guardan y comparan las reglas aprendidas. */
export function ruleKeyword(description: string): string {
  return fold(description).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function containsPhrase(text: string, phrase: string): boolean {
  return ` ${text} `.includes(` ${phrase} `);
}

/**
 * Busca la categoría por reglas del usuario y luego por palabras clave
 * integradas. Gana la frase más larga, para que "mercado libre" pese más que
 * "mercado". Devuelve null si nada coincide.
 */
export function matchCategory(
  description: string,
  type: TxType,
  categories: CategoryOption[],
  rules: CategoryRule[],
): string | null {
  const text = ruleKeyword(description);
  if (!text) return null;

  const byId = new Map(categories.filter((c) => c.type === type).map((c) => [c.id, c]));

  const ruleHit = rules
    .filter((r) => byId.has(r.category_id) && containsPhrase(text, r.keyword))
    .sort((a, b) => b.keyword.length - a.keyword.length)[0];
  if (ruleHit) return ruleHit.category_id;

  let best: { id: string; length: number } | null = null;
  for (const category of byId.values()) {
    for (const keyword of DEFAULT_KEYWORDS[category.key ?? ""] ?? []) {
      if (containsPhrase(text, keyword) && keyword.length > (best?.length ?? 0)) {
        best = { id: category.id, length: keyword.length };
      }
    }
  }
  return best?.id ?? null;
}

/** La categoría "Otros" del tipo dado, o la última disponible. */
export function fallbackCategory(
  type: TxType,
  categories: CategoryOption[],
): string | null {
  const key = type === "expense" ? "otros_gasto" : "otros_ingreso";
  const ofType = categories.filter((c) => c.type === type);
  return (ofType.find((c) => c.key === key) ?? ofType.at(-1))?.id ?? null;
}
