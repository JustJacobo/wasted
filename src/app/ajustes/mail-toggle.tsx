"use client";

import { useOptimistic, useTransition } from "react";
import { setMailImport } from "./actions";

/** Activa o pausa la importación de movimientos desde el correo. */
export function MailToggle({ enabled }: { enabled: boolean }) {
  const [on, setOn] = useOptimistic(enabled);
  const [, startTransition] = useTransition();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() =>
        startTransition(async () => {
          setOn(!on);
          await setMailImport(!on);
        })
      }
      className="flex w-full items-center justify-between px-4 py-3"
    >
      <span>Importar del correo</span>
      <span
        aria-hidden
        className={`relative h-7 w-12 rounded-full transition-colors duration-200 ease-ui ${
          on ? "bg-accent" : "bg-border"
        }`}
      >
        <span
          className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform duration-200 ease-ui ${
            on ? "translate-x-5" : ""
          }`}
        />
      </span>
    </button>
  );
}
