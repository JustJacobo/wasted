"use client";

import { useOptimistic, useTransition } from "react";
import { setReportPreference } from "./actions";

type Field = "report_weekly" | "report_monthly";

export function ReportToggles({ weekly, monthly }: { weekly: boolean; monthly: boolean }) {
  const [state, setOptimistic] = useOptimistic(
    { report_weekly: weekly, report_monthly: monthly },
    (current, change: { field: Field; value: boolean }) => ({ ...current, [change.field]: change.value }),
  );
  const [, startTransition] = useTransition();

  function toggle(field: Field) {
    const value = !state[field];
    startTransition(async () => {
      setOptimistic({ field, value });
      await setReportPreference(field, value);
    });
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-surface ring-1 ring-border">
      {(
        [
          ["report_weekly", "Reporte semanal"],
          ["report_monthly", "Reporte mensual"],
        ] as const
      ).map(([field, label]) => (
        <li key={field}>
          <button
            type="button"
            role="switch"
            aria-checked={state[field]}
            onClick={() => toggle(field)}
            className="flex w-full items-center justify-between px-4 py-3"
          >
            <span>{label}</span>
            <span
              aria-hidden
              className={`relative h-7 w-12 rounded-full transition-colors duration-200 ease-ui ${
                state[field] ? "bg-accent" : "bg-border"
              }`}
            >
              <span
                className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform duration-200 ease-ui ${
                  state[field] ? "translate-x-5" : ""
                }`}
              />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
