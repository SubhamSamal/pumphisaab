import { View } from "react-native";
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
