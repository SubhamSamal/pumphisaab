import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Banner,
  BottomSheet,
  Button,
  Card,
  ChamberHeader,
  ChamberRow,
  DateStepper,
  Divider,
  ErrorState,
  FieldError,
  FieldLabel,
  FlagNote,
  InfoChip,
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
import { checkChart, dipToLitres, type Product, type TankerReceipt } from "@/calc";
import { activeTanks, evaluate, lastPrices, priceRowFor } from "@/features/day/model";
import {
  useDay,
  useDaySetup,
  useDeleteTanker,
  useRecentTankers,
  useSaveTanker,
  useSetMargin,
  useTankers,
  type Day,
  type DaySetup,
  type Receipt,
  type ReceiptLine,
} from "@/features/day/queries";
import { useDraftLoad, useKeepDraft } from "@/features/day/useDraft";
import { useMembership } from "@/features/session/SessionProvider";
import { track } from "@/lib/analytics";
import { addDays } from "@/lib/businessDay";
import { Decimal } from "@/lib/decimal";
import { draftKey } from "@/lib/drafts";
import { formSaveError } from "@/lib/outbox";
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
  // What was typed but not saved yet stays on the phone (owner, 28 Sep: Back lost a whole tanker).
  const keyOfDraft = draftKey("tanker", me.pump.id, date ?? "", id ?? "new");
  const drafts = useDraftLoad<TankerDraft>(keyOfDraft);
  const [formNo, setFormNo] = useState(0);

  const failed = setup.error ?? day.error ?? tankers.error ?? recent.error;
  const ready = setup.data && day.data && tankers.data && recent.data && drafts.loaded;
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
          key={formNo}
          draftKey={keyOfDraft}
          draft={drafts.draft}
          onStartAgain={() => {
            drafts.forget();
            setFormNo((n) => n + 1);
          }}
          pumpId={me.pump.id}
          isOwner={me.role === "owner"}
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

type ChamberForm = { litres: string; before: string; after: string };
type LineForm = { on: boolean; ordered: string; short: string; chambers: ChamberForm[] };
type TankerDraft = { receiptId: string; vehicle: string; invoiceNo: string; invoiceAmount: string; invoiceDate: string; forms: Record<string, LineForm> };

/** "14000.00" → "14000" for the typing box. */
const plain = (v: string | null | undefined) => {
  if (!v) return "";
  const r = readTypedNumber(v, 2);
  return r.kind === "ok" ? r.value : v;
};

