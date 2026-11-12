import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, View } from "react-native";
import { formatDay } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import type { BalanceMove, LoanSummary } from "@/lib/money-moves";
import { api } from "@/core/api";
import { useAction } from "@/core/use-action";
import { useTheme } from "@/theme/theme";
import { Button } from "@/ui/button";
import { Card, Divider } from "@/ui/card";
import { AmountField, Field, Notice, useAmount } from "@/ui/fields";
import { Screen } from "@/ui/screen";
import { Tap } from "@/ui/tap";
import { Text } from "@/ui/text";

interface LoansData {
  today: string;
  items: LoanSummary[];
  owedToMe: number;
  iOwe: number;
}

const moveLabel = (direction: "lent" | "borrowed", amount: number) =>
  direction === "lent" ? (amount < 0 ? "Le prestaste" : "Te pagó") : amount > 0 ? "Te prestó" : "Le pagaste";

/** Quién te debe y a quién le debes, con pagos parciales e historial (src/app/prestamos/). */
export default function LoansScreen() {
  const query = useQuery({ queryKey: ["loans"], queryFn: () => api<LoansData>("loans") });
  const action = useAction();
  const [creating, setCreating] = useState<"lend" | "borrow" | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const data = query.data;

  return (
    <Screen title="Préstamos" loading={!data && !query.error} error={query.error?.message} refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      {data && (
        <>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[
              ["Te deben", data.owedToMe],
              ["Debes", data.iOwe],
            ].map(([label, value]) => (
              <Card key={label as string} style={{ flex: 1, padding: 16 }}>
                <Text size={14} tone="muted">
                  {label}
                </Text>
                <Text size={24} weight="semibold" tabular tracking={-0.6} numberOfLines={1} adjustsFontSizeToFit>
                  {formatCOP(value as number)}
                </Text>
              </Card>
            ))}
          </View>

          {action.notice && <Notice text={action.notice.text} error={action.notice.error} />}

          {creating ? (
            <NewLoan
              kind={creating}
              people={[...new Set(data.items.map((i) => i.loan.person))]}
              pending={action.pending}
              onCancel={() => setCreating(null)}
              onSubmit={(person, amount) => action.run("addLoan", { kind: creating, person, amount }, () => setCreating(null))}
            />
          ) : (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button label="Presté" style={{ flex: 1 }} onPress={() => setCreating("lend")} />
              <Button label="Me prestaron" style={{ flex: 1 }} onPress={() => setCreating("borrow")} />
            </View>
          )}

          <LoanList
            items={data.items.filter((i) => i.outstanding > 0)}
            empty="Nadie te debe y no le debes a nadie."
            open={open}
            onOpen={setOpen}
            today={data.today}
            action={action}
          />
          {data.items.some((i) => i.outstanding <= 0) && (
            <View style={{ gap: 8 }}>
              <Text size={14} tone="muted" style={{ paddingHorizontal: 4 }}>
                Saldados
              </Text>
              <LoanList items={data.items.filter((i) => i.outstanding <= 0).slice(0, 20)} open={open} onOpen={setOpen} today={data.today} action={action} />
            </View>
          )}
          <Text size={12} tone="muted">
            Prestar baja lo que te queda y que te paguen lo sube, sin contar como gasto ni ingreso. También puedes escribirlo en Telegram o en el modo ⌨: “le presté 20k a Juan”, “Juan me pagó 20k”.
          </Text>
        </>
      )}
    </Screen>
  );
}

function LoanList({
  items,
  empty,
  open,
  onOpen,
  today,
  action,
}: {
  items: LoanSummary[];
  empty?: string;
  open: string | null;
  onOpen: (id: string | null) => void;
  today: string;
  action: ReturnType<typeof useAction>;
}) {
  if (items.length === 0) {
    return empty ? (
      <Card style={{ paddingVertical: 32, paddingHorizontal: 20 }}>
        <Text size={14} tone="muted" align="center">
          {empty}
        </Text>
      </Card>
    ) : null;
  }
  return (
    <Card>
      {items.map((item, i) => {
        const { loan } = item;
        const isOpen = open === loan.id;
        return (
          <View key={loan.id}>
            {i > 0 && <Divider />}
            <Tap
              pressScale={0.99}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              onPress={() => onOpen(isOpen ? null : loan.id)}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={2}>{loan.person}</Text>
                <Text size={12} tone="muted" numberOfLines={1}>
                  {item.outstanding > 0 ? (loan.direction === "lent" ? "Te debe" : "Le debes") : "Saldado"}
                  {item.moves[0] ? ` · ${formatDay(item.moves[0].occurred_on, today)}` : ""}
                </Text>
              </View>
              <Text mono size={15} tone={item.outstanding > 0 ? "foreground" : "muted"}>
                {formatCOP(Math.max(0, item.outstanding))}
              </Text>
            </Tap>
            {isOpen && <LoanDetail key={item.outstanding} item={item} today={today} action={action} onDeleted={() => onOpen(null)} />}
          </View>
        );
      })}
    </Card>
  );
}

