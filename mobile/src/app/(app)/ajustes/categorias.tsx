import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import { CATEGORY_COLOR_KEYS, CATEGORY_COLORS, nextCategoryColor } from "@/lib/category-colors";
import { CATEGORY_ICON_KEYS, CATEGORY_ICONS, isCategoryIcon } from "@/lib/category-icons";
import type { Category, TxType } from "@/lib/types";
import { api } from "@/core/api";
import { useAction } from "@/core/use-action";
import { TypeSwitch } from "@/features/add/amount-step";
import { useTheme } from "@/theme/theme";
import { categoryColor } from "@/theme/tokens";
import { Button } from "@/ui/button";
import { Card, Divider } from "@/ui/card";
import { CategoryIcon } from "@/ui/category-icon";
import { Field, Notice } from "@/ui/fields";
import { Screen } from "@/ui/screen";
import { Tap } from "@/ui/tap";
import { Text } from "@/ui/text";

/** Crear, editar, ordenar y archivar categorías (src/app/ajustes/categorias/). */
export default function CategoriesScreen() {
  const { colors } = useTheme();
  const query = useQuery({ queryKey: ["categories"], queryFn: () => api<Category[]>("categories") });
  const action = useAction();
  const [type, setType] = useState<TxType>("expense");
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const all = query.data ?? [];
  const list = all.filter((c) => c.type === type && !c.archived);
  const archived = all.filter((c) => c.type === type && c.archived);

  return (
    <Screen title="Categorías" back="← Ajustes" loading={!query.data && !query.error} error={query.error?.message} refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <TypeSwitch
        type={type}
        onType={(t) => {
          setType(t);
          setEditing(null);
        }}
      />
      {action.notice && <Notice text={action.notice.text} error={action.notice.error} />}

      <Card>
        {list.map((c, i) => (
          <View key={c.id}>
            {i > 0 && <Divider />}
            {editing === c.id ? (
              <CategoryForm
                initial={c}
                pending={action.pending}
                onCancel={() => setEditing(null)}
                onSubmit={(fields) => action.run("updateCategory", { id: c.id, ...fields }, () => setEditing(null))}
                onArchive={() => action.run("setArchived", { id: c.id, archived: true }, () => setEditing(null))}
              />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", paddingLeft: 16 }}>
                <CategoryIcon category={c} color={categoryColor(colors, c.color)} />
                <Tap accessibilityRole="button" accessibilityLabel={`Editar ${c.name}`} onPress={() => setEditing(c.id)} style={{ flex: 1, minHeight: 52, justifyContent: "center", paddingHorizontal: 12 }}>
                  <Text numberOfLines={1}>{c.name}</Text>
                </Tap>
                <Tap accessibilityRole="button" accessibilityLabel={`Subir ${c.name}`} disabled={i === 0} onPress={() => action.run("moveCategory", { id: c.id, direction: "up" })} style={{ width: 44, height: 52, alignItems: "center", justifyContent: "center" }}>
                  <Text tone="muted">↑</Text>
                </Tap>
                <Tap accessibilityRole="button" accessibilityLabel={`Bajar ${c.name}`} disabled={i === list.length - 1} onPress={() => action.run("moveCategory", { id: c.id, direction: "down" })} style={{ width: 44, height: 52, alignItems: "center", justifyContent: "center" }}>
                  <Text tone="muted">↓</Text>
                </Tap>
              </View>
            )}
          </View>
        ))}
      </Card>

      {editing === "new" ? (
        <Card>
          <CategoryForm
            initial={{ name: "", icon: null, color: nextCategoryColor(list.map((c) => c.color)) }}
            pending={action.pending}
            onCancel={() => setEditing(null)}
            onSubmit={(fields) => action.run("createCategory", { type, ...fields }, () => setEditing(null))}
          />
        </Card>
      ) : (
        <Button label="Nueva categoría" onPress={() => setEditing("new")} />
      )}

      {archived.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text size={14} tone="muted" style={{ paddingHorizontal: 4 }}>
            Archivadas (siguen nombrando movimientos pasados)
          </Text>
          <Card>
            {archived.map((c, i) => (
              <View key={c.id}>
                {i > 0 && <Divider />}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingLeft: 16 }}>
                  <CategoryIcon category={c} color={colors.muted} />
                  <Text tone="muted" numberOfLines={1} style={{ flex: 1 }}>
                    {c.name}
                  </Text>
                  <Tap accessibilityRole="button" onPress={() => action.run("setArchived", { id: c.id, archived: false })} style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: 16 }}>
                    <Text size={14}>Restaurar</Text>
                  </Tap>
                </View>
              </View>
            ))}
          </Card>
        </View>
      )}
    </Screen>
  );
}

function CategoryForm({
  initial,
  pending,
  onSubmit,
  onCancel,
  onArchive,
}: {
  initial: Pick<Category, "name" | "icon" | "color">;
  pending: boolean;
  onSubmit: (fields: { name: string; icon: string; color: string | null }) => void;
  onCancel: () => void;
  onArchive?: () => void;
}) {
  const { colors } = useTheme();
  const [name, setName] = useState(initial.name);
  const [icon, setIcon] = useState<string | null>(isCategoryIcon(initial.icon) ? initial.icon : null);
  const [color, setColor] = useState<string | null>(initial.color);

  return (
    <View style={{ padding: 12, gap: 12 }}>
      <Field autoFocus={!initial.name} value={name} onChangeText={setName} maxLength={30} placeholder="Nombre de la categoría" accessibilityLabel="Nombre" />
      <View accessibilityRole="radiogroup" accessibilityLabel="Ícono" style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
        {CATEGORY_ICON_KEYS.map((key) => {
          const active = icon === key;
          return (
            <Tap
              key={key}
              accessibilityRole="radio"
              accessibilityLabel={CATEGORY_ICONS[key].label}
              accessibilityState={{ selected: active }}
              onPress={() => setIcon(key)}
              style={{ width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: active ? colors.foreground : "transparent" }}
            >
              <CategoryIcon category={{ icon: key, emoji: "" }} size={22} color={active ? colors.background : categoryColor(colors, color)} />
            </Tap>
          );
        })}
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel="Color en el dashboard" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {[null, ...CATEGORY_COLOR_KEYS].map((key) => {
          const active = color === key;
          return (
            <Tap
              key={key ?? "gris"}
              accessibilityRole="radio"
              accessibilityLabel={key ? CATEGORY_COLORS[key] : "Gris"}
              accessibilityState={{ selected: active }}
              onPress={() => setColor(key)}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: categoryColor(colors, key), borderWidth: active ? 3 : 0, borderColor: colors.foreground }}
            />
          );
        })}
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button label="Cancelar" style={{ flex: 1 }} onPress={onCancel} />
        <Button label="Guardar" variant="primary" style={{ flex: 1 }} disabled={!name.trim() || !icon || pending} onPress={() => icon && onSubmit({ name: name.trim(), icon, color })} />
      </View>
      {onArchive && <Button label="Archivar" variant="danger" onPress={onArchive} />}
    </View>
  );
}
