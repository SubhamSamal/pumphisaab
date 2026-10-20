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

/** A price a manager typed with "Price is different", waiting for the owner (D119). */
export type PriceStripWaiting = {
  id: string;
  product: Product;
  /** The price typed: "₹102.10". */
  price: string;
  /** The price in force now: "₹101.74". */
  now?: string;
  /** "Ravi" */
  askedBy?: string;
};

export type PriceStripProps = {
  items: PriceStripItem[];
  /**
   * toConfirm: first confirm of the day. changed: the owner set a new price for today.
   * confirmed: done. waiting: a manager's new price waits for the owner (D119, D120).
   */
  state: "toConfirm" | "changed" | "confirmed" | "waiting";
  /** "Same as yesterday", "Set by owner". */
  note?: string;
  onConfirm?: () => void;
  /** "Price is different": opens the box to type the price at the machine. */
  onDifferent?: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** waiting: the prices waiting for the owner. */
  waiting?: PriceStripWaiting[];
  /** waiting, owner only: Approve / Keep old price per price. Absent for managers. */
  onApprove?: (id: string) => void;
  onKeep?: (id: string) => void;
  answering?: boolean;
};

/**
 * Today's price, confirmed in one tap (canvas F2, PRD F2, H6). If the price at the machine is
 * different, "Price is different" lets the manager type it; it's used once the owner approves
 * (D119). While it waits, the money check and Submit wait too (D120).
 */
export function PriceStrip({ items, state, note, onConfirm, onDifferent, loading, disabled, waiting = [], onApprove, onKeep, answering }: PriceStripProps) {
  if (state === "waiting") {
    const owner = Boolean(onApprove);
    return (
      <View className="gap-8 rounded-md border-1.5 border-warning bg-warning-subtle p-12">
        <View className="flex-row items-center gap-8">
          <Icon name="warning" size="small" color="warning" />
          <Text variant="body" weight="600" className="min-w-0 flex-1">
            {owner ? "New price waiting for your OK" : "New price waiting for the owner's OK"}
          </Text>
        </View>
        {waiting.map((w) => (
          <View key={w.id} className="gap-8">
            <View className="flex-row flex-wrap items-center gap-8">
              <PriceChip product={w.product} price={w.price} />
              <Text variant="label" tone="secondary">
                {[w.now ? `now ${w.now}` : null, w.askedBy ? `typed by ${w.askedBy}` : null].filter(Boolean).join(" · ")}
              </Text>
            </View>
            {owner ? (
              <View className="flex-row flex-wrap gap-8">
                <Button label="Approve" size="M" icon="check" onPress={() => onApprove?.(w.id)} loading={answering} />
                <Button label="Keep old price" size="M" variant="secondary" onPress={() => onKeep?.(w.id)} disabled={answering} />
              </View>
            ) : null}
          </View>
        ))}
        {!owner ? (
          <Text variant="label" weight="400" tone="secondary">
            Keep filling the day. The money check and Submit wait for the owner&apos;s answer.
          </Text>
        ) : null}
        {onDifferent ? <Button label="Change the price typed" size="M" variant="ghost" onPress={onDifferent} /> : null}
      </View>
    );
  }

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
        {onDifferent ? <Button label="Price is different" size="M" variant="ghost" onPress={onDifferent} /> : null}
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
        {onDifferent ? <Button label="Price is different" size="M" variant="secondary" onPress={onDifferent} disabled={loading} /> : null}
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
      {onDifferent ? <Button label="Price is different" size="M" variant="secondary" onPress={onDifferent} disabled={loading} /> : null}
    </View>
  );
}
