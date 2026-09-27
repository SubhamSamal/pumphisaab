import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import {
  AutoValueRow,
  Banner,
  BottomSheet,
  Button,
  Card,
  DateStepper,
  DipInput,
  Divider,
  ErrorState,
  FieldHint,
  FieldLabel,
  FlagNote,
  KeyValueRow,
  NumericInput,
  ProductTag,
  ScreenBody,
  ScreenHeader,
  Skeleton,
  StickyActionBar,
  Text,
  TextField,
  useIsWide,
} from "@/components/ui";
import { checkChart, dipToLitres, type TankerReceipt } from "@/calc";
import { activeTanks, evaluate, lastPrices } from "@/features/day/model";
import {
  useDay,
  useDaySetup,
  useDeleteTanker,
  useRecentTankers,
  useSaveTanker,
  useTankers,
  type Day,
  type DaySetup,
  type Receipt,
  type ReceiptLine,
} from "@/features/day/queries";
import { useMembership } from "@/features/session/SessionProvider";
import { track } from "@/lib/analytics";
import { addDays } from "@/lib/businessDay";
import { Decimal } from "@/lib/decimal";
import { fmtDate, fmtLitres, fmtRupees, MINUS } from "@/lib/format";
import { readTypedNumber } from "@/lib/numberInput";
import { newId } from "@/lib/uuid";

const FUEL_NAME = { HSD: "Diesel", MS: "Petrol" } as const;
const VEHICLE = /^[A-Z0-9]{4,12}$/;

/** Add or fix a tanker (canvas F4, PRD F4): the challan, litres ordered and short, totals, S6. */
export default function TankerFormScreen() {
  const me = useMembership();
  const router = useRouter();
  const wide = useIsWide();
  const { date, id } = useLocalSearchParams<{ date: string; id?: string }>();
  const setup = useDaySetup(me.pump.id);
  const day = useDay(me.pump.id, date);
  const tankers = useTankers(day.data?.id);
  const recent = useRecentTankers(me.pump.id);

  const failed = setup.error ?? day.error ?? tankers.error ?? recent.error;
  const ready = setup.data && day.data && tankers.data && recent.data;
  const existing = id ? tankers.data?.find((r) => r.id === id) : undefined;

  return (
    <>
      <ScreenHeader title={id ? "Tanker" : "Add tanker"} subtitle={date ? fmtDate(date, "weekday") : undefined} wide={wide} onBack={() => router.back()} />
      {failed ? (
        <ScreenBody>
          <ErrorState title="Couldn't load the tanker" body="Check the internet and try again." onRetry={() => (setup.refetch(), day.refetch(), tankers.refetch(), recent.refetch())} />
        </ScreenBody>
      ) : !ready ? (
        <ScreenBody>
          <Skeleton height={200} />
          <Skeleton height={320} />
        </ScreenBody>
      ) : id && !existing ? (
        <ScreenBody>
          <ErrorState title="This tanker isn't there any more" body="It may have been removed on another phone." onRetry={() => router.back()} />
        </ScreenBody>
      ) : (
        <TankerForm
          pumpId={me.pump.id}
          setup={setup.data}
          day={day.data}
          existing={existing}
          prefill={lastPrices(recent.data, existing?.id)}
          onDone={() => router.back()}
        />
      )}
    </>
  );
}

type LineForm = { ordered: string; short: string; price: string; margin: string; dipBefore: string; dipAfter: string; editPrice: boolean; dipCheck: boolean };

