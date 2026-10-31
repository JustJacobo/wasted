import { useState } from "react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { formatDay, formatDayRange, formatMonth, formatShortDay, formatWeekdayLetter } from "@/lib/dates";
import { formatCOP, formatCOPShort } from "@/lib/money";
import { compositionSegments, deltaRatio, nextRange, previousRange, type CategorySlice, type PeriodKind, type Range, type Report } from "@/lib/report";
import { useTheme } from "@/theme/theme";
import { categoryColor } from "@/theme/tokens";
import { CategoryIcon } from "@/ui/category-icon";
import { Tap } from "@/ui/tap";
import { Text } from "@/ui/text";

const percent = new Intl.NumberFormat("es-CO", { style: "percent", maximumFractionDigits: 0 });
const formatShare = (share: number) => (share > 0 && share < 0.01 ? "<1%" : percent.format(share));
const bigSize = (text: string) => (text.length <= 11 ? 56 : text.length <= 14 ? 46 : text.length <= 16 ? 36 : 30);
const tileSize = (text: string) => (text.length <= 11 ? 20 : text.length <= 14 ? 18 : text.length <= 17 ? 16 : 14);

/** Semana o mes, y flechas para ir al periodo anterior o siguiente (period-nav.tsx). */
export function PeriodNav({
  kind,
  range,
  today,
  onChange,
}: {
  kind: PeriodKind;
  range: Range;
  today: string;
  onChange: (kind: PeriodKind, anchor: string) => void;
}) {
  const { colors } = useTheme();
  const isCurrent = range.end >= today;
  const label = kind === "mes" ? formatMonth(range.start) : formatDayRange(range.start, range.end);
  const arrow = (text: string, a11y: string, onPress?: () => void) => (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={a11y}
      disabled={!onPress}
      onPress={onPress}
      style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: onPress ? 1 : 0.2 }}
    >
      <Text size={22}>{text}</Text>
    </Tap>
  );

  return (
    <View style={{ gap: 12 }}>
      <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 4, padding: 4, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
        {(["semana", "mes"] as const).map((k) => (
          <Tap
            key={k}
            accessibilityRole="tab"
            accessibilityState={{ selected: k === kind }}
            onPress={() => onChange(k, today)}
            style={{ flex: 1, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: k === kind ? colors.foreground : "transparent" }}
          >
            <Text size={14} weight="medium" style={{ color: k === kind ? colors.background : colors.muted }}>
              {k === "semana" ? "Semana" : "Mes"}
            </Text>
          </Tap>
        ))}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        {arrow("‹", "Periodo anterior", () => onChange(kind, previousRange(kind, range).start))}
        <View style={{ alignItems: "center" }}>
          <Text weight="semibold" accessibilityRole="header">
            {label}
          </Text>
          {isCurrent && (
            <Text size={12} tone="muted">
              {kind === "semana" ? "Esta semana" : "Este mes"}
            </Text>
          )}
        </View>
        {arrow("›", "Periodo siguiente", isCurrent ? undefined : () => onChange(kind, nextRange(kind, range).start))}
      </View>
    </View>
  );
}

/** Variación frente al periodo anterior: la flecha lleva el color, el texto queda en tinta (delta.tsx). */
export function Delta({ current, previous, upIsGood, periodName }: { current: number; previous: number; upIsGood: boolean; periodName: string }) {
  const ratio = deltaRatio(current, previous);
  if (ratio === null) return <Text size={12} tone="muted">Sin datos {periodName}</Text>;
  if (Math.abs(ratio) < 0.005) return <Text size={12} tone="muted">Igual que {periodName}</Text>;
  const up = ratio > 0;
  const good = up === upIsGood;
  return (
    <Text size={12} tone="muted" accessibilityLabel={`${up ? "Subió" : "Bajó"} ${percent.format(Math.abs(ratio))} vs ${periodName}`}>
      <Text size={12} tone={good ? "accent" : "danger"}>
        {up ? "▲ " : "▼ "}
      </Text>
      <Text size={12}>{Math.abs(ratio) > 9.99 ? "más de 999%" : percent.format(Math.abs(ratio))}</Text> vs {periodName}
    </Text>
  );
}

function Tile({ label, value, wide, children }: { label: string; value: string; wide?: boolean; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ width: wide ? "100%" : "47%", flexGrow: 1, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, gap: 4 }}>
      <Text size={14} tone="muted">
        {label}
      </Text>
      <Text size={tileSize(value)} weight="semibold" tracking={-0.3}>
        {value}
      </Text>
      {children}
    </View>
  );
}

