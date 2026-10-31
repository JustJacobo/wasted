import { Handshake, PiggyBank } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { formatCOP } from "@/lib/money";

const row =
  "mt-3 flex items-center justify-between gap-3 rounded-xl bg-surface px-4 py-3 text-sm ring-1 ring-border active:scale-[0.99]";

/** En el inicio, solo si hay algo: préstamos abiertos y lo apartado en metas. */
export function MoneyRows({ owedToMe, iOwe, saved }: { owedToMe: number; iOwe: number; saved: number }) {
  const loans = [owedToMe > 0 && `Te deben ${formatCOP(owedToMe)}`, iOwe > 0 && `Debes ${formatCOP(iOwe)}`].filter(Boolean);
  return (
    <>
      {loans.length > 0 && (
        <Link href="/prestamos" className={row}>
          <span className="tabular min-w-0 truncate">
            <Handshake aria-hidden className="mr-2 inline size-4 align-[-2px] text-muted" />
            {loans.join(" · ")}
          </span>
          <span aria-hidden className="text-muted">
            ›
          </span>
        </Link>
      )}
      {saved > 0 && (
        <Link href="/metas" className={row}>
          <span className="tabular min-w-0 truncate">
            <PiggyBank aria-hidden className="mr-2 inline size-4 align-[-2px] text-muted" />
            Apartado en metas {formatCOP(saved)}
          </span>
          <span aria-hidden className="text-muted">
            ›
          </span>
        </Link>
      )}
    </>
  );
}