function TankerForm({
  pumpId,
  setup,
  day,
  existing,
  prefill,
  onDone,
}: {
  pumpId: string;
  setup: DaySetup;
  day: Day;
  existing?: Receipt;
  prefill: ReturnType<typeof lastPrices>;
  onDone: () => void;
}) {
  const save = useSaveTanker(pumpId, day.id);
  const remove = useDeleteTanker(pumpId, day.id);
  const locked = day.isLocked;
  const [receiptId] = useState(() => existing?.id ?? newId());
  const [vehicle, setVehicle] = useState(existing?.vehicleNo ?? "");
  const [invoiceNo, setInvoiceNo] = useState(existing?.invoiceNo ?? "");
  const [invoiceDate, setInvoiceDate] = useState(existing?.invoiceDate ?? day.businessDate);
  const [tried, setTried] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  // One tank per fuel today (MS-1, HSD-1); diesel first, as on the challan.
  const tanks = activeTanks(setup).sort((a, b) => (a.product === "HSD" ? -1 : 1) - (b.product === "HSD" ? -1 : 1));
  const [forms, setForms] = useState<Record<string, LineForm>>(() =>
    Object.fromEntries(
      tanks.map((t) => {
        const l = existing?.lines.find((x) => x.tankId === t.id);
        const p = prefill[t.product];
        return [
          t.id,
          {
            ordered: l?.orderedLitres ?? "",
            short: l && l.shortLitres !== "0.00" ? l.shortLitres : "",
            price: l?.pricePerLitre ?? p?.price ?? "",
            margin: l?.marginPerLitre ?? p?.margin ?? "",
            dipBefore: l?.dipBeforeCm ?? "",
            dipAfter: l?.dipAfterCm ?? "",
            // Without a last tanker to copy from, the boxes show straight away.
            editPrice: Boolean(l) ? !l?.pricePerLitre : !p?.price,
            dipCheck: Boolean(l?.dipBeforeCm || l?.dipAfterCm),
          },
        ];
      }),
    ),
  );
  const setForm = (tankId: string, patch: Partial<LineForm>) => setForms((f) => ({ ...f, [tankId]: { ...f[tankId], ...patch } }));

  // Read every box once: valid numbers only go to the engine.
  const read = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(forms).map(([tankId, f]) => [
          tankId,
          {
            ordered: readTypedNumber(f.ordered, 2),
            short: readTypedNumber(f.short, 2),
            price: readTypedNumber(f.price, 2),
            margin: readTypedNumber(f.margin, 2),
            dipBefore: readTypedNumber(f.dipBefore, 1),
            dipAfter: readTypedNumber(f.dipAfter, 1),
          },
        ]),
      ),
    [forms],
  );
  const ok = (r: ReturnType<typeof readTypedNumber>) => (r.kind === "ok" ? r.value : undefined);

  const onTanker = tanks.filter((t) => {
    const o = ok(read[t.id].ordered);
    return o !== undefined && new Decimal(o).gt(0);
  });
  const receipt: TankerReceipt = {
    id: receiptId,
    vehicleNo: vehicle,
    lines: onTanker.map((t) => {
      const r = read[t.id];
      const f = forms[t.id];
      return {
        product: t.product,
        tankId: t.id,
        orderedLitres: ok(r.ordered) as string,
        shortLitres: ok(r.short) ?? "0",
        ...(ok(r.price) ? { pricePerLitre: ok(r.price) } : {}),
        ...(ok(r.margin) ? { marginPerLitre: ok(r.margin) } : {}),
        ...(f.dipCheck && ok(r.dipBefore) ? { dipBeforeCm: ok(r.dipBefore) } : {}),
        ...(f.dipCheck && ok(r.dipAfter) ? { dipAfterCm: ok(r.dipAfter) } : {}),
      };
    }),
  };
  const result = evaluate(setup, day, [], [], receipt.lines.length ? [receipt] : []);
  const totals = result.tankers[0];

  // What stops a save (shown once Save is tapped, or as soon as a box is wrong).
  const vehicleProblem = !VEHICLE.test(vehicle) ? "Type the tanker number, like OD02CD9087." : undefined;
  const lineProblems = (tankId: string) => {
    const r = read[tankId];
    const problems: Partial<Record<keyof typeof r, string>> = {};
    for (const [k, v] of Object.entries(r) as [keyof typeof r, ReturnType<typeof readTypedNumber>][]) if (v.kind === "bad") problems[k] = v.message;
    const o = ok(r.ordered);
    const s = ok(r.short);
    if (o && s && new Decimal(s).gt(o)) problems.short = "Short can't be more than ordered.";
    return problems;
  };
  const dipProblem = (tankId: string, cm: string | undefined) => {
    const tank = tanks.find((t) => t.id === tankId);
    const chart = tank ? checkChart(setup.charts[tank.chartId] ?? []).chart : null;
    if (!chart || !cm) return undefined;
    return dipToLitres(chart, cm) === null ? `Outside the tank chart (0 to ${chart.maxDipCm.toFixed(1)} cm).` : undefined;
  };
  const anyLineProblem = tanks.some((t) => Object.keys(lineProblems(t.id)).length > 0 || dipProblem(t.id, ok(read[t.id].dipBefore)) || dipProblem(t.id, ok(read[t.id].dipAfter)));
  const canSave = !vehicleProblem && onTanker.length > 0 && !anyLineProblem;

  const submit = () => {
    setTried(true);
    if (!canSave || locked) return;
    const lines: ReceiptLine[] = onTanker.map((t) => {
      const line = receipt.lines.find((l) => l.tankId === t.id)!;
      return {
        id: existing?.lines.find((l) => l.tankId === t.id)?.id ?? newId(),
        product: t.product,
        tankId: t.id,
        orderedLitres: line.orderedLitres,
        shortLitres: line.shortLitres,
        pricePerLitre: line.pricePerLitre ?? null,
        marginPerLitre: line.marginPerLitre ?? null,
        dipBeforeCm: line.dipBeforeCm ?? null,
        dipAfterCm: line.dipAfterCm ?? null,
      };
    });
    const removeLineIds = (existing?.lines ?? []).filter((l) => !onTanker.some((t) => t.id === l.tankId)).map((l) => l.id);
    save.mutate(
      {
        receipt: { id: receiptId, vehicleNo: vehicle, invoiceNo: invoiceNo.trim() || null, invoiceDate: invoiceDate || null },
        lines,
        removeLineIds,
      },
      {
        onSuccess: () => {
          if (!existing) track("tanker_receipt_added", { fuels: lines.length, flags: result.flags.filter((f) => f.code === "S6").length });
          onDone();
        },
      },
    );
  };

  return (
    <>
      <ScreenBody
        sticky={
          locked ? undefined : (
            <StickyActionBar
              note={
                tried && !canSave ? (
                  <Text variant="label" tone="danger" className="text-center">
                    {vehicleProblem ?? (onTanker.length === 0 ? "Type the litres ordered for at least one fuel." : "Fix the red boxes to save.")}
                  </Text>
                ) : undefined
              }
            >
              <Button label="Save tanker" loading={save.isPending} onPress={submit} />
            </StickyActionBar>
          )
        }
      >
        {locked ? <Banner tone="info" icon="lock" title="This day is locked" /> : null}
        {save.error ? <Banner tone="danger" title={save.error.message} /> : null}

        <TextField
          label="Tanker number"
          value={vehicle}
          onChangeText={setVehicle}
          vehicle
          placeholder="OD02CD9087"
          disabled={locked}
          error={tried || vehicle.length >= 4 ? vehicleProblem : undefined}
        />
        <TextField label="Invoice number (optional)" value={invoiceNo} onChangeText={setInvoiceNo} disabled={locked} />
        <View className="gap-4">
          <FieldLabel>Invoice date</FieldLabel>
          <DateStepper
            label={fmtDate(invoiceDate, "weekday")}
            canNext={!locked && invoiceDate < day.businessDate}
            canPrevious={!locked}
            onPrevious={() => setInvoiceDate(addDays(invoiceDate, -1))}
            onNext={() => setInvoiceDate(addDays(invoiceDate, 1))}
          />
        </View>
        <AutoValueRow label="Unloaded on" value={fmtDate(day.businessDate)} />

        {tanks.map((t) => {
          const f = forms[t.id];
          const r = read[t.id];
          const problems = lineProblems(t.id);
          const lineResult = totals?.lines.find((l) => l.tankId === t.id);
          const flags = result.flags.filter((x) => x.code === "S6" && x.where?.tankId === t.id);
          const price = ok(r.price);
          const margin = ok(r.margin);
          const chart = checkChart(setup.charts[t.chartId] ?? []).chart;
          const litresAt = (cm?: string) => (chart && cm ? dipToLitres(chart, cm) : null);
          return (
            <Card key={t.id}>
              <View className="flex-row items-center gap-8">
                <ProductTag product={t.product} />
                <Text variant="heading">{FUEL_NAME[t.product]}</Text>
              </View>
              <View className="flex-row gap-8">
                <View className="flex-1">
                  <NumericInput label="Ordered" value={f.ordered} onChangeText={(v) => setForm(t.id, { ordered: v })} unit="L" disabled={locked} error={problems.ordered} />
                </View>
                <View className="flex-1">
                  <NumericInput label="Short" value={f.short} onChangeText={(v) => setForm(t.id, { short: v })} unit="L" placeholder="0" disabled={locked} error={problems.short} />
                </View>
              </View>
              {lineResult ? (
                <AutoValueRow label="Received" value={fmtLitres(lineResult.receivedNetLitres)} />
              ) : (
                <FieldHint>{`Leave empty if no ${FUEL_NAME[t.product].toLowerCase()} came on this tanker.`}</FieldHint>
              )}

              {f.editPrice ? (
                <View className="flex-row gap-8">
                  <View className="flex-1">
                    <NumericInput label="Price per litre" value={f.price} onChangeText={(v) => setForm(t.id, { price: v })} unit="₹" disabled={locked} error={problems.price} />
                  </View>
                  <View className="flex-1">
                    <NumericInput label="Margin per litre" value={f.margin} onChangeText={(v) => setForm(t.id, { margin: v })} unit="₹" disabled={locked} error={problems.margin} />
                  </View>
                </View>
              ) : (
                <View className="flex-row items-center gap-8">
                  <View className="min-w-0 flex-1">
                    <Text variant="body" weight="500">
                      {`Price ${price ? fmtRupees(price, "input") : "—"}/L · margin ${margin ? fmtRupees(margin, "input") : "—"}/L`}
                    </Text>
                    <Text variant="label" weight="400" tone="muted">
                      From last tanker. Matches the invoice?
                    </Text>
                  </View>
                  {!locked ? <Button label="Change" size="M" variant="secondary" onPress={() => setForm(t.id, { editPrice: true })} /> : null}
                </View>
              )}

              {flags.filter((x) => x.message.includes("short")).map((x) => (
                <FlagNote key={x.message}>{x.message}</FlagNote>
              ))}

              {f.dipCheck ? (
                <View className="gap-12">
                  <Divider />
                  <Text variant="label" tone="secondary">
                    Dip check (optional): did the tank go up by what the challan says?
                  </Text>
                  <DipInput
                    label="Dip just before unloading"
                    cm={f.dipBefore}
                    onChangeCm={(v) => setForm(t.id, { dipBefore: v })}
                    litres={litresAt(ok(r.dipBefore)) ? fmtLitres(litresAt(ok(r.dipBefore)) as Decimal) : undefined}
                    error={problems.dipBefore ?? dipProblem(t.id, ok(r.dipBefore))}
                  />
                  <DipInput
                    label="Dip just after unloading"
                    cm={f.dipAfter}
                    onChangeCm={(v) => setForm(t.id, { dipAfter: v })}
                    litres={litresAt(ok(r.dipAfter)) ? fmtLitres(litresAt(ok(r.dipAfter)) as Decimal) : undefined}
                    error={problems.dipAfter ?? dipProblem(t.id, ok(r.dipAfter))}
                  />
                  {lineResult?.dipRiseLitres ? (
                    <View className="gap-8">
                      <KeyValueRow label="Tank went up" value={fmtLitres(lineResult.dipRiseLitres)} />
                      <KeyValueRow label="Challan says" value={fmtLitres(lineResult.receivedNetLitres)} />
                      {flags.some((x) => x.message.includes("went up")) ? null : (
                        <Text variant="label" tone="success">
                          OK
                        </Text>
                      )}
                    </View>
                  ) : null}
                  {flags.filter((x) => x.message.includes("went up")).map((x) => (
                    <FlagNote key={x.message}>{x.message}</FlagNote>
                  ))}
                </View>
              ) : !locked ? (
                <Button label="Add dip check (optional)" icon="plus" size="M" variant="ghost" onPress={() => setForm(t.id, { dipCheck: true })} />
              ) : null}
            </Card>
          );
        })}

        {totals && totals.lines.length > 0 ? (
          <Card tone="summary">
            <KeyValueRow label="Invoice amount" value={totals.totalAmount ? fmtRupees(totals.totalAmount) : "—"} />
            <KeyValueRow
              label="Short amount"
              value={totals.totalShortAmount ? (totals.totalShortAmount.isZero() ? "₹0" : `${MINUS}${fmtRupees(totals.totalShortAmount)}`) : "—"}
            />
            <Divider />
            <KeyValueRow label="To pay" big value={totals.toPay ? fmtRupees(totals.toPay) : "—"} />
            <KeyValueRow label="Margin earned" value={totals.totalMargin ? fmtRupees(totals.totalMargin) : "—"} />
            {!totals.totalAmount ? <FieldHint>Type the price per litre for every fuel to see the totals.</FieldHint> : null}
          </Card>
        ) : null}

        {existing && !locked ? (
          <Button label="Remove this tanker" variant="ghost" onPress={() => setConfirmRemove(true)} />
        ) : null}
      </ScreenBody>

      <BottomSheet visible={confirmRemove} onClose={() => setConfirmRemove(false)}>
        <Text variant="heading">{`Remove tanker ${vehicle}?`}</Text>
        <Text variant="body" tone="secondary">
          Only if it was added by mistake. The change is kept in the history.
        </Text>
        {remove.error ? <Banner tone="danger" title={remove.error.message} /> : null}
        <Button
          label="Remove tanker"
          variant="destructive"
          loading={remove.isPending}
          onPress={() => existing && remove.mutate(existing.id, { onSuccess: () => (setConfirmRemove(false), onDone()) })}
        />
        <Button label="Keep it" variant="secondary" onPress={() => setConfirmRemove(false)} />
      </BottomSheet>
    </>
  );
}

