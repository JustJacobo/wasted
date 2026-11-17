import { ScreenHeader } from "@/components/screen-header";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getCategories, getRecurringRule, getTransaction } from "@/lib/data";
import { todayIn } from "@/lib/dates";
import { safeReturnPath } from "@/lib/search";
import { EditForm } from "./edit-form";
import { RepeatSection } from "./repeat-section";

export default async function EditTransactionPage({
  params,
  searchParams,
}: PageProps<"/movimientos/[id]">) {
  const { id } = await params;
  const returnTo = safeReturnPath((await searchParams).volver);
  if (!z.uuid().safeParse(id).success) notFound();

  const [transaction, categories] = await Promise.all([getTransaction(id), getCategories()]);
  if (!transaction) notFound();
  const rule = transaction.recurring_id ? await getRecurringRule(transaction.recurring_id) : null;

  return (
    <main className="mx-auto max-w-lg px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <ScreenHeader title="Editar movimiento" back={returnTo} />
      <EditForm
        transaction={transaction}
        categories={categories}
        returnTo={returnTo}
        repeat={
          transaction.status === "confirmed" && (
            <RepeatSection
              transactionId={transaction.id}
              occurredOn={transaction.occurred_on}
              rule={rule}
              today={todayIn()}
            />
          )
        }
      />
    </main>
  );
}