/** Lo gastado como protagonista y, debajo, ingresos, balance y promedio (stat-tiles.tsx). */
export function StatTiles({ report, periodName }: { report: Report; periodName: string }) {
  const balance = report.income - report.expense;
  const spent = formatCOP(report.expense);
  return (
    <View style={{ gap: 24 }}>
      <View style={{ paddingTop: 8, gap: 4 }}>
        <Text size={14} tone="muted">
          Gastaste
        </Text>
        <Text size={bigSize(spent)} weight="semibold" leading={1.1} tracking={-bigSize(spent) * 0.045} numberOfLines={1} adjustsFontSizeToFit>
          {spent}
        </Text>
        <Delta current={report.expense} previous={report.previousExpense} upIsGood={false} periodName={periodName} />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 20 }}>
        <Tile label="Ingresos" value={formatCOP(report.income)}>
          <Delta current={report.income} previous={report.previousIncome} upIsGood periodName={periodName} />
        </Tile>
        <Tile label="Balance" value={`${balance < 0 ? "-" : "+"}${formatCOP(Math.abs(balance))}`}>
          <Text size={12} tone="muted">
            {balance >= 0 ? "Ahorraste la diferencia" : "Gastaste más de lo que entró"}
          </Text>
        </Tile>
        <Tile label="Promedio diario" value={formatCOP(report.dailyAverage)} wide>
          <Text size={12} tone="muted">
            de gasto en los días transcurridos
          </Text>
        </Tile>
      </View>
    </View>
  );
}

const CHART_HEIGHT = 144;

/** Columnas de gasto por día en un solo tono, con la línea del promedio; tocar un día muestra su valor (daily-chart.tsx). */
export function DailyChart({ kind, days, dailyAverage, today }: { kind: PeriodKind; days: Report["days"]; dailyAverage: number; today: string }) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const max = Math.max(...days.map((d) => d.expense), dailyAverage, 1);
  const peak = days.reduce((a, b) => (b.expense > a.expense ? b : a), days[0]);
  const shown = days.find((d) => d.day === selected) ?? null;
  const isMonth = kind === "mes";
  const gap = isMonth ? 2 : 8;

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 20 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <Text weight="semibold">Gasto por día</Text>
        <Text size={14} numberOfLines={1} accessibilityLiveRegion="polite" style={{ flexShrink: 1 }}>
          {shown ? (
            <>
              <Text size={14} tone="muted">{`${formatDay(shown.day, today)} · `}</Text>
              <Text size={14} weight="medium">{formatCOP(shown.expense)}</Text>
            </>
          ) : peak.expense > 0 ? (
            <>
              <Text size={14} tone="muted">{`Día más alto: ${formatShortDay(peak.day)} · `}</Text>
              <Text size={14} weight="medium">{formatCOP(peak.expense)}</Text>
            </>
          ) : (
            <Text size={14} tone="muted">Sin gastos</Text>
          )}
        </Text>
      </View>

      <View style={{ height: CHART_HEIGHT, marginTop: 16 }}>
        {dailyAverage > 0 && (
          <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: (dailyAverage / max) * CHART_HEIGHT, borderTopWidth: 1, borderTopColor: colors.muted, opacity: 0.6 }}>
            <Text size={11} tone="muted" tabular style={{ position: "absolute", right: 0, bottom: 2, backgroundColor: colors.background, paddingHorizontal: 4 }}>
              Prom. {formatCOPShort(dailyAverage)}
            </Text>
          </View>
        )}
        <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-end", gap }}>
          {days.map((d) => {
            const future = d.day > today;
            const active = selected === d.day;
            const dim = selected !== null && !active;
            return (
              <Tap
                key={d.day}
                pressScale={1}
                disabled={future}
                accessibilityRole="button"
                accessibilityLabel={`${formatDay(d.day, today)}: ${formatCOP(d.expense)}`}
                accessibilityState={{ selected: active }}
                onPress={() => setSelected(active ? null : d.day)}
                style={{ flex: 1, height: "100%", justifyContent: "flex-end", alignItems: "center" }}
              >
                {d.expense > 0 ? (
                  <View
                    style={{
                      width: "100%",
                      maxWidth: 24,
                      height: Math.max((d.expense / max) * CHART_HEIGHT, 3),
                      backgroundColor: colors.viz,
                      borderTopLeftRadius: 4,
                      borderTopRightRadius: 4,
                      opacity: dim ? 0.35 : 1,
                    }}
                  />
                ) : (
                  <View style={{ width: "100%", maxWidth: 24, height: 1, backgroundColor: colors.border, opacity: future ? 0.5 : 1 }} />
                )}
              </Tap>
            );
          })}
        </View>
      </View>
      <View style={{ flexDirection: "row", gap, marginTop: 8 }} importantForAccessibility="no-hide-descendants">
        {days.map((d) => {
          const n = Number(d.day.slice(8));
          const label = isMonth ? (n === 1 || n % 7 === 1 ? String(n) : "") : formatWeekdayLetter(d.day);
          return (
            <Text key={d.day} size={11} tabular align="center" weight={d.day === today ? "semibold" : "regular"} tone={d.day === today ? "foreground" : "muted"} style={{ flex: 1 }}>
              {label}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

const RADIUS = 48;
const STROKE = 16;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 0.006;

/** Cómo se reparte el gasto: anillo con las categorías más grandes y el resto en gris (category-donut.tsx). */
export function CategoryDonut({ slices }: { slices: CategorySlice[] }) {
  const { colors } = useTheme();
  const segments = compositionSegments(slices);
  const total = segments.reduce((sum, s) => sum + s.amount, 0);
  const [selected, setSelected] = useState<string | null>(null);
  const shown = segments.find((s) => s.key === selected) ?? null;
  const toggle = (key: string) => setSelected((current) => (current === key ? null : key));
  const single = segments.length === 1;
  // Dónde empieza cada tramo de la dona: la suma de los anteriores.
  const starts = segments.map((_, i) => segments.slice(0, i).reduce((sum, s) => sum + s.share, 0));

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 20 }}>
      <Text weight="semibold">Cómo se reparte</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 20, marginTop: 16 }}>
        <View style={{ width: 144, height: 144 }} accessibilityLabel={segments.map((s) => `${s.label} ${formatShare(s.share)}`).join(", ")}>
          <Svg width={144} height={144} viewBox="0 0 120 120" style={{ transform: [{ rotate: "-90deg" }] }}>
            {segments.map((s, i) => {
              const length = Math.max(s.share - GAP, 0.003) * CIRCUMFERENCE;
              const offset = -starts[i] * CIRCUMFERENCE;
              return (
                <Circle
                  key={s.key}
                  cx={60}
                  cy={60}
                  r={RADIUS}
                  fill="none"
                  stroke={categoryColor(colors, s.color)}
                  strokeWidth={STROKE}
                  strokeDasharray={single ? undefined : `${length} ${CIRCUMFERENCE - length}`}
                  strokeDashoffset={offset}
                  opacity={selected && selected !== s.key ? 0.25 : 1}
                  onPress={() => toggle(s.key)}
                />
              );
            })}
          </Svg>
          <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
            <Text size={12} tone="muted" numberOfLines={1}>
              {shown ? shown.label : "Total"}
            </Text>
            <Text size={14} weight="semibold" tabular numberOfLines={1} adjustsFontSizeToFit>
              {formatCOP(shown ? shown.amount : total)}
            </Text>
            {shown && (
              <Text size={12} tone="muted" tabular>
                {formatShare(shown.share)}
              </Text>
            )}
          </View>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          {segments.map((s) => (
            <Tap
              key={s.key}
              accessibilityRole="button"
              accessibilityState={{ selected: selected === s.key }}
              onPress={() => toggle(s.key)}
              style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 36, opacity: selected && selected !== s.key ? 0.4 : 1 }}
            >
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: categoryColor(colors, s.color) }} />
              <Text size={14} numberOfLines={1} style={{ flex: 1 }}>
                {s.label}
              </Text>
              <Text size={14} tone="muted" tabular>
                {formatShare(s.share)}
              </Text>
            </Tap>
          ))}
        </View>
      </View>
    </View>
  );
}

