import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { CheckCircleIcon, HandshakeIcon, PiggyBankIcon, PlusIcon } from "phosphor-react-native";
import { View } from "react-native";
import { formatMonth } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import { scheduleLabel, type ScheduledCharge } from "@/lib/recurring-schedule";
import type { Category } from "@/lib/types";
import { api } from "@/core/api";
import type { HomeData, PlanData } from "@/core/types";
import { useTheme } from "@/theme/theme";
import { categoryColor } from "@/theme/tokens";
import { Card } from "@/ui/card";
import { CategoryIcon } from "@/ui/category-icon";
import { ListRow, ListSection } from "@/ui/list";
import { Screen } from "@/ui/screen";
import { Tap } from "@/ui/tap";
import { Text } from "@/ui/text";

/** Abre la ventana de registro lista para marcar esa fecha pagada (aunque sea de más adelante en el mes). */
function pay(c: ScheduledCharge) {
  router.push({
    pathname: "/registrar",
    params: {
      tipo: c.type === "income" ? "ingreso" : "gasto",
      recurrente: c.ruleId,
      ocurrencia: c.occurrence,
      dia: c.day,
      monto: String(c.amount),
      nombre: c.description,
      ...(c.categoryId ? { categoria: c.categoryId } : {}),
      ...(c.txId ? { tx: c.txId } : {}),
    },
  });
}

/** Una barra fina de avance (lo pagado del mes, lo apartado de una meta). */
function Progress({ value, label }: { value: number; label: string }) {
  const { colors } = useTheme();
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{ height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: "hidden" }}
    >
      <View style={{ height: "100%", width: `${clamped * 100}%`, borderRadius: 3, backgroundColor: colors.viz }} />
    </View>
  );
}

/**
 * Plan: lo que se repite y lo que está aparte del día a día. Los pagos fijos
 * del mes (qué falta y qué ya se pagó), los préstamos abiertos y las metas.
 */
export default function PlanScreen() {
  const query = useQuery({ queryKey: ["plan"], queryFn: () => api<PlanData>("plan") });
  // Las categorías ya vienen con el inicio.
  const home = useQuery({ queryKey: ["home"], queryFn: () => api<HomeData>("home") });
  const data = query.data;
  const byId = new Map((home.data?.categories ?? []).map((c) => [c.id, c]));

  return (
    <Screen
      root
      title="Plan"
      loading={!data && !query.error}
      error={query.error?.message}
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
    >
      {data && (
        <View style={{ gap: 28 }}>
          <FixedPayments data={data} byId={byId} />
          <Loans data={data} />
          <Goals data={data} />
          {data.paused > 0 && (
            <Text size={12} tone="muted" style={{ paddingHorizontal: 4 }}>
              {data.paused === 1 ? "1 recurrente en pausa." : `${data.paused} recurrentes en pausa.`} Se reanudan en Administrar.
            </Text>
          )}
        </View>
      )}
    </Screen>
  );
}

