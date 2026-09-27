import { View } from "react-native";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { PriceChip, type Product } from "./Tag";
import { Text } from "./Text";

export type PriceStripItem = {
  product: Product;
  /** "₹90.50" */
  price: string;
  /** "₹90.00" when the owner changed it from yesterday; absent when unchanged. */
  was?: string;
};

export type PriceStripProps = {
  items: PriceStripItem[];
  /** toConfirm: first confirm of the day. changed: the owner set a new price for today. confirmed: done. */
  state: "toConfirm" | "changed" | "confirmed";
  /** "Same as yesterday", "Set by owner". */
  note?: string;
  onConfirm?: () => void;
  loading?: boolean;
  disabled?: boolean;
};

/**
 * Today's price, confirmed in one tap (canvas F2, PRD F2, H6). Managers never edit a price here:
 * only the owner sets prices, so a wrong price is sorted on the phone.
 */
export function PriceStrip({ items, state, note, onConfirm, loading, disabled }: PriceStripProps) {
  if (state === "confirmed") {
    return (
      <View className="flex-row flex-wrap items-center gap-8">
        {items.map((i) => (
          <PriceChip key={i.product} product={i.product} price={i.price} />
        ))}
        <View className="flex-1" />
        <View className="flex-row items-center gap-4">
          <Icon name="check" size="small" color="success" />
          <Text variant="label" weight="600" tone="success">
            Confirmed
          </Text>
        </View>
      </View>
    );
  }

  if (state === "changed") {
    return (
      <View className="gap-8 rounded-md border-1.5 border-primary bg-bg p-12">
        <View className="flex-row items-center justify-between gap-12">
          <Text variant="body" weight="600">
            New price from today
          </Text>
          {note ? (
            <Text variant="label" weight="400" tone="muted">
              {note}
            </Text>
          ) : null}
        </View>
        {items.map((i) => (
          <View key={i.product} className="flex-row items-center gap-8">
            <PriceChip product={i.product} price={i.price} />
            <Text variant="label" tone="secondary">
              {i.was ? `was ${i.was}` : "no change"}
            </Text>
          </View>
        ))}
        <Button label="Confirm new price" size="M" onPress={onConfirm} loading={loading} disabled={disabled} />
        <Text variant="label" weight="400" tone="muted">
          Price at the machine is different? Call the owner. You can&apos;t change it here.
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-8 rounded-md border-1.5 border-primary bg-bg p-12">
      <View className="flex-row items-center justify-between gap-12">
        <Text variant="body" weight="600">
          Today&apos;s price
        </Text>
        {note ? (
          <Text variant="label" weight="400" tone="muted">
            {note}
          </Text>
        ) : null}
      </View>
      <View className="flex-row items-center gap-8">
        <View className="min-w-0 flex-1 flex-row flex-wrap gap-8">
          {items.map((i) => (
            <PriceChip key={i.product} product={i.product} price={i.price} />
          ))}
        </View>
        <Button label="Confirm" size="M" onPress={onConfirm} loading={loading} disabled={disabled} />
      </View>
    </View>
  );
}
