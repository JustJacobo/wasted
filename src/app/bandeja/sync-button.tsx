"use client";

import { useState, useTransition } from "react";
import { syncMailNow } from "./actions";

export function SyncButton() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setMessage((await syncMailNow()).message))}
        className="h-12 w-full rounded-2xl bg-surface font-medium ring-1 ring-border transition-transform duration-150 ease-out active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? "Revisando el correo…" : "📧 Revisar correo ahora"}
      </button>
      {message && (
        <p className="px-1 text-center text-sm text-muted" aria-live="polite">
          {message}
        </p>
      )}
    </div>
  );
}