function LoanDetail({ item, today, action, onDeleted }: { item: LoanSummary; today: string; action: ReturnType<typeof useAction>; onDeleted: () => void }) {
  const { colors } = useTheme();
  const { loan } = item;
  const amount = useAmount(Math.max(0, item.outstanding));

  const removeMove = (move: BalanceMove) =>
    Alert.alert(`¿Quitar “${moveLabel(loan.direction, move.amount)} ${formatCOP(Math.abs(move.amount))}”?`, undefined, [
      { text: "Cancelar", style: "cancel" },
      { text: "Quitar", style: "destructive", onPress: () => action.run("removeLoanMove", { id: move.id }) },
    ]);
  const remove = () =>
    Alert.alert(`¿Borrar el préstamo con ${loan.person}?`, "Deja de contar en tu saldo.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Borrar", style: "destructive", onPress: () => action.run("deleteLoan", { id: loan.id }, onDeleted) },
    ]);

  return (
    <View style={{ gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background }}>
      {item.outstanding > 0 && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <AmountField amount={amount} accessibilityLabel="Monto del pago" style={{ flex: 1 }} />
          <Button
            label={loan.direction === "lent" ? "Me pagó" : "Le pagué"}
            variant="primary"
            height={48}
            disabled={!amount.value || action.pending}
            onPress={() => action.run("payLoan", { loanId: loan.id, amount: amount.value })}
          />
        </View>
      )}
      {item.moves.map((move) => (
        <View key={move.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text size={14} tone="muted" numberOfLines={1} style={{ flex: 1 }}>
            {formatDay(move.occurred_on, today)} · {moveLabel(loan.direction, move.amount)}
          </Text>
          <Text size={14} tabular>
            {formatCOP(Math.abs(move.amount))}
          </Text>
          <Tap accessibilityRole="button" accessibilityLabel="Quitar este movimiento" onPress={() => removeMove(move)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <Text tone="muted">×</Text>
          </Tap>
        </View>
      ))}
      <Button label="Borrar préstamo" variant="danger" onPress={remove} />
    </View>
  );
}

function NewLoan({
  kind,
  people,
  pending,
  onSubmit,
  onCancel,
}: {
  kind: "lend" | "borrow";
  people: string[];
  pending: boolean;
  onSubmit: (person: string, amount: number) => void;
  onCancel: () => void;
}) {
  const [person, setPerson] = useState("");
  const amount = useAmount();
  const suggestions = person.trim() ? people.filter((p) => p.toLowerCase().startsWith(person.trim().toLowerCase()) && p !== person).slice(0, 3) : [];
  const ready = person.trim() !== "" && amount.value > 0;

  return (
    <Card style={{ padding: 12, gap: 12 }}>
      <Text size={14} weight="medium">
        {kind === "lend" ? "¿A quién le prestaste?" : "¿Quién te prestó?"}
      </Text>
      <Field autoFocus value={person} onChangeText={setPerson} placeholder="Nombre" maxLength={60} accessibilityLabel="Nombre" />
      {suggestions.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {suggestions.map((p) => (
            <Button key={p} label={p} height={36} onPress={() => setPerson(p)} />
          ))}
        </View>
      )}
      <AmountField amount={amount} accessibilityLabel="Monto" />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button label="Cancelar" style={{ flex: 1 }} onPress={onCancel} />
        <Button label="Guardar" variant="primary" style={{ flex: 1 }} disabled={!ready || pending} onPress={() => onSubmit(person.trim(), amount.value)} />
      </View>
    </Card>
  );
}
