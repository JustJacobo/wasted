import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getCategories, getTransaction } from "@/lib/data";
import { EditForm } from "./edit-form";

export default async function EditTransactionPage({ params }: PageProps<"/movimientos/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [transaction, categories] = await Promise.all([getTransaction(id), getCategories()]);
  if (!transaction) notFound();

  return (
    <main className="mx-auto max-w-lg px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center gap-2 py-2">
        <Link href="/" className="rounded-lg px-2 py-1 text-sm text-muted active:scale-[0.97]">
          ← Volver
        </Link>
      </header>
      <EditForm transaction={transaction} categories={categories} />
    </main>
  );
}
