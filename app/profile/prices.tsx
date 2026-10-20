import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Banner,
  BottomSheet,
  Button,
  DateStepper,
  ErrorState,
  ListItem,
  NumericInput,
  PriceChip,
  ProductTag,
  ScreenBody,
  ScreenHeader,
  SegmentedControl,
  Skeleton,
  StickyActionBar,
  Text,
  useIsWide,
} from "@/components/ui";
import type { Product } from "@/calc";
import { checkMargin, checkPrice, priceList, waitingRequests, type PriceListRow } from "@/features/prices/model";
import { useAddPrice, useAnswerPriceRequest, usePriceList, usePriceRequests } from "@/features/prices/queries";
import { useMembership } from "@/features/session/SessionProvider";
import { useBusinessDate } from "@/features/setup/queries";
import { track } from "@/lib/analytics";
import { addDays } from "@/lib/businessDay";
import { fmtDate, fmtRupees } from "@/lib/format";

const FUEL_NAME: Record<Product, string> = { HSD: "Diesel (HSD)", MS: "Petrol (MS)" };
const FUELS = [
  { value: "HSD", label: "Diesel" },
  { value: "MS", label: "Petrol" },
] as const satisfies readonly { value: Product; label: string }[];

/**
 * Profile › Fuel prices (D113, D119). Everyone sees the prices. The owner adds a price (used from
 * its start date) and answers "Price is different" from the managers. Old prices never change.
 */
