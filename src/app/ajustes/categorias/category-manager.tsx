"use client";

import { useState, useTransition } from "react";
import { Archive, ArrowDown, ArrowUp, PencilSimple } from "@phosphor-icons/react/dist/ssr";
import { CategoryIcon, ICON_COMPONENTS } from "@/components/category-icon";
import {
  CATEGORY_ICON_KEYS,
  CATEGORY_ICONS,
  isCategoryIcon,
  type CategoryIconKey,
} from "@/lib/category-icons";
import type { Category, TxType } from "@/lib/types";
import {
  createCategory,
  moveCategory,
  setArchived,
  updateCategory,
  type CategoryResult,
} from "./actions";

const iconButton =
  "grid size-9 shrink-0 place-items-center rounded-xl text-muted transition-transform duration-150 ease-ui active:scale-[0.97] disabled:opacity-25";

export function CategoryManager({ type, categories }: { type: TxType; categories: Category[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const activeList = categories.filter((c) => !c.archived);
  const archived = categories.filter((c) => c.archived);

  function run(action: () => Promise<CategoryResult>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
      else onOk?.();
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <ul className="divide-y divide-border overflow-hidden rounded-xl bg-surface ring-1 ring-border">
        {activeList.map((c, i) =>
          editing === c.id ? (
            <li key={c.id} className="p-3">
              <CategoryForm
                initial={c}
                pending={pending}
                submitLabel="Guardar"
                onCancel={() => setEditing(null)}
                onSubmit={(name, icon) =>
                  run(() => updateCategory({ id: c.id, name, icon }), () => setEditing(null))
                }
              />
            </li>
          ) : (
            <li key={c.id} className="flex items-center gap-1 py-2 pr-2 pl-4">
              <CategoryIcon category={c} className="size-5 text-xl" />
              <span className="ml-2 min-w-0 flex-1 truncate">{c.name}</span>
              <button
                type="button"
                aria-label={`Subir ${c.name}`}
                disabled={pending || i === 0}
                onClick={() => run(() => moveCategory(c.id, "up"))}
                className={iconButton}
              >
                <ArrowUp aria-hidden className="size-4" />
              </button>
              <button
                type="button"
                aria-label={`Bajar ${c.name}`}
                disabled={pending || i === activeList.length - 1}
                onClick={() => run(() => moveCategory(c.id, "down"))}
                className={iconButton}
              >
                <ArrowDown aria-hidden className="size-4" />
              </button>
              <button
                type="button"
                aria-label={`Editar ${c.name}`}
                disabled={pending}
                onClick={() => {
                  setCreating(false);
                  setEditing(c.id);
                }}
                className={iconButton}
              >
                <PencilSimple aria-hidden className="size-4" />
              </button>
              {c.key === "otros_gasto" || c.key === "otros_ingreso" ? (
                // Respaldo de la categorización: no se archiva; el hueco mantiene las columnas alineadas.
                <span aria-hidden className="size-9 shrink-0" />
              ) : (
                <button
                  type="button"
                  aria-label={`Archivar ${c.name}`}
                  disabled={pending}
                  onClick={() => run(() => setArchived(c.id, true))}
                  className={iconButton}
                >
                  <Archive aria-hidden className="size-4" />
                </button>
              )}
            </li>
          ),
        )}
      </ul>

      {creating ? (
        <div className="rounded-xl bg-surface p-3 ring-1 ring-border">
          <CategoryForm
            initial={{ name: "", icon: null }}
            pending={pending}
            submitLabel="Crear"
            onCancel={() => setCreating(false)}
            onSubmit={(name, icon) =>
              run(() => createCategory({ type, name, icon }), () => setCreating(false))
            }
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setCreating(true);
          }}
          className="h-12 w-full rounded-xl border border-dashed border-border font-medium text-muted transition-transform duration-150 ease-ui active:scale-[0.98]"
        >
          + Nueva categoría
        </button>
      )}

      {archived.length > 0 && (
        <details className="rounded-xl bg-surface ring-1 ring-border">
          <summary className="cursor-pointer px-4 py-3 text-sm text-muted select-none">
            Archivadas ({archived.length})
          </summary>
          <ul className="divide-y divide-border border-t border-border">
            {archived.map((c) => (
              <li key={c.id} className="flex items-center gap-2 py-2 pr-2 pl-4">
                <CategoryIcon category={c} className="size-5 text-xl text-muted" />
                <span className="min-w-0 flex-1 truncate text-muted">{c.name}</span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => setArchived(c.id, false))}
                  className="rounded-lg px-2 py-1 text-sm font-medium active:scale-[0.97]"
                >
                  Restaurar
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function CategoryForm({
  initial,
  pending,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: { name: string; icon: string | null };
  pending: boolean;
  submitLabel: string;
  onSubmit: (name: string, icon: CategoryIconKey) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [icon, setIcon] = useState<CategoryIconKey | null>(
    isCategoryIcon(initial.icon) ? initial.icon : null,
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (icon) onSubmit(name, icon);
      }}
      className="space-y-3"
    >
      <input
        aria-label="Nombre"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nombre de la categoría"
        maxLength={30}
        className="h-12 w-full rounded-xl border border-border bg-background px-3 outline-none placeholder:text-muted focus:border-foreground"
      />
      <div className="grid grid-cols-8 gap-1" role="radiogroup" aria-label="Ícono">
        {CATEGORY_ICON_KEYS.map((key) => {
          const Icon = ICON_COMPONENTS[key];
          const active = icon === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={CATEGORY_ICONS[key].label}
              onClick={() => setIcon(key)}
              className={`grid aspect-square place-items-center rounded-xl transition-[transform,background-color,color] duration-150 ease-ui active:scale-[0.94] ${
                active ? "bg-foreground text-background" : "text-muted"
              }`}
            >
              <Icon aria-hidden className="size-5" />
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-11 flex-1 rounded-xl text-sm font-medium text-muted active:scale-[0.98]"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pending || !name.trim() || !icon}
          className="h-11 flex-1 rounded-xl bg-foreground text-sm font-semibold text-background transition-[transform,opacity] duration-150 ease-ui active:scale-[0.98] disabled:opacity-30"
        >
          {pending ? "Guardando…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
