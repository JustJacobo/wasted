import { View } from "react-native";
import { balance, budgetStatus } from "@/lib/budget";
import { formatCOP } from "@/lib/money";
import type { Summary, WeekBudget } from "@/lib/types";
import { weekPlan, weekPlanMessage, type UpcomingCharge } from "@/lib/week-plan";
import { Text } from "@/ui/text";
import { BudgetMeter } from "./meter";

/** El tamaño de la cifra según su largo: se achica en vez de cortarse (como sizeForLength en la web). */
const heroSize = (text: string) => (text.length <= 11 ? 56 : text.length <= 14 ? 46 : 36);

/** "Te quedan", lo que se puede gastar por día y la semana (src/app/summary-card.tsx). */
export function SummaryCard({ summary, upcoming, today }: { summary: Summary; upcoming: UpcomingCharge[]; today: string }) {
  const week: WeekBudget = { ...summary.week, carry: summary.carry };
  const hasBudget = budgetStatus(week).level !== "none";
  const left = balance(week);
  const hero = formatCOP(hasBudget ? left : week.expense);
  const plan = weekPlan(week, today, upcoming);
  const planMessage = weekPlanMessage(plan, today);

  return (
    <View style={{ marginTop: 20 }}>
      <Text size={14} tone="muted">
        {hasBudget ? "Te quedan" : "Gastaste esta semana"}
      </Text>
      <Text
        tabular
        weight="semibold"
        size={heroSize(hero)}
        leading={1.1}
        tracking={-heroSize(hero) * 0.045}
        tone={hasBudget && left < 0 ? "danger" : "foreground"}
        adjustsFontSizeToFit
        numberOfLines={1}
        style={{ marginTop: 4 }}
        accessibilityLabel={`${hasBudget ? "Te quedan" : "Gastaste esta semana"} ${hero}`}
      >
        {hero}
      </Text>
      {planMessage && (
        <Text size={14} tabular style={{ marginTop: 4 }}>
          {planMessage}
          {plan.committed > 0 && plan.free > 0 && <Text size={14} tone="muted">{` · ${formatCOP(plan.committed)} reservados para cobros`}</Text>}
        </Text>
      )}
      <Text size={14} tone="muted" tabular style={{ marginTop: 8 }}>
        Esta semana entró <Text size={14}>{formatCOP(week.income)}</Text> · salió <Text size={14}>{formatCOP(week.expense)}</Text>
      </Text>
      {week.moved !== 0 && (
        <Text size={14} tone="muted" tabular style={{ marginTop: 2 }}>
          Préstamos y metas{" "}
          <Text size={14}>
            {week.moved < 0 ? "-" : "+"}
            {formatCOP(Math.abs(week.moved))}
          </Text>
        </Text>
      )}
      {summary.carry !== 0 && (
        <Text size={14} tone="muted" tabular style={{ marginTop: 2 }}>
          Saldo anterior <Text size={14}>{formatCOP(summary.carry)}</Text>
        </Text>
      )}
      <BudgetMeter week={week} />
    </View>
  );
}