export default function PricesScreen() {
  const me = useMembership();
  const router = useRouter();
  const wide = useIsWide();
  const isOwner = me.role === "owner";
  const today = useBusinessDate(me.pump.id);
  const prices = usePriceList(me.pump.id);
  const requests = usePriceRequests(me.pump.id);
  const answer = useAnswerPriceRequest(me.pump.id);
  const [adding, setAdding] = useState(false);

  const waiting = waitingRequests(requests.data ?? []);
  const answered = (requests.data ?? []).filter((r) => r.status !== "WAITING").slice(0, 5);

  return (
    <>
      <ScreenHeader title="Fuel prices" wide={wide} onBack={() => router.back()} />
      <ScreenBody
        sticky={
          isOwner ? (
            <StickyActionBar>
              <Button label="Add new price" icon="plus" onPress={() => setAdding(true)} disabled={!today.data || !prices.data} />
            </StickyActionBar>
          ) : undefined
        }
      >
        <Text variant="body" tone="secondary">
          {isOwner
            ? "A new price is used from its start date; older days keep their price. Managers can send you a price with \"Price is different\" on Today."
            : "If the price at the machine is different, tap \"Price is different\" on Today. The owner approves it."}
        </Text>
        {answer.error ? <Banner tone="danger" title={answer.error.message} /> : null}

        {waiting.length > 0 ? (
          <View className="gap-8">
            <Text variant="label" tone="secondary">
              {isOwner ? "Waiting for your OK" : "Waiting for the owner's OK"}
            </Text>
            {waiting.map((r) => (
              <View key={r.id} className="gap-8 rounded-md border-1.5 border-warning bg-warning-subtle p-12">
                <View className="flex-row flex-wrap items-center gap-8">
                  <PriceChip product={r.product} price={fmtRupees(r.perLitre, "input")} />
                  <Text variant="label" tone="secondary">
                    {`From ${fmtDate(r.startsOn)}${r.askedBy ? ` · typed by ${r.askedBy}` : ""}`}
                  </Text>
                </View>
                {isOwner ? (
                  <View className="flex-row flex-wrap gap-8">
                    <Button
                      label="Approve"
                      size="M"
                      icon="check"
                      loading={answer.isPending}
                      onPress={() => answer.mutate({ requestId: r.id, approve: true }, { onSuccess: () => track("price_request_answered", { approve: true }) })}
                    />
                    <Button
                      label="Keep old price"
                      size="M"
                      variant="secondary"
                      disabled={answer.isPending}
                      onPress={() => answer.mutate({ requestId: r.id, approve: false }, { onSuccess: () => track("price_request_answered", { approve: false }) })}
                    />
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {prices.isPending || today.isPending ? (
          <Skeleton height={240} />
        ) : prices.isError || today.isError ? (
          <ErrorState title="Couldn't load the prices" body="Check the internet and try again." onRetry={() => (prices.refetch(), today.refetch())} />
        ) : (
          priceList(prices.data, today.data).map((g) => (
            <View key={g.product}>
              <View className="flex-row items-center gap-8 pb-4">
                <ProductTag product={g.product} />
                <Text variant="label" tone="secondary">
                  {FUEL_NAME[g.product]}
                </Text>
              </View>
              {g.entries.map((e) => (
                <ListItem
                  key={e.id}
                  title={`${fmtRupees(e.perLitre, "input")} per litre`}
                  detail={`From ${fmtDate(e.startsOn)}${e.margin ? ` · margin ${fmtRupees(e.margin, "input")}` : ""}`}
                  right={
                    e.when === "before" ? undefined : (
                      <Text variant="label" weight="600" tone={e.when === "now" ? "success" : "accent"}>
                        {e.when === "now" ? "Now" : "Starts later"}
                      </Text>
                    )
                  }
                />
              ))}
            </View>
          ))
        )}

        {answered.length > 0 ? (
          <View>
            <Text variant="label" tone="secondary">
              Prices sent from Today
            </Text>
            {answered.map((r) => (
              <ListItem
                key={r.id}
                title={`${r.product} ${fmtRupees(r.perLitre, "input")} · ${r.status === "APPROVED" ? "approved" : "old price kept"}`}
                detail={`For ${fmtDate(r.startsOn)}${r.askedBy ? ` · typed by ${r.askedBy}` : ""}`}
              />
            ))}
          </View>
        ) : null}
      </ScreenBody>
      {isOwner && today.data && prices.data ? (
        <AddPriceSheet visible={adding} onClose={() => setAdding(false)} pumpId={me.pump.id} today={today.data} rows={prices.data} />
      ) : null}
    </>
  );
}

/** Owner: a new price with its start date (today or later) and the dealer margin (D64). */
function AddPriceSheet({ visible, onClose, pumpId, today, rows }: { visible: boolean; onClose: () => void; pumpId: string; today: string; rows: PriceListRow[] }) {
  const add = useAddPrice(pumpId);
  const [product, setProduct] = useState<Product>("HSD");
  const [price, setPrice] = useState("");
  const [margin, setMargin] = useState("");
  const [startsOn, setStartsOn] = useState(today);
  const [tried, setTried] = useState(false);

  const inForce = (p: Product) => priceList(rows, today).find((g) => g.product === p)?.entries.find((e) => e.when === "now");

  const [wasVisible, setWasVisible] = useState(false);
  const [marginFor, setMarginFor] = useState<Product | null>(null);

  // Fill the boxes each time the sheet opens, and the margin in force when the fuel changes.
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setPrice("");
      setStartsOn(today);
      setTried(false);
      setMarginFor(null);
    }
  }
  if (visible && marginFor !== product) {
    setMarginFor(product);
    setMargin(inForce(product)?.margin ?? "");
  }

  const p = checkPrice(price);
  const m = checkMargin(margin);
  const now = inForce(product);

  const save = () => {
    setTried(true);
    if (p.kind !== "ok" || m.kind === "bad") return;
    add.mutate(
      { product, perLitre: p.value, startsOn, margin: m.kind === "ok" ? m.value : null },
      {
        onSuccess: () => {
          track("fuel_price_added", { product });
          close();
        },
      },
    );
  };

  const close = () => {
    add.reset();
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={close}>
      <Text variant="heading">Add new price</Text>
      <SegmentedControl options={FUELS} value={product} onChange={setProduct} />
      <NumericInput
        label="Price per litre"
        value={price}
        onChangeText={setPrice}
        unit="₹"
        helper={now ? `Now ${fmtRupees(now.perLitre, "input")} (from ${fmtDate(now.startsOn)})` : undefined}
        error={p.kind === "bad" ? p.message : tried && p.kind === "empty" ? "Type the price per litre, like 110.07." : undefined}
      />
      <NumericInput
        label="Dealer margin per litre"
        value={margin}
        onChangeText={setMargin}
        unit="₹"
        returnKeyType="done"
        helper="Invoice price per litre = price − margin."
        error={m.kind === "bad" ? m.message : undefined}
      />
      <View className="gap-4">
        <Text variant="label" tone="secondary">
          Starts on
        </Text>
        <DateStepper
          label={fmtDate(startsOn, "weekday")}
          caption={startsOn === today ? "Today" : startsOn === addDays(today, 1) ? "Tomorrow" : undefined}
          canPrevious={startsOn > today}
          onPrevious={() => setStartsOn((d) => addDays(d, -1))}
          onNext={() => setStartsOn((d) => addDays(d, 1))}
        />
      </View>
      {add.error ? <Banner tone="danger" title={add.error.message} /> : null}
      <Button label="Add price" loading={add.isPending} onPress={save} />
    </BottomSheet>
  );
}
