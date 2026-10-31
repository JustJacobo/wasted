import { useState } from "react";
import { KeyboardAvoidingView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { sendMagicLink, signInWithGoogle } from "@/core/auth";
import { useTheme } from "@/theme/theme";
import { FONTS } from "@/theme/tokens";
import { Button } from "@/ui/button";
import { Text } from "@/ui/text";

/** Entrar con Google (pestaña del sistema) o con un enlace al correo. */
export default function LoginScreen() {
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"google" | "email" | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  async function google() {
    setBusy("google");
    setMessage(null);
    const error = await signInWithGoogle();
    setBusy(null);
    if (error) setMessage({ text: error, error: true });
  }

  async function magicLink() {
    if (!email.includes("@")) {
      setMessage({ text: "Escribe tu correo.", error: true });
      return;
    }
    setBusy("email");
    setMessage(null);
    const error = await sendMagicLink(email);
    setBusy(null);
    setMessage(
      error
        ? { text: error, error: true }
        : { text: `Te enviamos un enlace a ${email.trim()}. Ábrelo en este teléfono para entrar.`, error: false },
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: "center", padding: 24, gap: 24 }}>
        <View style={{ gap: 6 }}>
          <Text size={34} weight="bold" tracking={-1}>
            Wasted
          </Text>
          <Text tone="muted">Registra un gasto en segundos y mira cuánto te queda.</Text>
        </View>

        <Button label="Entrar con Google" variant="primary" height={52} loading={busy === "google"} onPress={google} />

        <View style={{ gap: 10 }}>
          <Text size={14} tone="muted">
            O recibe un enlace en tu correo
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="tu@correo.com"
            placeholderTextColor={colors.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={magicLink}
            accessibilityLabel="Correo"
            style={{
              height: 52,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              paddingHorizontal: 16,
              color: colors.foreground,
              fontFamily: FONTS.regular,
              fontSize: 16,
            }}
          />
          <Button label="Enviar enlace" height={52} loading={busy === "email"} onPress={magicLink} />
        </View>

        {message && (
          <Text accessibilityLiveRegion="polite" size={14} tone={message.error ? "danger" : "foreground"}>
            {message.text}
          </Text>
        )}
        <Text size={12} tone="muted">
          Para entrar hace falta una invitación de quien administra Wasted.
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
