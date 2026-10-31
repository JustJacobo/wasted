import { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, ReduceMotion } from "react-native-reanimated";
import { budgetMessage, budgetStatus } from "@/lib/budget";
import type { WeekBudget } from "@/lib/types";
import { useTheme } from "@/theme/theme";
import { Text } from "@/ui/text";

const DOT = 12;

/**
 * La mecha: lo que queda de lo disponible en la semana. La línea se acorta al
 * gastar y termina en un punto; al 80% pasa a ámbar. El texto dice lo mismo sin
 * depender del color (igual que src/app/budget-meter.tsx).
 */
export function BudgetMeter({ week }: { week: WeekBudget }) {
  const { colors } = useTheme();
  const status = budgetStatus(week);
  const message = budgetMessage(status, week);
  const [width, setWidth] = useState(0);
  const left = Math.max(0, 1 - status.ratio);
  const progress = useSharedValue(left);

  useEffect(() => {
    progress.set(withTiming(left, { duration: 500, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }));
  }, [left, progress]);

  const track = Math.max(0, width - DOT);
  const line = useAnimatedStyle(() => ({ width: track * progress.get() }));
  const dot = useAnimatedStyle(() => ({ transform: [{ translateX: track * progress.get() }] }));

  if (!message) return null;
  const { level } = status;
  const lineColor = level === "warning" ? colors.vizWarn : colors.foreground;
  const dotColor = level === "over" ? colors.vizOver : level === "warning" ? colors.vizWarn : colors.accent;

  return (
    <View style={{ marginTop: 20 }}>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Lo que te queda de lo disponible esta semana"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(left * 100) }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{ height: DOT, justifyContent: "center" }}
      >
        <View style={{ position: "absolute", left: DOT / 2, right: DOT / 2, height: 1, backgroundColor: colors.border }} />
        <Animated.View style={[{ position: "absolute", left: DOT / 2, height: 6, backgroundColor: lineColor }, line]} />
        <Animated.View
          style={[{ position: "absolute", left: 0, width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: dotColor }, dot]}
        />
      </View>
      <Text size={14} tone={level === "ok" ? "muted" : "foreground"} style={{ marginTop: 8 }}>
        {message}
      </Text>
    </View>
  );
}