function FixedPayments({ data, byId }: { data: PlanData; byId: Map<string, Category> }) {
  const { colors } = useTheme();
  const { items, expense, income } = data.schedule;
  const manage = (
    <Tap accessibilityRole="button" onPress={() => router.push("/recurrentes")} style={{ minHeight: 44, justifyContent: "center", paddingLeft: 12 }}>
      <Text size={14} weight="medium" tone="muted">
        Administrar
      </Text>
    </Tap>
  );

  if (items.length === 0) {
    return (
      <ListSection title={`Pagos fijos · ${formatMonth(data.from)}`} action={data.active > 0 || data.paused > 0 ? manage : undefined}>
        <View style={{ padding: 20, gap: 12, alignItems: "center" }}>
          <Text size={14} tone="muted" align="center">
            Agrega el arriendo, tus suscripciones o la cuota semanal: aquí verás qué falta por pagar este mes y lo marcas pagado con un toque.
          </Text>
          <Tap
            accessibilityRole="button"
            haptic
            onPress={() => router.push({ pathname: "/recurrentes", params: { nuevo: "1" } })}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.foreground }}
          >
            <PlusIcon size={18} weight="bold" color={colors.background} />
            <Text size={14} weight="semibold" style={{ color: colors.background }}>
              Nuevo recurrente
            </Text>
          </Tap>
        </View>
      </ListSection>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <ListSection title={`Pagos fijos · ${formatMonth(data.from)}`} action={manage} />
      {expense.total > 0 && (
        <Card style={{ padding: 16, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <Text size={14} tone="muted">
              {expense.left > 0 ? "Falta pagar" : "Todo pagado"}
            </Text>
            <Text size={24} weight="bold" tabular tracking={-0.6} numberOfLines={1} adjustsFontSizeToFit style={{ flexShrink: 1 }}>
              {formatCOP(expense.left > 0 ? expense.left : expense.paid)}
            </Text>
          </View>
          <Progress value={expense.total ? expense.paid / expense.total : 0} label={`Pagado ${formatCOP(expense.paid)} de ${formatCOP(expense.total)}`} />
          <Text size={13} tone="muted" tabular>
            Pagado {formatCOP(expense.paid)} de {formatCOP(expense.total)}
            {income.total > 0 ? ` · Ingresos fijos ${formatCOP(income.paid)} de ${formatCOP(income.total)}` : ""}
          </Text>
        </Card>
      )}
      <Card>
        {items.map((c, i) => {
          const category = c.categoryId ? byId.get(c.categoryId) : undefined;
          const done = c.status === "paid" || c.status === "skipped";
          const onPress = c.payable ? () => pay(c) : c.status === "paid" && c.txId ? () => router.push(`/movimientos/${c.txId}`) : () => router.push("/recurrentes");
          return (
            <View key={`${c.ruleId}:${c.occurrence}:${c.txId ?? ""}`}>
              {i > 0 && <View style={{ height: 1, backgroundColor: colors.border }} />}
              <Tap
                accessibilityRole="button"
                accessibilityLabel={`${c.description || category?.name || "Recurrente"}, ${scheduleLabel(c, data.today)}, ${formatCOP(c.amount)}`}
                accessibilityHint={c.payable ? "Marcar pagado" : undefined}
                pressScale={0.99}
                onPress={onPress}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingHorizontal: 16, paddingVertical: 10 }}
              >
                {c.status === "paid" ? (
                  <CheckCircleIcon size={24} weight="fill" color={colors.muted} />
                ) : (
                  <CategoryIcon category={category} color={categoryColor(colors, category?.color)} />
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} tone={done ? "muted" : "foreground"}>
                    {c.description || category?.name || "Recurrente"}
                  </Text>
                  <Text size={13} numberOfLines={1} tone={c.status === "pending" || c.status === "overdue" ? "foreground" : "muted"} weight={c.status === "pending" || c.status === "overdue" ? "medium" : "regular"}>
                    {scheduleLabel(c, data.today)}
                  </Text>
                </View>
                <Text mono size={15} tracking={-0.3} tone={done ? "muted" : c.type === "income" ? "accent" : "foreground"} style={{ textDecorationLine: c.status === "skipped" ? "line-through" : "none" }}>
                  {c.type === "income" ? "+" : "-"}
                  {formatCOP(c.amount)}
                </Text>
              </Tap>
            </View>
          );
        })}
        <View style={{ height: 1, backgroundColor: colors.border }} />
        <ListRow
          icon={<PlusIcon size={20} color={colors.muted} />}
          title="Nuevo recurrente"
          chevron={false}
          onPress={() => router.push({ pathname: "/recurrentes", params: { nuevo: "1" } })}
        />
      </Card>
    </View>
  );
}

function Loans({ data }: { data: PlanData }) {
  const { colors } = useTheme();
  const { owedToMe, iOwe, open } = data.loans;
  const summary = [owedToMe > 0 && `Te deben ${formatCOP(owedToMe)}`, iOwe > 0 && `Debes ${formatCOP(iOwe)}`].filter(Boolean).join(" · ");
  return (
    <ListSection title="Préstamos" note={open.length === 0 ? "Anota lo que prestas o te prestan: no cuenta como gasto, pero sí en lo que te queda." : undefined}>
      {open.length === 0 ? (
        <ListRow icon={<HandshakeIcon size={20} color={colors.muted} />} title="Anotar un préstamo" onPress={() => router.push("/prestamos")} />
      ) : (
        [
          <ListRow key="total" icon={<HandshakeIcon size={20} color={colors.muted} />} title={summary} onPress={() => router.push("/prestamos")} />,
          ...open.slice(0, 3).map((l) => (
            <ListRow
              key={l.id}
              title={l.person}
              subtitle={l.direction === "lent" ? "Te debe" : "Le debes"}
              value={formatCOP(l.outstanding)}
              onPress={() => router.push("/prestamos")}
            />
          )),
        ]
      )}
    </ListSection>
  );
}

function Goals({ data }: { data: PlanData }) {
  const { colors } = useTheme();
  const { items, total } = data.goals;
  if (items.length === 0) {
    return (
      <ListSection title="Metas" note="Aparta plata para algo (un viaje, un colchón): sale de lo que te queda sin contar como gasto.">
        <ListRow icon={<PiggyBankIcon size={20} color={colors.muted} />} title="Crear una meta" onPress={() => router.push("/metas")} />
      </ListSection>
    );
  }
  return (
    <ListSection title={`Metas · ${formatCOP(total)} apartados`}>
      {items.map((g) => (
        <Tap key={g.id} accessibilityRole="button" pressScale={0.99} onPress={() => router.push("/metas")} style={{ paddingHorizontal: 16, paddingVertical: 14, gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 12 }}>
            <Text numberOfLines={1} style={{ flex: 1 }}>
              {g.name}
            </Text>
            <Text size={14} tabular tone="muted" numberOfLines={1}>
              {formatCOP(g.saved)}
              {g.target ? ` de ${formatCOP(g.target)}` : ""}
            </Text>
          </View>
          {g.progress !== null && <Progress value={g.progress} label={`${g.name}: ${Math.round(g.progress * 100)} %`} />}
        </Tap>
      ))}
    </ListSection>
  );
}
