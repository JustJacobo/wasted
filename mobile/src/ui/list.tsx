import { CaretRightIcon } from "phosphor-react-native";
import { Children, Fragment, isValidElement } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/theme/theme";
import { Card, Divider } from "./card";
import { Tap } from "./tap";
import { Text } from "./text";

/**
 * Un grupo de filas con título y nota opcionales (Ajustes, Plan, Conexiones).
 * Las filas van en una sola tarjeta, separadas por una línea.
 */
export function ListSection({
  title,
  note,
  action,
  children,
  style,
}: {
  title?: string;
  note?: string;
  /** Algo a la derecha del título ("Administrar"). */
  action?: React.ReactNode;
  /** Sin filas, solo el encabezado. */
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={[{ gap: 8 }, style]}>
      {(title || action) && (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, minHeight: 24 }}>
          {title ? (
            <Text size={14} weight="medium" tone="muted" accessibilityRole="header">
              {title}
            </Text>
          ) : (
            <View />
          )}
          {action}
        </View>
      )}
      {rows.length > 0 && (
        <Card>
          {rows.map((row, i) => (
            <Fragment key={row.key ?? i}>
              {i > 0 && <Divider />}
              {row}
            </Fragment>
          ))}
        </Card>
      )}
      {note && (
        <Text size={12} tone="muted" style={{ paddingHorizontal: 4 }}>
          {note}
        </Text>
      )}
    </View>
  );
}

/**
 * Una fila: ícono, título, subtítulo y algo a la derecha (un valor, un estado o
 * un interruptor). Con `onPress` se puede tocar y lleva la flecha.
 */
export function ListRow({
  icon,
  title,
  subtitle,
  value,
  trailing,
  onPress,
  chevron = !!onPress,
  tone = "foreground",
  accessibilityLabel,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Texto a la derecha (monto o estado). */
  value?: string;
  /** Un elemento a la derecha (interruptor, botón). Reemplaza la flecha. */
  trailing?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  tone?: "foreground" | "danger";
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const content = (
    <>
      {icon && <View style={{ width: 24, alignItems: "center" }}>{icon}</View>}
      <View style={{ flex: 1, minWidth: 0, paddingVertical: 12 }}>
        <Text numberOfLines={2} tone={tone}>
          {title}
        </Text>
        {subtitle && (
          <Text size={13} tone="muted" numberOfLines={2} style={{ marginTop: 1 }}>
            {subtitle}
          </Text>
        )}
      </View>
      {value !== undefined && (
        <Text size={14} tone="muted" tabular numberOfLines={1} style={{ flexShrink: 1, maxWidth: "45%", textAlign: "right" }}>
          {value}
        </Text>
      )}
      {trailing}
      {chevron && !trailing && <CaretRightIcon size={16} color={colors.muted} />}
    </>
  );
  const row = { minHeight: 52, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 } as const;

  if (!onPress) {
    return (
      <View accessibilityLabel={accessibilityLabel} style={row}>
        {content}
      </View>
    );
  }
  return (
    <Tap accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} pressScale={0.99} onPress={onPress} style={row}>
      {content}
    </Tap>
  );
}
