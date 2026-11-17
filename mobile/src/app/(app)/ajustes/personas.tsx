import { useState } from "react";
import { View } from "react-native";
import { useAction } from "@/core/use-action";
import { Section, useSettings } from "@/features/settings/shared";
import { Button } from "@/ui/button";
import { Card, Divider } from "@/ui/card";
import { confirmAction } from "@/ui/confirm";
import { Field, Notice } from "@/ui/fields";
import { Screen } from "@/ui/screen";
import { Tap } from "@/ui/tap";
import { Text } from "@/ui/text";

/** Quién puede entrar a Wasted (solo el dueño invita y quita; antes en Ajustes). */
export default function PeopleScreen() {
  const query = useSettings();
  const action = useAction();
  const [invite, setInvite] = useState("");
  const data = query.data;

  return (
    <Screen title="Personas con acceso" loading={!data && !query.error} error={query.error?.message} refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      {data && (
        <View style={{ gap: 24 }}>
          {action.notice && <Notice text={action.notice.text} error={action.notice.error} />}
          {data.role !== "owner" ? (
            <Text size={14} tone="muted">
              Solo el dueño de la cuenta puede invitar o quitar personas.
            </Text>
          ) : (
            <Section title="Personas" note="Cada persona ve solo sus propios movimientos. Comparte la app y pídele que entre con el correo que agregaste.">
              <Card>
                {data.members.map((m, i) => (
                  <View key={m.email}>
                    {i > 0 && <Divider />}
                    <View style={{ minHeight: 52, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <Text numberOfLines={1} style={{ flex: 1 }}>
                        {m.email}
                      </Text>
                      {m.role === "owner" ? (
                        <Text size={12} tone="muted">
                          Dueño
                        </Text>
                      ) : (
                        <Tap
                          accessibilityRole="button"
                          accessibilityLabel={`Quitar a ${m.email}`}
                          onPress={() => confirmAction(`¿Quitar el acceso de ${m.email}?`, "Sus datos no se borran.", "Quitar", () => action.run("removeMember", { email: m.email }))}
                          style={{ minHeight: 44, justifyContent: "center" }}
                        >
                          <Text size={14} tone="danger">
                            Quitar
                          </Text>
                        </Tap>
                      )}
                    </View>
                  </View>
                ))}
              </Card>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Field value={invite} onChangeText={setInvite} placeholder="correo@ejemplo.com" keyboardType="email-address" autoCapitalize="none" accessibilityLabel="Correo a invitar" style={{ flex: 1 }} />
                <Button label="Invitar" variant="primary" height={48} disabled={!invite.includes("@") || action.pending} onPress={() => action.run("inviteMember", { email: invite }, () => setInvite(""))} />
              </View>
            </Section>
          )}
        </View>
      )}
    </Screen>
  );
}
