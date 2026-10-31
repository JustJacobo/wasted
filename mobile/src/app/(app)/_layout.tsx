import { useQuery } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { api, ApiError } from "@/core/api";
import { signOut } from "@/core/auth";
import { connectDevice } from "@/core/device";
import type { Me } from "@/core/types";
import { useTheme } from "@/theme/theme";
import { Button } from "@/ui/button";
import { Text } from "@/ui/text";

// Un enlace wasted://… o un acceso directo que abre otra pantalla deja el inicio
// debajo: Atrás vuelve al inicio en vez de cerrar la app.
export const unstable_settings = { anchor: "index" };

/** Todo lo que pide sesión. Solo entran correos invitados (tabla members). */
export default function AppLayout() {
  const { colors } = useTheme();
  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("me"), staleTime: Infinity });
  const userId = me.data?.userId;

  // El widget, el registro rápido y las notificaciones quedan con la cuenta que entró.
  useEffect(() => {
    if (userId) connectDevice(userId).catch(() => {});
  }, [userId]);

  if (me.isPending) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.foreground} />
      </View>
    );
  }
  if (me.error) {
    const notInvited = me.error instanceof ApiError && me.error.status === 403;
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 16, backgroundColor: colors.background }}>
        <Text align="center">{notInvited ? "Tu correo no tiene una invitación a Wasted." : me.error.message}</Text>
        {notInvited ? (
          <Button label="Usar otra cuenta" onPress={() => signOut()} />
        ) : (
          <Button label="Intentar de nuevo" onPress={() => me.refetch()} />
        )}
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      {/* La ventana de registro es una hoja nativa: se arrastra para cerrar y Atrás la cierra. */}
      <Stack.Screen
        name="registrar"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.92],
          sheetGrabberVisible: true,
          sheetCornerRadius: 24,
          contentStyle: { backgroundColor: colors.surface },
        }}
      />
    </Stack>
  );
}
