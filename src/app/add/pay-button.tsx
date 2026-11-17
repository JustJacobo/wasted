"use client";

import { openPayment } from "./pay-event";

/** Una fila de "Próximos movimientos": abre la ventana de registro para marcar ese recurrente pagado. */
export function PayButton({
  ruleId,
  occurrence,
  className,
  children,
}: {
  ruleId: string;
  occurrence: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={() => openPayment({ ruleId, occurrence })} className={className}>
      {children}
    </button>
  );
}