function TankerForm({
  draftKey: keyOfDraft,
  draft,
  onStartAgain,
  pumpId,
  isOwner,
  setup,
  day,
  existing,
  prefill,
  onDone,
}: {
  draftKey: string;
  draft: TankerDraft | null;
  onStartAgain: () => void;
  pumpId: string;
  isOwner: boolean;
  setup: DaySetup;
  day: Day;
  existing?: Receipt;
  prefill: ReturnType<typeof lastPrices>;
  onDone: () => void;
}) {
  const save = useSaveTanker(pumpId, day.id);
  const remove = useDeleteTanker(pumpId, day.id);
  const locked = day.isLocked;
  // One tank per fuel today (MS-1, HSD-1); diesel first, as on the challan.
  const tanks = activeTanks(setup).sort((a, b) => (a.product === b.product ? 0 : a.product === "HSD" ? -1 : 1));
  // The form as saved (or empty); a draft from the phone goes on top of it.
  const [base] = useState<TankerDraft>(() => ({
    receiptId: existing?.id ?? newId(),
    vehicle: existing?.vehicleNo ?? "",
    invoiceNo: existing?.invoiceNo ?? "",
    invoiceAmount: plain(existing?.invoiceAmount),
    invoiceDate: existing?.invoiceDate ?? day.businessDate,
    forms: Object.fromEntries(
      tanks.map((t, i) => {
        const l = existing?.lines.find((x) => x.tankId === t.id);
        return [
          t.id,
          {
            // Diesel is open on a new tanker; petrol opens with "Add petrol".
            on: existing ? Boolean(l) : i === 0,
            ordered: plain(l?.orderedLitres),
            short: l && Number(l.shortLitres) !== 0 ? plain(l.shortLitres) : "",
            chambers: l?.chambers.length
              ? l.chambers.map((c, k) => ({
                  litres: plain(c.litres),
                  // Chambers saved before each had its own "before": the previous after (or the line's before).
                  before: plain(c.dipBeforeCm ?? (k === 0 ? l.dipBeforeCm : l.chambers[k - 1].dipAfterCm)),
                  after: plain(c.dipAfterCm),
                }))
              : [{ litres: "", before: "", after: "" }],
          },
        ];
      }),
    ),
  }));
  const start = draft ? { ...draft, forms: Object.fromEntries(tanks.map((t) => [t.id, draft.forms[t.id] ?? base.forms[t.id]])) } : base;
  const [restored] = useState(Boolean(draft));
  const [receiptId] = useState(start.receiptId);
  const [vehicle, setVehicle] = useState(start.vehicle);
  const [invoiceNo, setInvoiceNo] = useState(start.invoiceNo);
  const [invoiceAmount, setInvoiceAmount] = useState(start.invoiceAmount);
  const [invoiceDate, setInvoiceDate] = useState(start.invoiceDate);
  const [tried, setTried] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [marginFor, setMarginFor] = useState<Product | null>(null);
  const [forms, setForms] = useState<Record<string, LineForm>>(start.forms);
  const discardDraft = useKeepDraft<TankerDraft>(keyOfDraft, { receiptId, vehicle, invoiceNo, invoiceAmount, invoiceDate, forms }, base);
  const setForm = (tankId: string, patch: Partial<LineForm>) => setForms((f) => ({ ...f, [tankId]: { ...f[tankId], ...patch } }));
  const setChamber = (tankId: string, k: number, patch: Partial<ChamberForm>) =>
    setForms((f) => ({ ...f, [tankId]: { ...f[tankId], chambers: f[tankId].chambers.map((c, j) => (j === k ? { ...c, ...patch } : c)) } }));

  const ok = (raw: string, decimals = 2) => {
    const r = readTypedNumber(raw, decimals);
    return r.kind === "ok" ? r.value : undefined;
  };
  // Selling price from Today; margin set by the owner on that price (D64). Invoice price = selling − margin.
  const selling = (f: Product) => day.confirmed[f] ?? day.now[f];
  const marginOf = (t: (typeof tanks)[number]) =>
    priceRowFor(setup, t.product, day.businessDate)?.margin ?? existing?.lines.find((l) => l.tankId === t.id)?.marginPerLitre ?? prefill[t.product]?.margin ?? null;
  const costOf = (t: (typeof tanks)[number]) => {
    const sp = selling(t.product);
    const m = marginOf(t);
    return sp && m ? new Decimal(sp).minus(m) : null;
  };

  const onTanker = tanks.filter((t) => forms[t.id].on && ok(forms[t.id].ordered) && new Decimal(ok(forms[t.id].ordered) as string).gt(0));
  const receipt: TankerReceipt = {
    id: receiptId,
    vehicleNo: vehicle,
    ...(ok(invoiceAmount) ? { invoiceAmount: ok(invoiceAmount) } : {}),
    lines: onTanker.map((t) => {
      const f = forms[t.id];
      const cost = costOf(t);
      const chambers = f.chambers.flatMap((c) =>
        ok(c.litres) && ok(c.before, 1) && ok(c.after, 1)
          ? [{ litres: ok(c.litres) as string, dipBeforeCm: ok(c.before, 1) as string, dipAfterCm: ok(c.after, 1) as string }]
          : [],
      );
      const margin = marginOf(t);
      return {
        product: t.product,
        tankId: t.id,
        orderedLitres: ok(f.ordered) as string,
        shortLitres: ok(f.short) ?? "0",
        ...(cost ? { pricePerLitre: cost.toFixed(2) } : {}),
        ...(margin ? { marginPerLitre: margin } : {}),
        ...(chambers.length === f.chambers.length && chambers.length
          ? { dipBeforeCm: chambers[0].dipBeforeCm, dipAfterCm: chambers[chambers.length - 1].dipAfterCm, chambers }
          : {}),
      };
    }),
  };
  const result = evaluate(setup, day, [], [], receipt.lines.length ? [receipt] : []);
  const totals = result.tankers[0];

  // What stops a save. Each problem shows under its box once Save is tapped (or when a box is wrong).
  const chartOf = (tankId: string) => {
    const tank = tanks.find((t) => t.id === tankId);
    return tank ? checkChart(setup.charts[tank.chartId] ?? []).chart : null;
  };
  const dipProblem = (tankId: string, raw: string) => {
    if (!raw) return tried ? "Type the dip." : undefined;
    const r = readTypedNumber(raw, 1);
    if (r.kind === "bad") return r.message;
    const chart = chartOf(tankId);
    if (r.kind === "ok" && chart && dipToLitres(chart, r.value) === null) return `Outside the tank chart (0 to ${chart.maxDipCm.toFixed(1)} cm).`;
    return undefined;
  };
  const lineProblems = (t: (typeof tanks)[number]) => {
    const f = forms[t.id];
    const p: { ordered?: string; short?: string; chambers: (string | undefined)[]; total?: string } = { chambers: [] };
    const o = readTypedNumber(f.ordered, 2);
    if (o.kind === "bad") p.ordered = o.message;
    else if (o.kind === "empty" && tried) p.ordered = "Type the litres ordered.";
    const sh = readTypedNumber(f.short, 2);
    if (sh.kind === "bad") p.short = sh.message;
    else if (sh.kind === "ok" && o.kind === "ok" && new Decimal(sh.value).gt(o.value)) p.short = "More than ordered.";
    p.chambers = f.chambers.map((c) => {
      const l = readTypedNumber(c.litres, 2);
      if (l.kind === "bad") return l.message;
      if (l.kind === "empty" && tried) return "Type this chamber's litres.";
      return dipProblem(t.id, c.before) ?? dipProblem(t.id, c.after);
    });
    const sumL = f.chambers.reduce((s2, c) => s2.plus(ok(c.litres) ?? 0), new Decimal(0));
    if (o.kind === "ok" && f.chambers.every((c) => ok(c.litres)) && !sumL.equals(o.value))
      p.total = `Chambers add up to ${fmtLitres(sumL)}; ordered is ${fmtLitres(o.value)}.`;
    return p;
  };
  const vehicleProblem = !VEHICLE.test(vehicle) ? "Type the tanker number, like OD02CD9087." : undefined;
  const amt = readTypedNumber(invoiceAmount, 2);
  const invoiceProblem = amt.kind === "bad" ? amt.message : amt.kind === "empty" ? "Type the invoice amount from the challan." : undefined;
  const open = tanks.filter((t) => forms[t.id].on);
  const anyLineProblem = open.some((t) => {
    const p = lineProblems(t);
    return p.ordered || p.short || p.total || p.chambers.some(Boolean) || !ok(forms[t.id].ordered);
  });
  const canSave = !vehicleProblem && !invoiceProblem && onTanker.length > 0 && !anyLineProblem && Boolean(totals);

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
        chambers: (line.chambers ?? []).map((c) => ({ litres: c.litres, dipBeforeCm: c.dipBeforeCm ?? null, dipAfterCm: c.dipAfterCm })),
      };
    });
    const removeLineIds = (existing?.lines ?? []).filter((l) => !onTanker.some((t) => t.id === l.tankId)).map((l) => l.id);
    save.mutate(
      {
        receipt: { id: receiptId, vehicleNo: vehicle, invoiceNo: invoiceNo.trim() || null, invoiceDate: invoiceDate || null, invoiceAmount: ok(invoiceAmount) ?? null },
        lines,
        removeLineIds,
      },
      {
        onSuccess: () => {
          if (!existing) track("tanker_receipt_added", { fuels: lines.length, chambers: lines.reduce((n, l) => n + l.chambers.length, 0) });
          discardDraft();
          onDone();
        },
      },
    );
  };

  const worked = totals?.totalAmount;
  const typedInvoice = ok(invoiceAmount);
  const gap = worked && typedInvoice ? new Decimal(typedInvoice).minus(worked) : null;

  return (
    <>
      <ScreenBody
        sticky={
          locked ? undefined : (
            <StickyActionBar
              note={
                tried && !canSave ? (
                  <Text variant="label" tone="danger" className="text-center">
                    Fix the red boxes to save
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
        {restored && !locked ? (
          <Banner
            tone="info"
            icon="edit"
            title="Brought back what you typed"
            action={<Button label="Start again" size="M" variant="ghost" onPress={onStartAgain} />}
          >
            {"Not saved yet. Tap Save tanker when it's done."}
          </Banner>
        ) : null}
        {save.error ? <Banner tone="danger" title={formSaveError(save.error.message)} /> : null}

        <TextField
          label="Tanker number"
          value={vehicle}
          onChangeText={setVehicle}
          vehicle
          placeholder="OD02CD9087"
          disabled={locked}
          error={tried || vehicle.length >= 4 ? vehicleProblem : undefined}
        />
        <View className="flex-row gap-8">
          <View className="flex-1">
            <TextField label="Invoice no. (optional)" value={invoiceNo} onChangeText={setInvoiceNo} disabled={locked} />
          </View>
          <View className="flex-1">
            <NumericInput
              label="Invoice amount"
              compact
              value={invoiceAmount}
              onChangeText={setInvoiceAmount}
              unit="₹"
              disabled={locked}
              error={tried || amt.kind === "bad" ? invoiceProblem : undefined}
            />
          </View>
        </View>
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

        {tanks.map((t) => {
          const f = forms[t.id];
          if (!f.on) {
            return locked ? null : (
              <Button key={t.id} label={`Add ${FUEL_NAME[t.product].toLowerCase()}`} icon="plus" size="M" variant="secondary" onPress={() => setForm(t.id, { on: true })} />
            );
          }
          const p = lineProblems(t);
          const lineResult = totals?.lines.find((l) => l.tankId === t.id);
          const flags = result.flags.filter((x) => x.code === "S6" && x.where?.tankId === t.id);
          const sp = selling(t.product);
          const margin = marginOf(t);
          const row = priceRowFor(setup, t.product, day.businessDate);
          const cost = costOf(t);
          const warnPct = new Decimal(setup.rules.tanker.dipCheckFlagBeyondPercent);
          return (
            <Card key={t.id}>
              <View className="flex-row items-center gap-8">
                <ProductTag product={t.product} />
                <Text variant="heading" className="flex-1">
                  {FUEL_NAME[t.product]}
                </Text>
                {!locked && tanks.length > 1 ? (
                  <Button label="Remove" size="M" variant="ghost" onPress={() => setForm(t.id, { on: false })} />
                ) : null}
              </View>
              <View className="flex-row gap-8">
                <View className="flex-1">
                  <NumericInput label="Ordered" compact value={f.ordered} onChangeText={(v) => setForm(t.id, { ordered: v })} unit="L" disabled={locked} error={p.ordered} />
                </View>
                <View className="flex-1">
                  <NumericInput label="Short" compact value={f.short} onChangeText={(v) => setForm(t.id, { short: v })} unit="L" placeholder="0" disabled={locked} error={p.short} />
                </View>
              </View>
              {lineResult ? <KeyValueRow label="Received" value={fmtLitres(lineResult.receivedNetLitres)} /> : null}

              {/* Price as chips (owner, 27 Sep): selling price from Today, margin set by the owner. */}
              <View className="flex-row flex-wrap gap-8">
                <InfoChip label="Selling" value={sp ? fmtRupees(sp, "input") : "not set"} tone={sp ? "neutral" : "warning"} />
                <InfoChip
                  label="Margin"
                  value={margin ? fmtRupees(margin, "input") : "not set"}
                  tone={margin ? "neutral" : "warning"}
                  onPress={isOwner && row && !locked ? () => setMarginFor(t.product) : undefined}
                />
                {cost ? <InfoChip label="Invoice price" value={`${fmtRupees(cost, "input")}/L`} /> : null}
              </View>
              {!margin && !isOwner ? (
                <Text variant="label" weight="400" tone="warning">
                  Ask the owner to set the margin.
                </Text>
              ) : null}
              {flags.filter((x) => x.message.includes("short")).map((x) => (
                <FlagNote key={x.message}>{x.message}</FlagNote>
              ))}

              <Divider />
              <ChamberHeader />
              {f.chambers.map((c, k) => {
                const cr = lineResult?.chambers[k];
                const short = cr?.shortLitres;
                const warn = short && cr ? short.abs().gt(cr.litres.times(warnPct).div(100)) : false;
                return (
                  <ChamberRow
                    key={k}
                    no={k + 1}
                    litres={c.litres}
                    onChangeLitres={(v) => setChamber(t.id, k, { litres: v })}
                    dipBefore={c.before}
                    onChangeBefore={(v) => setChamber(t.id, k, { before: v })}
                    dipAfter={c.after}
                    onChangeDip={(v) => setChamber(t.id, k, { after: v })}
                    rise={cr?.riseLitres ? fmtLitres(cr.riseLitres) : undefined}
                    short={short ? (short.isNegative() ? `over ${fmtLitres(short.abs())}` : `short ${fmtLitres(short)}`) : undefined}
                    shortWarn={warn}
                    error={p.chambers[k]}
                    editable={!locked}
                  />
                );
              })}
              {!locked ? (
                <View className="flex-row gap-8">
                  {f.chambers.length < 12 ? (
                    <Button
                      label="Add chamber"
                      icon="plus"
                      size="M"
                      variant="ghost"
                      // The next chamber usually starts where the last one ended; change it if fuel was sold in between.
                      onPress={() => setForm(t.id, { chambers: [...f.chambers, { litres: "", before: f.chambers[f.chambers.length - 1]?.after ?? "", after: "" }] })}
                    />
                  ) : null}
                  {f.chambers.length > 1 ? (
                    <Button label="Remove last" size="M" variant="ghost" onPress={() => setForm(t.id, { chambers: f.chambers.slice(0, -1) })} />
                  ) : null}
                </View>
              ) : null}
              {p.total ? <FieldError message={p.total} /> : null}
              {lineResult?.dipRiseLitres ? (
                <KeyValueRow label="Tank went up in all" value={`${fmtLitres(lineResult.dipRiseLitres)} of ${fmtLitres(lineResult.receivedNetLitres)}`} />
              ) : null}
              {flags.filter((x) => x.message.includes("went up")).map((x) => (
                <FlagNote key={x.message}>{x.message}</FlagNote>
              ))}
            </Card>
          );
        })}

        {totals && totals.lines.length > 0 ? (
          <Card tone="summary">
            <KeyValueRow label="Invoice amount" value={typedInvoice ? fmtRupees(typedInvoice, "input") : "—"} />

            <KeyValueRow
              label="Short amount"
              value={totals.totalShortAmount ? (totals.totalShortAmount.isZero() ? "₹0" : `${MINUS}${fmtRupees(totals.totalShortAmount, "input")}`) : "—"}
            />
            <Divider />
            <KeyValueRow label="To pay" big value={totals.toPay ? fmtRupees(totals.toPay, "input") : "—"} />
            <KeyValueRow label="Margin earned" value={totals.totalMargin ? fmtRupees(totals.totalMargin) : "—"} />
            {gap && !gap.isZero() ? (
              <Text variant="label" weight="400" tone="secondary">
                {`The challan is ${fmtRupees(gap.abs(), "input")} ${gap.isNegative() ? "less" : "more"} than litres × invoice price (${fmtRupees(worked as Decimal, "input")}).`}
              </Text>
            ) : null}
          </Card>
        ) : null}

        {existing && !locked ? <Button label="Remove this tanker" variant="ghost" onPress={() => setConfirmRemove(true)} /> : null}
      </ScreenBody>

      <MarginSheet pumpId={pumpId} setup={setup} date={day.businessDate} product={marginFor} onClose={() => setMarginFor(null)} />

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
          onPress={() => existing && remove.mutate(existing.id, { onSuccess: () => (discardDraft(), setConfirmRemove(false), onDone()) })}
        />
        <Button label="Keep it" variant="secondary" onPress={() => setConfirmRemove(false)} />
      </BottomSheet>
    </>
  );
}

/** Owner only: the dealer margin per litre on the price in force (D64). */
function MarginSheet({ pumpId, setup, date, product, onClose }: { pumpId: string; setup: DaySetup; date: string; product: Product | null; onClose: () => void }) {
  const setMargin = useSetMargin(pumpId);
  const row = product ? priceRowFor(setup, product, date) : null;
  const [value, setValue] = useState("");
  const [last, setLast] = useState<Product | null>(null);
  if (product !== last) {
    setLast(product);
    setValue(plain(row?.margin));
  }
  const r = readTypedNumber(value, 2);
  const close = () => {
    setMargin.reset();
    onClose();
  };
  return (
    <BottomSheet visible={product !== null} onClose={close}>
      <Text variant="heading">{`${product ? FUEL_NAME[product] : ""} margin per litre`}</Text>
      {row ? (
        <Text variant="body" tone="secondary">
          {`For the price ${fmtRupees(row.perLitre, "input")} from ${fmtDate(row.startsOn)}. Set it again when the price changes.`}
        </Text>
      ) : null}
      <NumericInput label="Margin" value={value} onChangeText={setValue} unit="₹" error={r.kind === "bad" ? r.message : undefined} />
      {setMargin.error ? <Banner tone="danger" title={setMargin.error.message} /> : null}
      <Button
        label="Save margin"
        loading={setMargin.isPending}
        disabled={!row || r.kind !== "ok"}
        onPress={() => row && r.kind === "ok" && setMargin.mutate({ priceId: row.id, margin: r.value }, { onSuccess: close })}
      />
    </BottomSheet>
  );
}
