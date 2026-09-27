import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  AutoValueRow,
  Banner,
  BottomSheet,
  Button,
  ErrorState,
  FieldLabel,
  NumericInput,
  ScreenBody,
  ScreenHeader,
  SegmentedControl,
  Skeleton,
  StickyActionBar,
  Text,
  TextField,
  useIsWide,
} from "@/components/ui";
import { slipAmounts, type Product } from "@/calc";
import { CustomerPicker } from "@/features/day/CustomerPicker";
import { useDay, useDaySetup, useDeleteSlip, useSalesData, useSalesSetup, useSaveSlip, useShiftData, type CreditSale, type Day, type DaySetup, type SalesSetup, type Shift } from "@/features/day/queries";
import { useDraftLoad, useKeepDraft } from "@/features/day/useDraft";
import { useMembership } from "@/features/session/SessionProvider";
import { track } from "@/lib/analytics";
import { Decimal } from "@/lib/decimal";
import { draftKey } from "@/lib/drafts";
import { fmtLitres, fmtRupees } from "@/lib/format";
import { readTypedNumber } from "@/lib/numberInput";
import { newId } from "@/lib/uuid";

const VEHICLE = /^[A-Z0-9]{4,12}$/;

/** Add or fix a credit slip (canvas F6 "Add slip", PRD F7, D27): six things, top to bottom as on the slip. */
export default function CreditSlipScreen() {
  const me = useMembership();
  const router = useRouter();
  const wide = useIsWide();
  const { date, code, id } = useLocalSearchParams<{ date: string; code: string; id?: string }>();
  const setup = useDaySetup(me.pump.id);
  const day = useDay(me.pump.id, date);
  const shifts = useShiftData(day.data?.id);
  const salesSetup = useSalesSetup(me.pump.id);
  const sales = useSalesData(day.data?.id);
  // What was typed but not saved yet stays on the phone (owner, 28 Sep).
  const keyOfDraft = draftKey("slip", me.pump.id, date ?? "", id ?? "new");
  const drafts = useDraftLoad<SlipDraft>(keyOfDraft);
  const [formNo, setFormNo] = useState(0);

  const failed = setup.error ?? day.error ?? shifts.error ?? salesSetup.error ?? sales.error;
  const ready = setup.data && day.data && shifts.data && salesSetup.data && sales.data && drafts.loaded;
  const existing = id ? sales.data?.slips.find((x) => x.id === id) : undefined;

  return (
    <>
      <ScreenHeader title={id ? "Credit slip" : "Add credit slip"} wide={wide} onBack={() => router.back()} />
      {failed ? (
        <ScreenBody>
          <ErrorState title="Couldn't load" body="Check the internet and try again." onRetry={() => (setup.refetch(), day.refetch(), shifts.refetch(), salesSetup.refetch(), sales.refetch())} />
        </ScreenBody>
      ) : !ready ? (
        <ScreenBody>
          <Skeleton height={420} />
        </ScreenBody>
      ) : id && !existing ? (
        <ScreenBody>
          <ErrorState title="This slip isn't there any more" body="It may have been removed on another phone." onRetry={() => router.back()} />
        </ScreenBody>
      ) : (
        <SlipForm
          key={formNo}
          draftKey={keyOfDraft}
          draft={drafts.draft}
          onStartAgain={() => {
            drafts.forget();
            setFormNo((n) => n + 1);
          }}
          pumpId={me.pump.id}
          setup={setup.data}
          day={day.data}
          shifts={shifts.data.shifts}
          startShift={existing ? shifts.data.shifts.find((s) => s.id === existing.shiftId)?.code ?? code : code}
          salesSetup={salesSetup.data}
          existing={existing}
          onDone={() => router.back()}
        />
      )}
    </>
  );
}

type SlipDraft = { slipId: string; shiftCode: string; customerId: string | null; vehicle: string; slipNo: string; product: Product; by: "RUPEES" | "LITRES"; value: string };

