import { Pressable, View } from "react-native";
import { Icon } from "./Icon";
import { Text } from "./Text";

export type Product = "HSD" | "MS";

/** Small product tag. Identifies the fuel only; never used for Matched/Short. */
export function ProductTag({ product, suffix }: { product: Product; suffix?: string }) {
  const hsd = product === "HSD";
  return (
    <View className={`h-24 flex-row items-center gap-4 self-start rounded-sm px-8 ${hsd ? "bg-hsd-tint" : "bg-ms-tint"}`}>
      <Text variant="caption" weight="600" tone={hsd ? "hsd" : "ms"}>
        {suffix ? `${product}-${suffix}` : product}
      </Text>
    </View>
  );
}

/** Marks a calculated, read-only value. */
export function AutoTag() {
  return (
    <View className="h-24 flex-row items-center gap-4 self-start rounded-sm border border-border bg-bg px-8">
      <Icon name="lock" size="small" color="text-secondary" />
      <Text variant="caption" weight="500" tone="secondary">
        auto
      </Text>
    </View>
  );
}

/** Price chip in product tint: "HSD ₹90.00". */
export function PriceChip({ product, price }: { product: Product; price: string }) {
  const hsd = product === "HSD";
  return (
    <View className={`h-32 flex-row items-center gap-8 self-start rounded-sm px-12 ${hsd ? "bg-hsd-tint" : "bg-ms-tint"}`}>
      <Text variant="label" weight="600" tone={hsd ? "hsd" : "ms"}>
        {product} {price}
      </Text>
    </View>
  );
}

/**
 * A small read-only fact as a chip: "Selling ₹101.74", "Margin ₹2.60". With onPress it can be
 * changed (pencil), e.g. the owner's margin on the tanker screen (owner, 27 Sep: show these as chips).
 */
export function InfoChip({ label, value, tone = "neutral", onPress }: { label: string; value: string; tone?: "neutral" | "warning"; onPress?: () => void }) {
  const warn = tone === "warning";
  const body = (
    <View className={`h-32 flex-row items-center gap-4 self-start rounded-sm border px-8 ${warn ? "border-warning bg-warning-subtle" : "border-border bg-surface"}`}>
      <Text variant="label" weight="400" tone={warn ? "warning" : "secondary"}>
        {label}
      </Text>
      <Text variant="label" weight="600" tone={warn ? "warning" : "primary"}>
        {value}
      </Text>
      {onPress ? <Icon name="edit" size="small" color={warn ? "warning" : "text-secondary"} /> : null}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label} ${value}, change`} hitSlop={6}>
      {body}
    </Pressable>
  ) : (
    body
  );
}
