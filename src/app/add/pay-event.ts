// "Próximos movimientos" (y luego el Plan) abren la ventana de registro lista
// para marcar un recurrente pagado, sin recargar la página.

const PAY_EVENT = "wasted:pagar";

/** Qué recurrente y qué fecha de su serie se paga. */
export interface PaymentPick {
  ruleId: string;
  occurrence: string | null;
}

export function openPayment(pick: PaymentPick) {
  window.dispatchEvent(new CustomEvent<PaymentPick>(PAY_EVENT, { detail: pick }));
}

export function onPayment(listener: (pick: PaymentPick) => void): () => void {
  const handler = (event: Event) => listener((event as CustomEvent<PaymentPick>).detail);
  window.addEventListener(PAY_EVENT, handler);
  return () => window.removeEventListener(PAY_EVENT, handler);
}
