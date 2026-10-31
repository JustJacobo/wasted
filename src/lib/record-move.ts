import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  goalMessage,
  isGoalIntent,
  LOAN_KINDS,
  loanMessage,
  outstanding,
  parseMoneyMove,
  saved,
  sameName,
  type Goal,
  type GoalIntent,
  type Loan,
  type LoanDirection,
  type LoanIntent,
} from "@/lib/money-moves";
import { formatCOP } from "@/lib/money";

// Guarda préstamos, pagos y metas escritos como texto ("le presté 20k a juan").
// Con el cliente de sesión basta RLS; con el de servicio hay que pasar `userId`.

export type MoveResult =
  | { ok: true; message: string; moveId: string }
  | { ok: false; error: string; duplicate?: boolean };

interface MoveOptions {
  userId?: string;
  /** Evita repetirlo si el mismo mensaje llega dos veces (Telegram reintenta). */
  externalId?: string;
  now?: Date;
}

async function movesOf(client: SupabaseClient, column: "loan_id" | "goal_id", id: string, except?: string) {
  let query = client.from("balance_moves").select("amount").eq(column, id);
  if (except) query = query.neq("id", except);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Si el texto es un préstamo, un pago o una meta lo guarda y devuelve la
 * confirmación; null si es un gasto o ingreso normal (o un pago sin préstamo
 * abierto, que sigue siendo un gasto o ingreso como antes).
 */
export async function recordMoneyMove(
  client: SupabaseClient,
  text: string,
  options: MoveOptions = {},
): Promise<MoveResult | null> {
  const intent = parseMoneyMove(text, options.now);
  if (!intent) return null;
  return isGoalIntent(intent) ? saveGoalMove(client, intent, options) : saveLoanMove(client, intent, options);
}

/**
 * Apartar o sacar de una meta. Por nombre (desde el texto; apartar en una meta
 * que no existe la crea) o por `goalId` (desde la pantalla de metas).
 */
export async function saveGoalMove(
  client: SupabaseClient,
  intent: GoalIntent,
  { userId, externalId, goalId }: MoveOptions & { goalId?: string } = {},
): Promise<MoveResult | null> {
  const owner = userId ? { user_id: userId } : {};
  let goalsQuery = client.from("goals").select("id, name, target, archived, created_at").eq("archived", false);
  if (userId) goalsQuery = goalsQuery.eq("user_id", userId);
  if (goalId) goalsQuery = goalsQuery.eq("id", goalId);
  const { data: goals, error } = await goalsQuery;
  if (error) throw error;
  let goal = goalId ? (goals as Goal[])[0] : (goals as Goal[]).find((g) => sameName(g.name, intent.goal));
  if (!goal && goalId) return { ok: false, error: "Esa meta ya no existe." };
  let created = false;
  if (!goal) {
    // "Saqué 50k del cajero" o "guardé 15k parqueadero" no son metas: siguen siendo un gasto.
    if (intent.kind === "withdraw" || !intent.canCreate) return null;
    const { data, error: createError } = await client
      .from("goals")
      .insert({ name: intent.goal, ...owner })
      .select("id, name, target, archived, created_at")
      .single();
    if (createError) throw createError;
    goal = data as Goal;
    created = true;
  }
  const before = saved(await movesOf(client, "goal_id", goal.id));
  if (intent.kind === "withdraw" && intent.amount > before) {
    return { ok: false, error: `En ${goal.name} solo hay ${formatCOP(Math.max(0, before))} apartados.` };
  }

  const sign = intent.kind === "save" ? -1 : 1;
  const { data: move, error: moveError } = await client
    .from("balance_moves")
    .insert({
      goal_id: goal.id,
      amount: sign * intent.amount,
      occurred_on: intent.occurredOn,
      ...owner,
      ...(externalId ? { external_id: externalId } : {}),
    })
    .select("id")
    .single();
  if (moveError?.code === "23505") return { ok: false, error: "Ya estaba registrado.", duplicate: true };
  if (moveError) throw moveError;
  const total = before - sign * intent.amount;
  return { ok: true, moveId: move.id, message: goalMessage(intent.kind, goal, intent.amount, total, created) };
}

/**
 * Prestar, que te presten o un pago. Se suma al préstamo abierto con esa
 * persona (o crea uno); un pago sin préstamo abierto devuelve null. Con
 * `loanId` (desde la pantalla de préstamos) va a ese préstamo, sin buscar por nombre.
 */
export async function saveLoanMove(
  client: SupabaseClient,
  intent: LoanIntent,
  { userId, externalId, loanId }: MoveOptions & { loanId?: string } = {},
): Promise<MoveResult | null> {
  const { direction, sign } = LOAN_KINDS[intent.kind];
  if (!intent.person) {
    return {
      ok: false,
      error:
        intent.kind === "lend"
          ? "¿A quién le prestaste? Escribe por ejemplo “le presté 20k a Juan”."
          : "¿Quién te prestó? Escribe por ejemplo “Juan me prestó 50k”.",
    };
  }
  const owner = userId ? { user_id: userId } : {};

  let loansQuery = client
    .from("loans")
    .select("id, person, direction, created_at, closed_at")
    .eq("direction", direction)
    .is("closed_at", null);
  if (userId) loansQuery = loansQuery.eq("user_id", userId);
  if (loanId) loansQuery = loansQuery.eq("id", loanId);
  const { data: loans, error } = await loansQuery;
  if (error) throw error;
  let loan = loanId ? (loans as Loan[])[0] : (loans as Loan[]).find((l) => sameName(l.person, intent.person));
  if (!loan && loanId) return { ok: false, error: "Ese préstamo ya está saldado." };
  // Un pago sin préstamo abierto con esa persona es un gasto o ingreso normal ("me pagó el jefe").
  if (!loan && (intent.kind === "repaid" || intent.kind === "repay")) return null;
  if (!loan) {
    const { data, error: createError } = await client
      .from("loans")
      .insert({ person: intent.person, direction, ...owner })
      .select("id, person, direction, created_at, closed_at")
      .single();
    if (createError) throw createError;
    loan = data as Loan;
  }

  // Un pago de más dejaría plata que no es ingreso ni préstamo: se pide el monto correcto.
  if (intent.kind === "repaid" || intent.kind === "repay") {
    const left = outstanding(loan.direction, await movesOf(client, "loan_id", loan.id));
    if (intent.amount > left) {
      const owes = intent.kind === "repaid" ? `${loan.person} te debe` : `Le debes a ${loan.person}`;
      return { ok: false, error: `${owes} ${formatCOP(left)}. Registra el pago por ese monto o menos.` };
    }
  }

  const { data: move, error: moveError } = await client
    .from("balance_moves")
    .insert({
      loan_id: loan.id,
      amount: sign * intent.amount,
      occurred_on: intent.occurredOn,
      ...owner,
      ...(externalId ? { external_id: externalId } : {}),
    })
    .select("id")
    .single();
  if (moveError?.code === "23505") return { ok: false, error: "Ya estaba registrado.", duplicate: true };
  if (moveError) throw moveError;

  const left = await syncLoanState(client, loan.id, loan.direction, userId);
  return { ok: true, moveId: move.id, message: loanMessage(intent.kind, loan.person, intent.amount, Math.max(0, left)) };
}

/** Cierra el préstamo si ya no se debe nada, o lo reabre si vuelve a haber pendiente. */
export async function syncLoanState(
  client: SupabaseClient,
  loanId: string,
  direction: LoanDirection,
  userId?: string,
): Promise<number> {
  const left = outstanding(direction, await movesOf(client, "loan_id", loanId));
  let update = client
    .from("loans")
    .update({ closed_at: left > 0 ? null : new Date().toISOString() })
    .eq("id", loanId);
  if (userId) update = update.eq("user_id", userId);
  const { error } = await update;
  if (error) throw error;
  return left;
}

/**
 * Deshace un movimiento de préstamo o meta. Si era lo único del préstamo, el
 * préstamo también se borra. No deshace lo que dejaría un préstamo o una meta
 * en negativo (lo apartado que ya se sacó, un préstamo que ya te pagaron).
 */
export async function undoMove(
  client: SupabaseClient,
  moveId: string,
  userId?: string,
): Promise<"done" | "missing" | "blocked"> {
  let find = client.from("balance_moves").select("id, loan_id, goal_id").eq("id", moveId);
  if (userId) find = find.eq("user_id", userId);
  const { data: move, error: findError } = await find.maybeSingle();
  if (findError) throw findError;
  if (!move) return "missing";

  type LoanRef = { id: string; direction: LoanDirection };
  let loan: LoanRef | null = null;
  if (move.loan_id) {
    let findLoan = client.from("loans").select("id, direction").eq("id", move.loan_id);
    if (userId) findLoan = findLoan.eq("user_id", userId);
    const { data, error } = await findLoan.maybeSingle();
    if (error) throw error;
    loan = data as LoanRef | null;
  }
  const owner = move.loan_id ? "loan_id" : "goal_id";
  const rest = await movesOf(client, owner, (move.loan_id ?? move.goal_id) as string, moveId);
  const after = loan ? outstanding(loan.direction, rest) : saved(rest);
  if (after < 0) return "blocked";

  let remove = client.from("balance_moves").delete().eq("id", moveId);
  if (userId) remove = remove.eq("user_id", userId);
  const { error } = await remove;
  if (error) throw error;
  if (loan) {
    if (rest.length === 0) {
      let removeLoan = client.from("loans").delete().eq("id", loan.id);
      if (userId) removeLoan = removeLoan.eq("user_id", userId);
      const { error: loanError } = await removeLoan;
      if (loanError) throw loanError;
    } else {
      await syncLoanState(client, loan.id, loan.direction, userId);
    }
  }
  return "done";
}
