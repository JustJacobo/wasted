/**
 * Hace aparecer suavemente la fila de un movimiento recién guardado. La fila
 * llega con el refresco del servidor, así que se espera a que exista (hasta
 * 3s) y se anima antes de su primer pintado, en el mismo frame.
 */
export function revealRow(id: string) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const keyframes = reduce
    ? [{ opacity: 0 }, { opacity: 1 }]
    : [
        { opacity: 0, transform: "translateY(-6px)" },
        { opacity: 1, transform: "translateY(0)" },
      ];
  const start = performance.now();

  function tick() {
    const row = document.querySelector<HTMLElement>(`[data-tx-id="${CSS.escape(id)}"]`);
    if (row) {
      // Misma curva que el token --ease-ui (WAAPI no acepta var()).
      row.animate(keyframes, { duration: 240, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
      return;
    }
    if (performance.now() - start < 3_000) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
