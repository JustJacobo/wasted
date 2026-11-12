import "server-only";

import { after } from "next/server";
import { classifyTransaction, listToClassify } from "@/lib/classify";
import { z } from "zod";
import { addTransaction, deleteTransaction, quickAdd, setCategory, updateTransaction } from "@/app/actions";
import {
  createApiToken,
  createTelegramLink,
  inviteMember,
  removeMember,
  revokeApiToken,
  revokeDeviceKey,
  setAccent,
  setColorMode,
  setMailImport,
  setReportPreference,
  unlinkTelegram,
} from "@/app/ajustes/actions";
import { createCategory, moveCategory, setArchived, updateCategory } from "@/app/ajustes/categorias/actions";
import {
  createRecurring,
  deleteRecurring,
  makeRecurring,
  setRecurringPaused,
  updateRecurring,
} from "@/app/ajustes/recurrentes/actions";
import { confirmPending, discardPending, mergePending, splitPending, syncMailNow } from "@/app/bandeja/actions";
import { archiveGoal, createGoal, deleteGoal, moveGoal, setGoalTarget } from "@/app/metas/actions";
import { historyParams } from "@/app/movimientos/params";
import { addLoan, deleteLoan, payLoan, removeLoanMove } from "@/app/prestamos/actions";
import { sendReportNow } from "@/app/reportes/actions";
import { hashToken, newToken } from "@/lib/api-token";
import { requireUser } from "@/lib/auth";
import {
  getAllTransactions,
  getCategories,
  getGoals,
  getLoans,
  getMoneyOverview,
  getPending,
  getPendingCount,
  getRecentTransactions,
  getRecurring,
  getRecurringRule,
  getReport,
  getRules,
  getSettings,
  getSummary,
  getTransaction,
  getTransactionsForMonth,
  getUpcoming,
} from "@/lib/data";
import { todayIn } from "@/lib/dates";
import { transactionsCsv } from "@/lib/export-csv";
import { canImportMail } from "@/lib/mail-import/sync";
import { onAppOpen } from "@/lib/on-open";

// Lo que la app nativa puede pedir por POST /api/app/<op>. Cada operación usa
// las mismas consultas y Server Actions que la web, con la sesión del Bearer
// (RLS limita al usuario). Lo que no está en esta lista no existe para la app.

const Id = z.object({ id: z.uuid() });
const Empty = z.object({}).optional();

/** Formularios de la web (FormData) armados desde JSON. */
function form(fields: Record<string, string | number | null | undefined>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) if (value !== undefined && value !== null) data.set(key, String(value));
  return data;
}

/** El error que lanza redirect() en una Server Action. */
export const isRedirect = (error: unknown) =>
  typeof (error as { digest?: unknown })?.digest === "string" &&
  (error as { digest: string }).digest.startsWith("NEXT_REDIRECT");

type Op =(input: unknown) => Promise<unknown>;
const op = <S extends z.ZodType>(schema: S, run: (input: z.output<S>) => Promise<unknown>): Op => async (input) =>
  run(schema.parse(input ?? {}));