/** Gasto por categoría en barras horizontales con su color, valor, peso y variación (category-bars.tsx). */
export function CategoryBars({ slices, periodName, onCategory }: { slices: CategorySlice[]; periodName: string; onCategory?: (id: string) => void }) {
  const { colors } = useTheme();
  const max = slices[0]?.amount ?? 1;
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 20 }}>
      <Text weight="semibold">Gasto por categoría</Text>
      <View style={{ marginTop: 16, gap: 16 }}>
        {slices.map((s) => {
          const color = categoryColor(colors, s.category?.color);
          const category = s.category;
          return (
            <Tap
              key={category?.id ?? "sin-categoria"}
              pressScale={0.99}
              disabled={!category || !onCategory}
              accessibilityRole={category && onCategory ? "button" : "text"}
              onPress={() => category && onCategory?.(category.id)}
              style={{ gap: 6, opacity: 1 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                  <CategoryIcon category={category} size={16} color={color} />
                  <Text numberOfLines={1} style={{ flexShrink: 1 }}>
                    {category?.name ?? "Sin categoría"}
                  </Text>
                </View>
                <Text weight="medium" tabular>
                  {formatCOP(s.amount)}
                </Text>
              </View>
              <View style={{ height: 8, backgroundColor: colors.border }}>
                <View style={{ height: "100%", width: `${Math.max((s.amount / max) * 100, 2)}%`, backgroundColor: color, borderTopRightRadius: 4, borderBottomRightRadius: 4 }} />
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <Text size={12} tone="muted" tabular>
                  {formatShare(s.share)} del gasto
                </Text>
                <Delta current={s.amount} previous={s.previous} upIsGood={false} periodName={periodName} />
              </View>
            </Tap>
          );
        })}
      </View>
    </View>
  );
}
