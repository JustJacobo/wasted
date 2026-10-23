"use client";

import { useTransition } from "react";
import { removeMember } from "./actions";

export function RemoveButton({ email }: { email: string }) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm(`¿Quitar el acceso de ${email}? Sus datos no se borran.`)) {
          start(() => removeMember(email));
        }
      }}
      className="shrink-0 rounded-lg px-2 py-1 text-sm text-danger active:scale-[0.97] disabled:opacity-50"
    >
      {pending ? "Quitando…" : "Quitar"}
    </button>
  );
}