export const OPS: Record<string, Op> = {
  // Lecturas
  me: op(Empty, async () => {
    const { userId, email, name, role } = await requireUser();
    return { userId, email, name, role };
  }),
  home: op(Empty, async () => {
    const { supabase, userId, email, name } = await requireUser();
    const today = todayIn();
    const [summary, categories, rules, transactions, pendingCount, upcoming, money, { data: saved }, toClassify] = await Promise.all([
      getSummary(today),
      getCategories(),
      getRules(),
      getRecentTransactions(),
      getPendingCount(),
      getUpcoming(today),
      getMoneyOverview(),
      supabase.from("user_settings").select("accent, color_mode").maybeSingle(),
      listToClassify(supabase, userId, today),
    ]);
    // Como al abrir la web: recurrentes vencidos y correo, sin frenar la respuesta.
    after(() => onAppOpen(userId, email, today));
    return {
      today,
      name,
      summary,
      categories,
      rules,
      transactions,
      pendingCount,
      upcoming,
      money,
      toClassify,
      appearance: { accent: saved?.accent ?? null, mode: saved?.color_mode ?? null },
    };
  }),
  /** Transferencia a una persona: qué fue. Se aprende para la próxima a esa persona. */
  classifyTransaction: op(z.object({ id: z.uuid(), categoryId: z.uuid() }), async ({ id, categoryId }) => {
    const { supabase, userId } = await requireUser();
    return classifyTransaction(supabase, userId, id, categoryId);
  }),
  report: op(z.object({ kind: z.enum(["semana", "mes"]), anchor: z.iso.date().optional() }), async ({ kind, anchor }) => {
    const today = todayIn();
    return getReport(kind, anchor && anchor <= today ? anchor : today, today);
  }),
  history: op(
    z.object({ mes: z.string().optional(), tipo: z.string().optional(), cat: z.string().optional(), q: z.string().optional() }),
    async (params) => {
      const today = todayIn();
      const { current, month, typeKey, categoryId, query, filters } = historyParams(params, today);
      const [transactions, categories] = await Promise.all([getTransactionsForMonth(filters), getCategories()]);
      return { today, current, month, tipo: typeKey, categoryId, query, transactions, categories };
    },
  ),
  transaction: op(Id, async ({ id }) => {
    const [transaction, categories] = await Promise.all([getTransaction(id), getCategories()]);
    const rule = transaction?.recurring_id ? await getRecurringRule(transaction.recurring_id) : null;
    return { today: todayIn(), transaction, categories, rule };
  }),
  pending: op(Empty, async () => {
    const { email } = await requireUser();
    const [pending, categories] = await Promise.all([getPending(), getCategories()]);
    return { today: todayIn(), pending, categories, fromMail: canImportMail(email) };
  }),
  settings: op(Empty, () => getSettings()),
  categories: op(Empty, () => getCategories()),
  recurring: op(Empty, async () => {
    const [recurring, categories] = await Promise.all([getRecurring(), getCategories()]);
    return { today: todayIn(), recurring, categories };
  }),
  loans: op(Empty, async () => ({ today: todayIn(), ...(await getLoans()) })),
  goals: op(Empty, () => getGoals()),
  csv: op(
    z.object({ todo: z.boolean().optional(), mes: z.string().optional(), tipo: z.string().optional(), cat: z.string().optional(), q: z.string().optional() }),
    async ({ todo, ...params }) => {
      const today = todayIn();
      const { month, filters } = historyParams(params, today);
      const [transactions, categories] = await Promise.all([
        todo ? getAllTransactions() : getTransactionsForMonth(filters).then((list) => list.reverse()),
        getCategories(),
      ]);
      return { name: todo ? `wasted-${today}.csv` : `wasted-${month}.csv`, csv: transactionsCsv(transactions, categories) };
    },
  ),

  // Movimientos
  quickAdd: op(z.object({ text: z.string().max(200) }), ({ text }) => quickAdd(text)),
  addTransaction: op(z.unknown(), (input) => addTransaction(input as Parameters<typeof addTransaction>[0])),
  deleteTransaction: op(Id, async ({ id }) => {
    await deleteTransaction(id);
    return {};
  }),
  setCategory: op(z.object({ id: z.uuid(), categoryId: z.uuid() }), async ({ id, categoryId }) => {
    await setCategory(id, categoryId);
    return {};
  }),
  updateTransaction: op(
    z.object({
      id: z.uuid(),
      type: z.enum(["expense", "income"]),
      amount: z.number().int().positive(),
      description: z.string().max(200),
      category_id: z.uuid(),
      occurred_on: z.iso.date(),
      occurred_time: z.string().optional(),
    }),
    // Al guardar, la acción de la web redirige al Historial: para la app eso es un éxito.
    (fields) =>
      updateTransaction({}, form(fields)).catch((error) => {
        if (isRedirect(error)) return {};
        throw error;
      }),
  ),

  // Bandeja
  confirmPending: op(z.object({ id: z.uuid(), categoryId: z.uuid() }), ({ id, categoryId }) => confirmPending(id, categoryId)),
  discardPending: op(Id, ({ id }) => discardPending(id)),
  mergePending: op(
    z.object({ recurringTxId: z.uuid(), mailTxId: z.uuid(), categoryId: z.uuid() }),
    ({ recurringTxId, mailTxId, categoryId }) => mergePending(recurringTxId, mailTxId, categoryId),
  ),
  splitPending: op(z.object({ ids: z.array(z.uuid()).max(2) }), ({ ids }) => splitPending(ids)),
  syncMailNow: op(Empty, () => syncMailNow()),

  // Préstamos y metas
  addLoan: op(z.unknown(), (input) => addLoan(input as Parameters<typeof addLoan>[0])),
  payLoan: op(z.unknown(), (input) => payLoan(input as Parameters<typeof payLoan>[0])),
  removeLoanMove: op(Id, ({ id }) => removeLoanMove(id)),
  deleteLoan: op(Id, ({ id }) => deleteLoan(id)),
  createGoal: op(z.unknown(), (input) => createGoal(input as Parameters<typeof createGoal>[0])),
  moveGoal: op(z.unknown(), (input) => moveGoal(input as Parameters<typeof moveGoal>[0])),
  setGoalTarget: op(z.unknown(), (input) => setGoalTarget(input as Parameters<typeof setGoalTarget>[0])),
  archiveGoal: op(z.object({ id: z.uuid(), archived: z.boolean() }), ({ id, archived }) => archiveGoal(id, archived)),
  deleteGoal: op(Id, ({ id }) => deleteGoal(id)),

  // Recurrentes
  createRecurring: op(z.unknown(), (input) => createRecurring(input as Parameters<typeof createRecurring>[0])),
  updateRecurring: op(z.unknown(), (input) => updateRecurring(input as Parameters<typeof updateRecurring>[0])),
  setRecurringPaused: op(z.object({ id: z.uuid(), paused: z.boolean() }), ({ id, paused }) => setRecurringPaused(id, paused)),
  deleteRecurring: op(Id, ({ id }) => deleteRecurring(id)),
  makeRecurring: op(
    z.object({ transactionId: z.uuid(), every: z.number().int(), unit: z.enum(["day", "week", "month", "year"]) }),
    ({ transactionId, every, unit }) => makeRecurring(transactionId, { every, unit }),
  ),

  // Categorías
  createCategory: op(z.unknown(), (input) => createCategory(input as Parameters<typeof createCategory>[0])),
  updateCategory: op(z.unknown(), (input) => updateCategory(input as Parameters<typeof updateCategory>[0])),
  moveCategory: op(z.object({ id: z.uuid(), direction: z.enum(["up", "down"]) }), ({ id, direction }) => moveCategory(id, direction)),
  setArchived: op(z.object({ id: z.uuid(), archived: z.boolean() }), ({ id, archived }) => setArchived(id, archived)),

  // Ajustes
  setAccent: op(z.object({ accent: z.string() }), ({ accent }) => setAccent(accent)),
  setColorMode: op(z.object({ mode: z.string() }), ({ mode }) => setColorMode(mode)),
  setReportPreference: op(
    z.object({ field: z.enum(["report_weekly", "report_monthly"]), enabled: z.boolean() }),
    ({ field, enabled }) => setReportPreference(field, enabled),
  ),
  sendReportNow: op(z.object({ kind: z.string(), anchor: z.string() }), ({ kind, anchor }) => sendReportNow(kind, anchor)),
  setMailImport: op(z.object({ enabled: z.boolean() }), async ({ enabled }) => {
    await setMailImport(enabled);
    return {};
  }),
  createTelegramLink: op(Empty, () => createTelegramLink()),
  unlinkTelegram: op(Empty, async () => {
    await unlinkTelegram();
    return {};
  }),
  createApiToken: op(Empty, () => createApiToken()),
  revokeApiToken: op(Empty, async () => {
    await revokeApiToken();
    return {};
  }),
  // Clave del celular para lo nativo (widget, registro rápido, notificaciones):
  // la app la pide al iniciar sesión y la revoca al cerrarla. Reemplaza la que
  // tenía un celular con el mismo nombre (reinstalar no deja claves sueltas).
  createDeviceKey: op(z.object({ device: z.string().trim().min(1).max(80) }), async ({ device }) => {
    const { supabase, userId } = await requireUser();
    const token = newToken();
    await supabase.from("api_tokens").delete().eq("user_id", userId).eq("device", device);
    const { data, error } = await supabase
      .from("api_tokens")
      .insert({ user_id: userId, token_hash: hashToken(token), device })
      .select("id")
      .single();
    if (error || !data) {
      // Sin el token: solo el motivo, para verlo en los logs de Vercel.
      console.error("createDeviceKey", error?.code, error?.message);
      return { error: "No pude conectar el widget de este celular." };
    }
    return { id: data.id, token };
  }),
  revokeDeviceKey: op(Id, async ({ id }) => {
    await revokeDeviceKey(id);
    return {};
  }),
  inviteMember: op(z.object({ email: z.string() }), async ({ email }) => {
    const { role } = await requireUser();
    if (role !== "owner") return { error: "Solo el dueño puede invitar." };
    return inviteMember({}, form({ email }));
  }),
  removeMember: op(z.object({ email: z.string() }), async ({ email }) => {
    const { role } = await requireUser();
    if (role !== "owner") return { error: "Solo el dueño puede quitar personas." };
    await removeMember(email);
    return {};
  }),
};
