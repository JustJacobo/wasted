/**
 * Confirma un registro: el punto de la mecha late una vez y el teléfono vibra
 * un toque (solo Android; iOS no tiene la API). Espera a que cierre la ventana.
 */
export function pulseMecha() {
  navigator.vibrate?.(10);
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  setTimeout(() => {
    const dot = document.querySelector<HTMLElement>("[data-mecha-dot]");
    // `scale` va aparte del `translate` con que se centra el punto. Curva de --ease-ui.
    dot?.animate([{ scale: "1" }, { scale: "1.8" }, { scale: "1" }], {
      duration: 420,
      easing: "cubic-bezier(0.23, 1, 0.32, 1)",
    });
  }, 280);
}
