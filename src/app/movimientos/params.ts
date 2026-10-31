import { z } from "zod";
import type { HistoryFilters } from "@/lib/data";

const TYPES = { todos: null, gasto: "expense", ingreso: "income" } as const;
export type TypeParam = keyof typeof TYPES;

/**
 * Filtros del Historial leídos de la URL (los usan la página y su CSV). Lo que
 * no es válido cae en el valor por defecto: el mes actual, todo, sin categoría.
 */
export function historyParams(params: Record<string, string | string[] | undefined>, today: string) {
  const current = today.slice(0, 7);
  const monthParam = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).safeParse(params.mes);
  const month = monthParam.success && monthParam.data <= current ? monthParam.data : current;
  const typeKey: TypeParam =
    typeof params.tipo === "string" && params.tipo in TYPES ? (params.tipo as TypeParam) : "todos";
  const cat = z.uuid().safeParse(params.cat);
  const categoryId = cat.success ? cat.data : null;
  const query = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const filters: HistoryFilters = { month, type: TYPES[typeKey], categoryId, query };
  return { current, month, typeKey, categoryId, query, filters };
}