function SlipForm({
  draftKey: keyOfDraft,
  draft,
  onStartAgain,
  pumpId,
  setup,
  day,
  shifts,
  startShift,
  salesSetup,
  existing,
  onDone,
}: {
  draftKey: string;
  draft: SlipDraft | null;
  onStartAgain: () => void;
  pumpId: string;
  setup: DaySetup;
  day: Day;
  shifts: Shift[];
  startShift: string;
  salesSetup: SalesSetup;
  existing?: CreditSale;
  onDone: () => void;
}) {
  const save = useSaveSlip(pumpId, day.id);
  const remove = useDeleteSlip(day.id);
  // The slip as saved (or empty); a draft from the phone goes on top of it.
  const [base] = useState<SlipDraft>(() => ({
    slipId: existing?.id ?? newId(),
    shiftCode: startShift,
    customerId: existing?.customerId ?? null,
    vehicle: existing?.vehicleNo ?? "",
    slipNo: existing?.slipNo ?? "",
    product: existing?.product ?? "HSD",
    by: existing?.entryBy ?? "RUPEES",
    value: existing ? (existing.entryBy === "RUPEES" ? existing.rupees : existing.litres) : "",
  }));
  const start = draft ?? base;
  const [restored] = useState(Boolean(draft));
  const [slipId] = useState(start.slipId);
  const [shiftCode, setShiftCode] = useState(start.shiftCode);
  const [customerId, setCustomerId] = useState<string | null>(start.customerId);
  const [vehicle, setVehicle] = useState(start.vehicle);
  const [slipNo, setSlipNo] = useState(start.slipNo);
  const [product, setProduct] = useState<Product>(start.product);
  const [by, setBy] = useState<"RUPEES" | "LITRES">(start.by);
  const [value, setValue] = useState(start.value);
  const discardDraft = useKeepDraft<SlipDraft>(keyOfDraft, { slipId, shiftCode, customerId, vehicle, slipNo, product, by, value }, base);
  const [tried, setTried] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const fuels = [...new Set(setup.tanks.filter((t) => t.isActive).map((t) => t.product))].sort((a, b) => (a === b ? 0 : a === "HSD" ? -1 : 1));
  const rate = day.confirmed[product];
  const v = readTypedNumber(value, 2);
  const amounts =
    rate && v.kind === "ok" && new Decimal(v.value).gt(0)
      ? slipAmounts(
          { slipNo, customer: "", vehicleNo: vehicle, product, entry: by === "RUPEES" ? { by: "rupees", rupees: v.value } : { by: "litres", litres: v.value } },
          new Decimal(rate),
          setup.rules,
        )
      : null;

  const problems = {
    customer: !customerId ? "Pick the company, or add it." : undefined,
    vehicle: !VEHICLE.test(vehicle) ? "Type the vehicle number, like OD05AB1234." : undefined,
    slip: !slipNo.trim() ? "Type the slip number." : undefined,
    value: v.kind === "bad" ? v.message : !amounts ? (by === "RUPEES" ? "Type the rupees on the slip." : "Type the litres on the slip.") : undefined,
  };
  const canSave = !Object.values(problems).some(Boolean) && day.priceConfirmed && !day.isLocked;
  const shift = shifts.find((s) => s.code === shiftCode);

  const submit = () => {
    setTried(true);
    if (!canSave || !shift || !customerId || v.kind !== "ok") return;
    save.mutate(
      { id: slipId, shiftId: shift.id, customerId, vehicleNo: vehicle, slipNo, product, entryBy: by, value: v.value },
      {
        onSuccess: () => {
          if (!existing) track("credit_sale_added", { shift: shiftCode, product, entry_by: by });
          discardDraft();
          onDone();
        },
      },
    );
  };

  return (
    <>
      <ScreenBody
        sticky={
          day.isLocked ? undefined : (
            <StickyActionBar
              note={
                tried && !canSave ? (
                  <Text variant="label" tone="danger" className="text-center">
                    Fix the red boxes to save
                  </Text>
                ) : undefined
              }
            >
              <Button label="Save slip" loading={save.isPending} onPress={submit} />
            </StickyActionBar>
          )
        }
      >
        {restored && !day.isLocked ? (
          <Banner
            tone="info"
            icon="edit"
            title="Brought back what you typed"
            action={<Button label="Start again" size="M" variant="ghost" onPress={onStartAgain} />}
          >
            {"Not saved yet. Tap Save slip when it's done."}
          </Banner>
        ) : null}
        {!day.priceConfirmed ? <Banner tone="warning" title="Confirm today's price on Today first" /> : null}
        {save.error ? <Banner tone="danger" title={save.error.message} /> : null}

        <View className="gap-4">
          <FieldLabel>Shift</FieldLabel>
          <SegmentedControl options={shifts.map((s) => ({ value: s.code, label: s.code }))} value={shiftCode} onChange={setShiftCode} />
        </View>
        <CustomerPicker pumpId={pumpId} customers={salesSetup.customers} value={customerId} onChange={setCustomerId} error={tried ? problems.customer : undefined} />
        <TextField label="Vehicle number" value={vehicle} onChangeText={setVehicle} vehicle placeholder="OD05AB1234" error={tried || vehicle.length >= 4 ? problems.vehicle : undefined} />
        <TextField label="Slip number" value={slipNo} onChangeText={setSlipNo} placeholder="4471" error={tried ? problems.slip : undefined} />
        <View className="gap-4">
          <FieldLabel>Fuel</FieldLabel>
          <SegmentedControl options={fuels.map((f) => ({ value: f, label: f }))} value={product} onChange={setProduct} />
        </View>
        <View className="gap-4">
          <FieldLabel>The slip says</FieldLabel>
          <SegmentedControl
            options={[
              { value: "RUPEES", label: "Rupees" },
              { value: "LITRES", label: "Litres" },
            ]}
            value={by}
            onChange={(b) => {
              setBy(b);
              setValue("");
            }}
          />
        </View>
        <NumericInput
          label={by === "RUPEES" ? "Amount" : "Litres"}
          value={value}
          onChangeText={setValue}
          unit={by === "RUPEES" ? "₹" : "L"}
          error={tried || v.kind === "bad" ? problems.value : undefined}
        />
        {amounts && rate ? (
          <AutoValueRow
            label={by === "RUPEES" ? `${fmtRupees(amounts.rupees)} ÷ ${fmtRupees(rate, "input")}` : `${fmtLitres(amounts.litres)} × ${fmtRupees(rate, "input")}`}
            value={by === "RUPEES" ? fmtLitres(amounts.litres) : fmtRupees(amounts.rupees, "input")}
          />
        ) : null}
        {existing && !day.isLocked ? <Button label="Remove this slip" variant="ghost" onPress={() => setConfirmRemove(true)} /> : null}
      </ScreenBody>

      <BottomSheet visible={confirmRemove} onClose={() => setConfirmRemove(false)}>
        <Text variant="heading">{`Remove slip ${slipNo}?`}</Text>
        <Text variant="body" tone="secondary">
          Only if it was added by mistake. The change is kept in the history.
        </Text>
        {remove.error ? <Banner tone="danger" title={remove.error.message} /> : null}
        <Button
          label="Remove slip"
          variant="destructive"
          loading={remove.isPending}
          onPress={() => existing && remove.mutate(existing.id, { onSuccess: () => (discardDraft(), setConfirmRemove(false), onDone()) })}
        />
        <Button label="Keep it" variant="secondary" onPress={() => setConfirmRemove(false)} />
      </BottomSheet>
    </>
  );
}
