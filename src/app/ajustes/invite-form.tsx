"use client";

import { useActionState } from "react";
import { inviteMember, type InviteState } from "./actions";

export function InviteForm() {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteMember, {});

  return (
    <form action={action} className="space-y-2">
      <div className="flex gap-2">
        <label htmlFor="invite-email" className="sr-only">
          Correo a invitar
        </label>
        <input
          id="invite-email"
          key={state.invited}
          name="email"
          type="email"
          required
          inputMode="email"
          autoComplete="off"
          placeholder="correo@ejemplo.com"
          className="h-12 min-w-0 flex-1 rounded-2xl border border-border bg-surface px-4 outline-none placeholder:text-muted focus:border-foreground"
        />
        <button
          disabled={pending}
          className="h-12 shrink-0 rounded-2xl bg-foreground px-4 font-medium text-background transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50"
        >
          {pending ? "Agregando…" : "Invitar"}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="px-1 text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.invited && (
        <p className="px-1 text-sm text-accent-ink" aria-live="polite">
          {state.invited} ya puede entrar.
        </p>
      )}
    </form>
  );
}
