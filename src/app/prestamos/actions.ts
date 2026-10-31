"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { saveLoanMove, undoMove } from "@/lib/record-move";

export type LoanActionResult = { error?: string; message?: string };

const Amount = z.number().int().positive("Escribe el monto.").max(999_999_999_999, "El monto es demasiado grande.");

function refresh() {
  revalidatePath("/prestamos");
  revalidatePath("/");
}

const NewLoan = z.object({
  kind: z.enum(["lend", "borrow"]),
  person: z.string().trim().min(1, "Escribe el nombre.").max(60, "Máximo 60 caracteres."),
  amount: Amount,
});

/** "Presté" o "Me prestaron": se suma al préstamo abierto con esa persona o crea uno. */
export async function addLoan(input: z.input<typeof NewLoan>): Promise<LoanActionResult> {
  const { supabase } = await requireUser();
  const parsed = NewLoan.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const result = await saveLoanMove(supabase, { ...parsed.data, occurredOn: todayIn() });
  if (!result?.ok) return { error: result?.error ?? "No pude guardar el préstamo." };
  refresh();
  return { message: result.message };
}

const Payment = z.object({ loanId: z.uuid(), amount: Amount });

/** "Me pagó" o "Le pagué", parcial o total. */
export async function payLoan(input: z.input<typeof Payment>): Promise<LoanActionResult> {
  const { supabase } = await requireUser();
  const parsed = Payment.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { data: loan } = await supabase
    .from("loans")
    .select("person, direction, closed_at")
    .eq("id", parsed.data.loanId)
    .maybeSingle();
  if (!loan || loan.closed_at) return { error: "Ese préstamo ya está saldado." };
  const result = await saveLoanMove(
    supabase,
    {
      kind: loan.direction === "lent" ? "repaid" : "repay",
      person: loan.person,
      amount: parsed.data.amount,
      occurredOn: todayIn(),
    },
    { loanId: parsed.data.loanId },
  );
  if (!result?.ok) return { error: result?.error ?? "No pude guardar el pago." };
  refresh();
  return { message: result.message };
}

/** Quita un movimiento del historial (si era el único, el préstamo desaparece). */
export async function removeLoanMove(moveId: string): Promise<LoanActionResult> {
  const { supabase } = await requireUser();
  if (!z.uuid().safeParse(moveId).success) return { error: "Movimiento no válido." };
  const result = await undoMove(supabase, moveId);
  if (result === "missing") return { error: "Ese movimiento ya no existe." };
  if (result === "blocked") return { error: "No se puede quitar: el préstamo quedaría en negativo. Quita primero los pagos." };
  refresh();
  return {};
}

/** Borra el préstamo con todo su historial: deja de contar en tu saldo. */
export async function deleteLoan(loanId: string): Promise<LoanActionResult> {
  const { supabase } = await requireUser();
  if (!z.uuid().safeParse(loanId).success) return { error: "Préstamo no válido." };
  const { error } = await supabase.from("loans").delete().eq("id", loanId);
  if (error) return { error: "No pude borrarlo." };
  refresh();
  return {};
}
