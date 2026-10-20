import { useState } from "react";
import { Banner, BottomSheet, Button, NumericInput, Text } from "@/components/ui";
import type { Product } from "@/calc";
import { toDecimal } from "@/lib/decimal";
import { fmtDate } from "@/lib/format";
import { checkPrice, FUEL_ORDER } from "./model";

const FUEL_NAME: Record<Product, string> = { HSD: "Diesel (HSD)", MS: "Petrol (MS)" };

/**
 * "Price is different" (D119): the price at the machine, per fuel, filled with the price in force
 * so only the different one is changed. A manager's price waits for the owner; the owner's is used
 * at once.
 */
export function PriceDifferentSheet({
  visible,
  onClose,
  date,
  current,
  isOwner,
  sending,
  error,
  onSend,
}: {
  visible: boolean;
  onClose: () => void;
  date: string;
  /** The price in force (or the one already typed and waiting), per fuel with a tank. */
  current: Partial<Record<Product, string>>;
  isOwner: boolean;
  sending: boolean;
  error: string | null;
  onSend: (prices: { product: Product; perLitre: string }[]) => void;
}) {
  const fuels = FUEL_ORDER.filter((f) => current[f] !== undefined);
  const [typed, setTyped] = useState<Partial<Record<Product, string>>>({});
  const [tried, setTried] = useState(false);

  const [wasVisible, setWasVisible] = useState(false);

  // Fill the boxes each time the sheet opens.
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setTyped(Object.fromEntries(fuels.map((f) => [f, current[f]])) as Partial<Record<Product, string>>);
      setTried(false);
    }
  }

  const checked = fuels.map((f) => ({ product: f, check: checkPrice(typed[f] ?? "") }));
  const changed = checked.flatMap((c) =>
    c.check.kind === "ok" && current[c.product] !== undefined && !toDecimal(c.check.value).equals(toDecimal(current[c.product] as string))
      ? [{ product: c.product, perLitre: c.check.value }]
      : [],
  );
  const bad = checked.some((c) => c.check.kind !== "ok");

  const send = () => {
    setTried(true);
    if (bad || changed.length === 0) return;
    onSend(changed);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text variant="heading">Price is different</Text>
      <Text variant="body" tone="secondary">
        {isOwner
          ? `Type the price at the machine. It is used from ${fmtDate(date)}.`
          : `Type the price at the machine. The owner gets it and approves; until then the money check and Submit wait.`}
      </Text>
      {fuels.map((f, i) => {
        const c = checked.find((x) => x.product === f)?.check;
        return (
          <NumericInput
            key={f}
            label={`${FUEL_NAME[f]} price per litre`}
            value={typed[f] ?? ""}
            onChangeText={(v) => setTyped((t) => ({ ...t, [f]: v }))}
            unit="₹"
            returnKeyType={i === fuels.length - 1 ? "done" : "next"}
            onSubmitEditing={i === fuels.length - 1 ? send : undefined}
            error={c && c.kind === "bad" ? c.message : tried && c?.kind === "empty" ? "Type the price per litre, like 110.07." : undefined}
          />
        );
      })}
      {tried && !bad && changed.length === 0 ? <Banner tone="warning" title="Change the price that's different first." /> : null}
      {error ? <Banner tone="danger" title={error} /> : null}
      <Button label={isOwner ? "Use this price" : "Send to the owner"} loading={sending} onPress={send} />
    </BottomSheet>
  );
}
