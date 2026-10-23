"use client";

import { useState, useTransition } from "react";
import type { Category, TxType } from "@/lib/types";
import {
  createCategory,
  moveCategory,
  setArchived,
  updateCategory,
  type CategoryResult,
} from "./actions";

const SUGGESTED = [
  "🍔", "🍕", "☕", "🍺", "🛒", "🚕", "🚌", "⛽", "🏠", "💡", "📱", "💊",
  "🏋️", "🎓", "📚", "🎮", "🎬", "🎉", "✈️", "🐶", "👕", "🎁", "💼", "💰",
];

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

      <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-surface ring-1 ring-border">
        {activeList.map((c, i) =>
          editing === c.id ? (
            <li key={c.id} className="p-3">
              <CategoryForm
                initial={c}
                pending={pending}
                submitLabel="Guardar"
                onCancel={() => setEditing(null)}
                onSubmit={(name, emoji) =>
                  run(() => updateCategory({ id: c.id, name, emoji }), () => setEditing(null))
                }
              />
            </li>
          ) : (
            <li key={c.id} className="flex items-center gap-1 py-2 pr-2 pl-4">
              <span className="text-xl" aria-hidden>
                {c.emoji}
              </span>
              <span className="ml-2 min-w-0 flex-1 truncate">{c.name}</span>
              <button
                type="button"
                aria-label={`Subir ${c.name}`}
                disabled={pending || i === 0}
                onClick={() => run(() => moveCategory(c.id, "up"))}
                className={iconButton}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Bajar ${c.name}`}
                disabled={pending || i === activeList.length - 1}
                onClick={() => run(() => moveCategory(c.id, "down"))}
                className={iconButton}
              >
                ↓
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
                ✎
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
                  className={`${iconButton} text-xs`}
                >
                  🗄️
                </button>
              )}
            </li>
          ),
        )}
      </ul>

      {creating ? (
        <div className="rounded-2xl bg-surface p-3 ring-1 ring-border">
          <CategoryForm
            initial={{ name: "", emoji: "" }}
            pending={pending}
            submitLabel="Crear"
            onCancel={() => setCreating(false)}
            onSubmit={(name, emoji) =>
              run(() => createCategory({ type, name, emoji }), () => setCreating(false))
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
          className="h-12 w-full rounded-2xl border border-dashed border-border font-medium text-muted transition-transform duration-150 ease-ui active:scale-[0.98]"
        >
          + Nueva categoría
        </button>
      )}

      {archived.length > 0 && (
        <details className="rounded-2xl bg-surface ring-1 ring-border">
          <summary className="cursor-pointer px-4 py-3 text-sm text-muted select-none">
            Archivadas ({archived.length})
          </summary>
          <ul className="divide-y divide-border border-t border-border">
            {archived.map((c) => (
              <li key={c.id} className="flex items-center gap-2 py-2 pr-2 pl-4">
                <span className="text-xl opacity-60" aria-hidden>
                  {c.emoji}
                </span>
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
  initial: { name: string; emoji: string };
  pending: boolean;
  submitLabel: string;
  onSubmit: (name: string, emoji: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [emoji, setEmoji] = useState(initial.emoji);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(name, emoji);
      }}
      className="space-y-3"
    >
      <div className="flex gap-2">
        <input
          aria-label="Emoji"
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          placeholder="🙂"
          maxLength={16}
          className="h-12 w-14 shrink-0 rounded-xl border border-border bg-background text-center text-2xl outline-none focus:border-foreground"
        />
        <input
          aria-label="Nombre"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre de la categoría"
          maxLength={30}
          className="h-12 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 outline-none placeholder:text-muted focus:border-foreground"
        />
      </div>
      <div className="-mx-3 flex gap-1 overflow-x-auto px-3 [scrollbar-width:none]" role="group" aria-label="Emojis sugeridos">
        {SUGGESTED.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setEmoji(e)}
            aria-pressed={emoji === e}
            className={`grid size-10 shrink-0 place-items-center rounded-xl text-xl transition-[transform,background-color] duration-150 ease-ui active:scale-[0.97] ${
              emoji === e ? "bg-foreground/10 ring-1 ring-foreground" : ""
            }`}
          >
            {e}
          </button>
        ))}
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
          disabled={pending || !name.trim() || !emoji.trim()}
          className="h-11 flex-1 rounded-xl bg-foreground text-sm font-semibold text-background transition-[transform,opacity] duration-150 ease-ui active:scale-[0.98] disabled:opacity-30"
        >
          {pending ? "Guardando…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
