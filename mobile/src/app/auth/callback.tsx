import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { completeLogin } from "@/core/auth";
import { AUTH_REDIRECT } from "@/core/config";
import { useTheme } from "@/theme/theme";
import { Button } from "@/ui/button";
import { Text } from "@/ui/text";

/** wasted://auth/callback?code=…: el enlace mágico del correo vuelve aquí. */
export default function AuthCallback() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(AUTH_REDIRECT);
    if (params.code) url.searchParams.set("code", params.code);
    if (params.error_description) url.searchParams.set("error_description", params.error_description);
    completeLogin(url.toString()).then((failure) => {
      if (failure) setError(failure);
      else router.replace("/");
    });
  }, [params.code, params.error_description]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16, backgroundColor: colors.background }}>
      {error ? (
        <>
          <Text align="center">{error}</Text>
          <Button label="Volver" onPress={() => router.replace("/login")} />
        </>
      ) : (
        <ActivityIndicator color={colors.foreground} />
      )}
    </View>
  );
}
