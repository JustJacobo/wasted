"use client";

import { useState, useTransition } from "react";
import type { PeriodKind } from "@/lib/report";
import { sendReportNow, type SendResult } from "./actions";

export function SendReportButton({ kind, anchor }: { kind: PeriodKind; anchor: string }) {
  const [result, setResult] = useState<SendResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setResult(null);
          startTransition(async () => setResult(await sendReportNow(kind, anchor)));
        }}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-surface font-medium ring-1 ring-border transition-transform duration-150 ease-ui active:scale-[0.98] disabled:opacity-50"
      >
        <span aria-hidden>✉️</span>
        {pending ? "Enviando…" : "Enviarme este reporte"}
      </button>
      {result && (
        <p
          role={result.ok ? "status" : "alert"}
          className={`px-1 text-center text-sm ${result.ok ? "text-muted" : "text-danger"}`}
        >
          {result.ok ? `Reporte enviado a ${result.to}.` : result.error}
        </p>
      )}
    </div>
  );
}
