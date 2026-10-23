import Link from "next/link";
import { getCategories } from "@/lib/data";
import type { TxType } from "@/lib/types";
import { CategoryManager } from "./category-manager";

export default async function CategoriesPage({ searchParams }: PageProps<"/ajustes/categorias">) {
  const { tipo } = await searchParams;
  const type: TxType = tipo === "ingreso" ? "income" : "expense";
  const categories = (await getCategories()).filter((c) => c.type === type);

  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center gap-2 py-2">
        <Link href="/ajustes" className="rounded-lg px-2 py-1 text-sm text-muted active:scale-[0.97]">
          ← Ajustes
        </Link>
        <h1 className="flex-1 text-right text-lg font-bold tracking-tight">Categorías</h1>
      </header>

      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface p-1 ring-1 ring-border">
        {(["expense", "income"] as const).map((t) => (
          <Link
            key={t}
            href={t === "income" ? "/ajustes/categorias?tipo=ingreso" : "/ajustes/categorias"}
            replace
            aria-current={t === type ? "page" : undefined}
            className={`grid h-10 place-items-center rounded-xl text-sm font-medium transition-colors duration-150 ${
              t === type ? "bg-foreground text-background" : "text-muted"
            }`}
          >
            {t === "expense" ? "Gastos" : "Ingresos"}
          </Link>
        ))}
      </div>

      <p className="px-1 text-sm text-muted">
        El orden se usa cuando aún no tienes historial; al registrar, las que más usas salen
        primero. Archivar oculta la categoría sin cambiar tus movimientos pasados.
      </p>

      <CategoryManager key={type} type={type} categories={categories} />
    </main>
  );
}
