/**
 * Logo "w.": la w itálica de Instrument Serif (OFL) convertida a trazo, más un
 * punto redondo. El punto es el mismo de la mecha del resumen semanal.
 * El trazo es fijo para no cargar la fuente; el ícono de la PWA lo reutiliza.
 */
export const LOGO_VIEWBOX = { x: 0, y: -530, width: 740, height: 550 } as const;

export const W_PATH =
  "M137 9Q96 9 74-23Q52-55 66-110L146-412Q159-459 130-459Q109-459 88.5-429Q68-399 44-331Q40-319 30-319Q25-319 22-323.5Q19-328 21-335Q79-516 166-516Q200-516 212-488Q224-460 211-411L127-92Q118-58 126-42Q134-26 150-26Q199-26 259.5-146.5Q320-267 366-499Q369-510 380-510L419-510Q433-510 430-497L350-92Q343-59 351.5-42.5Q360-26 379-26Q408-26 438-54Q468-82 492.5-127Q517-172 532-226Q547-280 547-332Q547-374 540.5-398.5Q534-423 527-440Q520-457 520-477Q520-516 554-516Q578-516 585-489.5Q592-463 592-410Q592-334 573.5-259.5Q555-185 523.5-124.5Q492-64 451.5-27.5Q411 9 366 9Q323 9 300-24.5Q277-58 290-122Q292-129 287.5-130Q283-131 280-125Q252-69 217-30Q182 9 137 9Z";

/** Centro y radio del punto, en las mismas coordenadas del trazo. */
export const DOT = { cx: 676, cy: -46, r: 54 } as const;

const viewBox = `${LOGO_VIEWBOX.x} ${LOGO_VIEWBOX.y} ${LOGO_VIEWBOX.width} ${LOGO_VIEWBOX.height}`;

/**
 * La w toma el color del texto; el punto, el acento del tema (en Tinta es la
 * misma tinta). `dotClassName` permite animar solo el punto.
 */
export function Logo({
  className,
  dotClassName,
  title = "Wasted",
}: {
  className?: string;
  dotClassName?: string;
  title?: string | null;
}) {
  return (
    <svg
      viewBox={viewBox}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title ?? undefined}
      aria-hidden={title ? undefined : true}
    >
      <path d={W_PATH} fill="currentColor" />
      <circle
        cx={DOT.cx}
        cy={DOT.cy}
        r={DOT.r}
        className={dotClassName}
        style={{ fill: "var(--accent)", transformBox: "fill-box", transformOrigin: "center" }}
      />
    </svg>
  );
}
