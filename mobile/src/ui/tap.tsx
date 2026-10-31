import * as Haptics from "expo-haptics";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface TapProps extends Omit<PressableProps, "style"> {
  style?: StyleProp<ViewStyle>;
  /** Cuánto se encoge al presionar (0.97 en botones, 0.99 en filas grandes). */
  pressScale?: number;
  /** Vibración corta al tocar (acciones que guardan o cambian algo). */
  haptic?: boolean;
}

const ease = Easing.out(Easing.quad);

/**
 * Todo lo tocable: responde al apoyar el dedo (no al soltar), como un botón
 * nativo. La escala vuelve sola si se arrastra fuera.
 */
export function Tap({ style, pressScale = 0.97, haptic, onPressIn, onPressOut, onPress, disabled, ...props }: TapProps) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      accessibilityState={{ ...props.accessibilityState, disabled: !!disabled }}
      onPressIn={(e) => {
        scale.set(withTiming(pressScale, { duration: 100, easing: ease }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withTiming(1, { duration: 160, easing: ease }));
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic) Haptics.selectionAsync().catch(() => {});
        onPress?.(e);
      }}
      style={[style, animated, disabled ? { opacity: 0.5 } : null]}
    />
  );
}
