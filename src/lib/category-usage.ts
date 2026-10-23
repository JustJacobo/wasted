/**
 * Ordena las categorías poniendo primero las que más se usan en los
 * movimientos dados; empata por el orden configurado (`sort`).
 */
export function sortByUsage<C extends { id: string; sort: number }>(
  categories: C[],
  transactions: { category_id: string | null }[],
): C[] {
  const uses = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.category_id) uses.set(tx.category_id, (uses.get(tx.category_id) ?? 0) + 1);
  }
  return [...categories].sort(
    (a, b) => (uses.get(b.id) ?? 0) - (uses.get(a.id) ?? 0) || a.sort - b.sort,
  );
}
