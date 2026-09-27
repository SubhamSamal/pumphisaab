import { Pressable, View } from "react-native";
import { Icon } from "./Icon";
import { Text } from "./Text";

export type Suggestion = { id: string; label: string; selected?: boolean };

/**
 * Drop-down under a search box (owner, 28 Sep: "type ABC, the list shows ABC…; type ABCD, it
 * shows Add"): one row per match, and an "Add …" row last when nothing matches exactly.
 */
export function SuggestList({
  items,
  onPick,
  addLabel,
  onAdd,
  adding,
}: {
  items: Suggestion[];
  onPick: (id: string) => void;
  /** e.g. `Add “ABCD” as a new company`; the row shows only with onAdd. */
  addLabel?: string;
  onAdd?: () => void;
  adding?: boolean;
}) {
  if (items.length === 0 && !onAdd) return null;
  return (
    <View className="overflow-hidden rounded-sm border-1.5 border-border bg-bg">
      {items.map((it, i) => (
        <Pressable
          key={it.id}
          onPress={() => onPick(it.id)}
          accessibilityRole="button"
          accessibilityState={{ selected: Boolean(it.selected) }}
          className={`min-h-tap flex-row items-center gap-8 px-12 active:bg-surface ${i < items.length - 1 || onAdd ? "border-b border-border" : ""}`}
        >
          <Text variant="body" weight={it.selected ? "600" : "400"} className="min-w-0 flex-1">
            {it.label}
          </Text>
          {it.selected ? <Icon name="check" color="primary" /> : null}
        </Pressable>
      ))}
      {onAdd && addLabel ? (
        <Pressable
          onPress={adding ? undefined : onAdd}
          accessibilityRole="button"
          accessibilityState={{ busy: Boolean(adding) }}
          className="min-h-tap flex-row items-center gap-8 px-12 active:bg-surface"
        >
          <Icon name={adding ? "spinner" : "plus"} color="primary" />
          <Text variant="body" weight="600" tone="primary" className="min-w-0 flex-1">
            {addLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
