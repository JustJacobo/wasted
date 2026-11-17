import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";

/** Un grupo de filas con título y nota opcionales (Ajustes, Plan, Conexiones). */
export function ListSection({
  title,
  note,
  action,
  children,
}: {
  title?: string;
  note?: ReactNode;
  /** Algo a la derecha del título ("Administrar"). */
  action?: ReactNode;
  /** Sin filas, solo el encabezado. */
  children?: ReactNode;
}) {
  return (
    <section className="space-y-2">
      {(title || action) && (
        <div className="flex min-h-6 items-center justify-between gap-3 px-1">
          {title ? <h2 className="text-sm font-medium text-muted">{title}</h2> : <span />}
          {action}
        </div>
      )}
      {children && <div className="divide-y divide-border overflow-hidden rounded-xl bg-surface ring-1 ring-border">{children}</div>}
      {note && <p className="px-1 text-xs text-muted">{note}</p>}
    </section>
  );
}

/**
 * Una fila: ícono, título, subtítulo y un valor a la derecha. Con `href` es un
 * enlace con flecha; `plain` usa <a> (archivos y esquemas como wasted://, que
 * <Link> precargaría o no sabe abrir).
 */
export function ListRow({
  href,
  plain,
  icon,
  title,
  subtitle,
  value,
  trailing,
}: {
  href?: string;
  plain?: boolean;
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  /** Reemplaza la flecha (↓ en una descarga). */
  trailing?: ReactNode;
}) {
  const content = (
    <>
      {icon && <span className="flex w-6 shrink-0 justify-center text-muted">{icon}</span>}
      <span className="min-w-0 flex-1 py-3">
        <span className="block truncate">{title}</span>
        {subtitle && <span className="block truncate text-sm text-muted">{subtitle}</span>}
      </span>
      {value && <span className="tabular max-w-[45%] shrink truncate text-right text-sm text-muted">{value}</span>}
      {trailing ?? (href && <CaretRight aria-hidden className="size-4 shrink-0 text-muted" />)}
    </>
  );
  const row = "flex min-h-13 items-center gap-3 px-4";
  if (!href) return <div className={row}>{content}</div>;
  const className = `${row} transition-colors active:bg-border/40`;
  return plain ? (
    <a href={href} className={className}>
      {content}
    </a>
  ) : (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}
