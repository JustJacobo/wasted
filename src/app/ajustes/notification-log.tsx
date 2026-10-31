import { PROVIDER_NAMES, WATCHED_PACKAGES } from "@/lib/notifications/parsers";

export interface LogEntry {
  package: string;
  title: string;
  text: string;
  outcome: string;
  processed_at: string;
}

const OUTCOMES: Record<string, string> = {
  recorded: "Registrada",
  pending: "Por revisar",
  duplicate: "Ya estaba",
  own_transfer: "Entre tus cuentas",
  ignored: "Sin movimiento",
};

/** Las últimas notificaciones leídas y qué pasó con cada una: da confianza y ayuda a depurar. */
export function NotificationLog({ entries, when }: { entries: LogEntry[]; when: (iso: string) => string }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl bg-surface ring-1 ring-border">
      {entries.map((e, i) => {
        const provider = WATCHED_PACKAGES[e.package];
        return (
          <li key={i} className="px-4 py-3 text-sm">
            <span className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate font-medium">{provider ? PROVIDER_NAMES[provider] : e.package}</span>
              <span className="shrink-0 text-xs text-muted">
                {OUTCOMES[e.outcome] ?? e.outcome} · {when(e.processed_at)}
              </span>
            </span>
            <span className="mt-0.5 line-clamp-2 block text-xs text-muted">
              {[e.title, e.text].filter(Boolean).join(" · ")}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
