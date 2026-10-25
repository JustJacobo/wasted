"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { CATEGORY_COLOR_KEYS } from "@/lib/category-colors";
import { CATEGORY_ICON_KEYS, emojiForIcon } from "@/lib/category-icons";

export type CategoryResult = { error?: string };

const Name = z.string().trim().min(1, "Ponle un nombre.").max(30, "Máximo 30 caracteres.");
const Icon = z.enum(CATEGORY_ICON_KEYS, "Elige un ícono.");
const Type = z.enum(["expense", "income"]);
/** null = gris neutro. */
const Color = z.enum(CATEGORY_COLOR_KEYS).nullable();

function refresh() {
  revalidatePath("/ajustes/categorias");
  revalidatePath("/");
  revalidatePath("/movimientos");
}

function message(error: { code?: string } | null, fallback: string): CategoryResult {
  if (!error) return {};
  if (error.code === "23505") return { error: "Ya existe una categoría con ese nombre (revisa las archivadas)." };
  return { error: fallback };
}

/** "Varios" y "Otros" son el respaldo de la categorización: no se archivan. */
const isFallback = (key: string | null) => key === "otros_gasto" || key === "otros_ingreso";

export async function createCategory(input: {
  type: string;
  name: string;
  icon: string;
  color: string | null;
}): Promise<CategoryResult> {
  const { supabase } = await requireUser();
  const parsed = z.object({ type: Type, name: Name, icon: Icon, color: Color }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Queda antes de "Varios"/"Otros", que van al final.
  const { data: siblings } = await supabase
    .from("categories")
    .select("sort, key")
    .eq("type", parsed.data.type);
  const sort = Math.max(0, ...(siblings ?? []).filter((c) => !isFallback(c.key)).map((c) => c.sort)) + 1;

  // El emoji acompaña al ícono para Telegram y el correo.
  const { error } = await supabase
    .from("categories")
    .insert({ ...parsed.data, emoji: emojiForIcon(parsed.data.icon), sort });
  refresh();
  return message(error, "No pude crear la categoría.");
}

export async function updateCategory(input: {
  id: string;
  name: string;
  icon: string;
  color: string | null;
}): Promise<CategoryResult> {
  const { supabase } = await requireUser();
  const parsed = z
    .object({ id: z.uuid(), name: Name, icon: Icon, color: Color })
    .safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { id, name, icon, color } = parsed.data;
  const { error } = await supabase
    .from("categories")
    .update({ name, icon, color, emoji: emojiForIcon(icon) })
    .eq("id", id);
  refresh();
  return message(error, "No pude guardar los cambios.");
}

/** Sube o baja una categoría entre las activas de su tipo y renumera el orden. */
export async function moveCategory(id: string, direction: "up" | "down"): Promise<CategoryResult> {
  const { supabase } = await requireUser();
  const { data: current } = await supabase
    .from("categories")
    .select("type")
    .eq("id", z.uuid().parse(id))
    .single();
  if (!current) return { error: "No encontré la categoría." };

  const { data: list } = await supabase
    .from("categories")
    .select("id")
    .eq("type", current.type)
    .eq("archived", false)
    .order("sort");
  const ids = (list ?? []).map((c) => c.id);
  const from = ids.indexOf(id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= ids.length) return {};

  [ids[from], ids[to]] = [ids[to], ids[from]];
  const results = await Promise.all(
    ids.map((cid, i) => supabase.from("categories").update({ sort: i + 1 }).eq("id", cid)),
  );
  refresh();
  return results.some((r) => r.error) ? { error: "No pude reordenar." } : {};
}

export async function setArchived(id: string, archived: boolean): Promise<CategoryResult> {
  const { supabase } = await requireUser();
  const { data: category } = await supabase
    .from("categories")
    .select("key")
    .eq("id", z.uuid().parse(id))
    .single();
  if (!category) return { error: "No encontré la categoría." };
  if (archived && isFallback(category.key)) {
    return { error: "Esta categoría es el respaldo cuando nada coincide; no se puede archivar." };
  }

  const { error } = await supabase.from("categories").update({ archived }).eq("id", id);
  refresh();
  return message(error, archived ? "No pude archivarla." : "No pude restaurarla.");
}
