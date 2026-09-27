import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import {
  AutoValueRow,
  Banner,
  BottomSheet,
  Button,
  Card,
  Chip,
  ChipGroup,
  DifferenceValue,
  Divider,
  ErrorState,
  FieldHint,
  KeyValueRow,
  ListItem,
  NoteCountRow,
  NumericInput,
  SaveIndicator,
  ScreenBody,
  ScreenHeader,
  Skeleton,
  StickyActionBar,
  Text,
  useIsWide,
} from "@/components/ui";
import { explainReceived } from "@/calc";
import { CustomerPicker } from "@/features/day/CustomerPicker";
import { customerPaymentInputs, evaluate, shiftHours, shiftInputs, type SalesBundle } from "@/features/day/model";
import {
  useDay,
  useDaySetup,
  useDeleteCustomerPayment,
  useSalesData,
  useSalesDone,
  useSalesSetup,
  useSaveCustomerPayment,
  useSaveNoteCount,
  useSaveShiftPayment,
  useSetOpeningCash,
  useShiftData,
  type CustomerPaymentRow,
  type Day,
  type DaySetup,
  type SalesData,
  type SalesSetup,
  type Shift,
  type ShiftData,
} from "@/features/day/queries";
import { useSaveState } from "@/features/day/saveState";
import { useMembership } from "@/features/session/SessionProvider";
import { track } from "@/lib/analytics";
import { Decimal } from "@/lib/decimal";
import { fmtLitres, fmtRupees } from "@/lib/format";
import { readTypedNumber } from "@/lib/numberInput";
import { newId } from "@/lib/uuid";

/** One shift's money (PRD F6, canvas F6): cash note count, other totals, credit slips, customer payments, Done. */
export default function ShiftSalesScreen() {
  const me = useMembership();
  const router = useRouter();
  const wide = useIsWide();
  const { date, code } = useLocalSearchParams<{ date: string; code: string }>();
  const setup = useDaySetup(me.pump.id);
  const day = useDay(me.pump.id, date);
  const shifts = useShiftData(day.data?.id);
  const salesSetup = useSalesSetup(me.pump.id);
  const sales = useSalesData(day.data?.id);
  const save = useSaveState();

  const shift = shifts.data?.shifts.find((s) => s.code === code);
  const failed = setup.error ?? day.error ?? shifts.error ?? salesSetup.error ?? sales.error;
  const ready = setup.data && day.data && shifts.data && salesSetup.data && sales.data && shift;

  return (
    <>
      <ScreenHeader
        title={`Shift ${code} sales`}
        subtitle={shift ? shiftHours(shift) : undefined}
        wide={wide}
        onBack={() => router.back()}
        right={ready ? <SaveIndicator state={save} /> : undefined}
      />
      {failed ? (
        <ScreenBody>
          <ErrorState
            title="Couldn't load sales"
            body="Check the internet. Nothing you typed is lost."
            onRetry={() => (setup.refetch(), day.refetch(), shifts.refetch(), salesSetup.refetch(), sales.refetch())}
          />
        </ScreenBody>
      ) : !ready ? (
        <ScreenBody>
          <Skeleton height={320} />
          <Skeleton height={200} />
        </ScreenBody>
      ) : (
        <SalesForm
          pumpId={me.pump.id}
          setup={setup.data}
          day={day.data}
          shiftData={shifts.data}
          shift={shift}
          salesSetup={salesSetup.data}
          data={sales.data}
          onAddSlip={(id) => router.push({ pathname: "/day/credit-slip", params: { date, code, ...(id ? { id } : {}) } })}
          onDone={() => router.back()}
        />
      )}
    </>
  );
}

function SalesForm({
  pumpId,
  setup,
  day,
  shiftData,
  shift,
  salesSetup,
  data,
  onAddSlip,
  onDone,
}: {
  pumpId: string;
  setup: DaySetup;
  day: Day;
  shiftData: ShiftData;
  shift: Shift;
  salesSetup: SalesSetup;
  data: SalesData;
  onAddSlip: (id?: string) => void;
  onDone: () => void;
}) {
  const savePayment = useSaveShiftPayment(pumpId, day.id);
  const saveCount = useSaveNoteCount(pumpId, day.id);
  const setOpening = useSetOpeningCash(day.id);
  const done = useSalesDone(pumpId, day.id);
  const locked = day.isLocked;
  const [problem, setProblem] = useState<string | null>(null);
  const [paymentSheet, setPaymentSheet] = useState<CustomerPaymentRow | "new" | null>(null);
  const onError = (e: Error) => setProblem(e.message);

  const cashType = salesSetup.types.find((t) => t.kind === "CASH");
  const otherTypes = salesSetup.types.filter((t) => t.kind === "OTHER");
  const rowOf = (typeId?: string) => data.payments.find((p) => p.shiftId === shift.id && p.typeId === typeId);
  const countOf = (noteId: string) => data.counts.find((c) => c.shiftId === shift.id && c.noteId === noteId);

  // What's typed on screen (saved when each box is left).
  const [counts, setCounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(salesSetup.notes.map((n) => [n.id, countOf(n.id)?.count ? String(countOf(n.id)?.count) : ""])),
  );
  const [coins, setCoins] = useState(rowOf(cashType?.id)?.coins ?? "");
  const [others, setOthers] = useState<Record<string, string>>(() => Object.fromEntries(otherTypes.map((t) => [t.id, rowOf(t.id)?.amount ?? ""])));
  const [opening, setOpeningText] = useState(shift.openingCash ?? "");

  // The engine sees the saved data with what's typed laid on top, so Received moves as you type.
  const draft: SalesBundle = useMemo(() => {
    const payments = data.payments.filter((p) => p.shiftId !== shift.id);
    const own = data.payments.filter((p) => p.shiftId === shift.id);
    const coinsVal = readTypedNumber(coins, 2);
    const cashCounted = own.some((p) => p.typeId === cashType?.id) || Object.values(counts).some((c) => c !== "") || coinsVal.kind === "ok";
    if (cashType && cashCounted)
      payments.push({ id: "draft-cash", shiftId: shift.id, typeId: cashType.id, amount: null, coins: coinsVal.kind === "ok" ? coinsVal.value : "0" });
    for (const t of otherTypes) {
      const v = readTypedNumber(others[t.id] ?? "", 2);
      if (v.kind === "ok") payments.push({ id: `draft-${t.id}`, shiftId: shift.id, typeId: t.id, amount: v.value, coins: null });
    }
    const countRows = [
      ...data.counts.filter((c) => c.shiftId !== shift.id),
      ...salesSetup.notes.filter((n) => counts[n.id]).map((n) => ({ id: `draft-${n.id}`, shiftId: shift.id, noteId: n.id, count: Number(counts[n.id]) })),
    ];
    const o = readTypedNumber(opening, 2);
    const money = data.money.map((m) => (m.shiftId === shift.id && o.kind === "ok" ? { ...m, openingCash: o.value } : m));
    return { setup: salesSetup, data: { ...data, payments, counts: countRows, money } };
  }, [data, shift.id, coins, counts, others, opening, cashType, otherTypes, salesSetup]);

  const shiftsForEngine = shiftData.shifts.map((s) => (s.id === shift.id ? { ...s, openingCash: readTypedNumber(opening, 2).kind === "ok" ? opening : null } : s));
  const result = evaluate(
    setup,
    day,
    [],
    shiftInputs(setup, { ...shiftData, shifts: shiftsForEngine }, {}, draft),
    [],
    customerPaymentInputs(shiftData.shifts, draft),
  );
  const money = result.shifts.find((s) => s.shift === shift.code);
  const index = shiftData.shifts.findIndex((s) => s.id === shift.id);
  const before = index > 0 ? shiftData.shifts[index - 1] : undefined;
  const autoOpening = data.money.find((m) => m.shiftId === shift.id)?.openingCash ?? "0";
  const cashTotal = salesSetup.notes
    .reduce((sum, n) => sum.plus(new Decimal(n.value).times(counts[n.id] || "0")), new Decimal(0))
    .plus(readTypedNumber(coins, 2).kind === "ok" ? coins : "0");
  const slips = data.slips.filter((x) => x.shiftId === shift.id);
  // This shift's dues payments, plus the day's bank-transfer ones (they belong to no shift, D47).
  const payments = data.customerPayments.filter((p) => p.shiftId === shift.id || p.shiftId === null);
  const customerName = (id: string) => salesSetup.customers.find((c) => c.id === id)?.name ?? "";
  const typeName = (id: string) => salesSetup.types.find((t) => t.id === id)?.name ?? "";
  const h9 = result.hardErrors.filter((e) => e.code === "H9" && e.where?.shift === shift.code);

  const saveOther = (typeId: string) => {
    const v = readTypedNumber(others[typeId] ?? "", 2);
    if (v.kind === "bad") return;
    const value = v.kind === "ok" ? v.value : null;
    const saved = rowOf(typeId)?.amount ?? null;
    if (value === saved || (value && saved && new Decimal(value).equals(saved))) return;
    savePayment.mutate({ shiftId: shift.id, typeId, amount: value }, { onError, onSuccess: () => track("field_autosaved", { section: "sales" }) });
  };
  const saveCoins = () => {
    const v = readTypedNumber(coins, 2);
    if (v.kind === "bad" || !cashType) return;
    const value = v.kind === "ok" ? v.value : null;
    const saved = rowOf(cashType.id)?.coins ?? null;
    if (value === saved || (value && saved && new Decimal(value).equals(saved))) return;
    savePayment.mutate({ shiftId: shift.id, typeId: cashType.id, coins: value }, { onError });
  };
  const saveNote = (noteId: string) => {
    if (!cashType) return;
    const typed = Number(counts[noteId] || "0");
    if (typed === (countOf(noteId)?.count ?? 0) && (countOf(noteId) || typed === 0)) return;
    saveCount.mutate({ shiftId: shift.id, noteId, count: typed, cashTypeId: cashType.id }, { onError });
  };
  const saveOpening = () => {
    const v = readTypedNumber(opening, 2);
    if (v.kind === "bad") return;
    const value = v.kind === "ok" ? v.value : null;
    if (value === shift.openingCash || (value && shift.openingCash && new Decimal(value).equals(shift.openingCash))) return;
    setOpening.mutate({ shiftId: shift.id, value }, { onError });
  };
  const finish = () => {
    if (locked) return onDone();
    const autofilled = salesSetup.types.filter((t) => t.kind !== "CREDIT" && !rowOf(t.id)).length;
    done.mutate(
      { shiftId: shift.id, types: salesSetup.types, existing: data.payments },
      {
        onError,
        onSuccess: () => {
          track("sales_done_tapped", { shift: shift.code, autofilled_types: autofilled });
          onDone();
        },
      },
    );
  };

  return (
    <>
      <ScreenBody
        sticky={
          <StickyActionBar
            note={
              <Text variant="label" tone="secondary" className="text-center">
                {shift.salesDoneAt ? "Done. You can still fix a number; it's logged." : "Done fills every empty box with ₹0."}
              </Text>
            }
          >
            <Button label={locked ? "Back" : `Done · Shift ${shift.code} sales`} loading={done.isPending} onPress={finish} />
          </StickyActionBar>
        }
      >
        {locked ? <Banner tone="info" icon="lock" title="This day is locked" /> : null}
        {!day.priceConfirmed ? <Banner tone="warning" title="Confirm today's price on Today first">Should have and credit slips need it.</Banner> : null}
        {problem ? <Banner tone="danger" title={problem} /> : null}

        <Card>
          <Text variant="heading">Cash</Text>
          <NumericInput
            label="Cash in the drawer when the shift started"
            value={opening}
            onChangeText={setOpeningText}
            onBlur={saveOpening}
            unit="₹"
            placeholder={fmtRupees(autoOpening, "input").replace("₹", "")}
            helper={opening ? undefined : `From ${before ? `Shift ${before.code}` : "last night's"} count`}
            disabled={locked}
          />
          <Text variant="label" tone="secondary">
            Notes counted in the drawer now
          </Text>
          <View>
            {salesSetup.notes.map((n) => (
              <NoteCountRow
                key={n.id}
                note={fmtRupees(n.value)}
                count={counts[n.id] ?? ""}
                onChangeCount={(v) => setCounts((c) => ({ ...c, [n.id]: v }))}
                onBlur={() => saveNote(n.id)}
                amount={fmtRupees(new Decimal(n.value).times(counts[n.id] || "0"))}
                editable={!locked}
              />
            ))}
          </View>
          <NumericInput label="Coins" value={coins} onChangeText={setCoins} onBlur={saveCoins} unit="₹" disabled={locked} />
          <AutoValueRow label="Cash counted" value={fmtRupees(cashTotal, "input")} />
        </Card>

        <Card>
          <Text variant="heading">Paytm, card, XtraPower, bank</Text>
          {otherTypes.map((t) => (
            <NumericInput
              key={t.id}
              label={t.name}
              value={others[t.id] ?? ""}
              onChangeText={(v) => setOthers((o) => ({ ...o, [t.id]: v }))}
              onBlur={() => saveOther(t.id)}
              unit="₹"
              disabled={locked}
            />
          ))}
        </Card>

        <Card>
          <View className="flex-row items-center justify-between">
            <Text variant="heading">Credit slips</Text>
            <Text variant="number-inline">{fmtRupees(slips.reduce((s, x) => s.plus(x.rupees), new Decimal(0)))}</Text>
          </View>
          {slips.length === 0 ? null : (
            <View>
              {slips.map((x) => (
                <ListItem
                  key={x.id}
                  title={customerName(x.customerId)}
                  detail={`${x.vehicleNo} · Slip ${x.slipNo} · ${x.product} ${fmtLitres(x.litres)}`}
                  slashedZeroDetail
                  right={fmtRupees(x.rupees)}
                  onPress={locked ? undefined : () => onAddSlip(x.id)}
                />
              ))}
            </View>
          )}
          {h9.map((e) => (
            <Banner key={e.message} tone="danger" title={e.message} />
          ))}
          {!locked ? <Button label="Add credit slip" icon="plus" size="M" variant="secondary" disabled={!day.priceConfirmed} onPress={() => onAddSlip()} /> : null}
        </Card>

        <Card>
          <Text variant="heading">Payments from customers</Text>
          {payments.length > 0 ? (
            <View>
              {payments.map((p) => (
                <ListItem
                  key={p.id}
                  title={customerName(p.customerId)}
                  detail={p.shiftId ? `${typeName(p.typeId)} · Shift ${shift.code}` : `${typeName(p.typeId)} · not in any shift`}
                  right={fmtRupees(p.amount)}
                  onPress={locked ? undefined : () => setPaymentSheet(p)}
                />
              ))}
            </View>
          ) : null}
          {!locked ? <Button label="Add payment from customer" icon="plus" size="M" variant="ghost" onPress={() => setPaymentSheet("new")} /> : null}
        </Card>

        <Card tone="summary">
          <View className="flex-row items-center justify-between gap-8">
            <Text variant="heading">{`Shift ${shift.code}`}</Text>
            {money ? <DifferenceValue value={money.difference} unit="rupees" withinLimit={money.withinLimit && !money.difference.isZero()} /> : null}
          </View>
          {money ? (
            <>
              <KeyValueRow label="Should have (meters)" value={fmtRupees(money.shouldHave, "input")} />
              {explainReceived(money).map((l) => (
                <KeyValueRow key={l.label} label={l.label} value={l.amount} indent />
              ))}
              <Divider />
              <KeyValueRow label="Received" big value={fmtRupees(money.received, "input")} />
            </>
          ) : (
            <FieldHint>
              {!day.priceConfirmed
                ? "Confirm today's price to see Should have."
                : "Count the cash (or tap Done) to see Received and the Difference."}
            </FieldHint>
          )}
        </Card>
      </ScreenBody>

      <CustomerPaymentSheet
        pumpId={pumpId}
        dayId={day.id}
        shift={shift}
        salesSetup={salesSetup}
        editing={paymentSheet}
        locked={locked}
        onClose={() => setPaymentSheet(null)}
      />
    </>
  );
}

/** Add or fix a payment from a customer (D29, D47). Bank transfer → no shift. */
function CustomerPaymentSheet({
  pumpId,
  dayId,
  shift,
  salesSetup,
  editing,
  locked,
  onClose,
}: {
  pumpId: string;
  dayId: string;
  shift: Shift;
  salesSetup: SalesSetup;
  editing: CustomerPaymentRow | "new" | null;
  locked: boolean;
  onClose: () => void;
}) {
  const save = useSaveCustomerPayment(pumpId, dayId);
  const remove = useDeleteCustomerPayment(dayId);
  const methods = salesSetup.types.filter((t) => t.kind !== "CREDIT");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [typeId, setTypeId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [last, setLast] = useState<typeof editing>(null);
  if (editing !== last) {
    setLast(editing);
    const e = editing && editing !== "new" ? editing : null;
    setCustomerId(e?.customerId ?? null);
    setTypeId(e?.typeId ?? null);
    setAmount(e?.amount ?? "");
  }
  const close = () => {
    save.reset();
    remove.reset();
    onClose();
  };
  const a = readTypedNumber(amount, 2);
  const isBank = salesSetup.types.find((t) => t.id === typeId)?.name.toLowerCase().includes("bank") ?? false;
  const ok = customerId && typeId && a.kind === "ok" && new Decimal(a.value).gt(0);
  const existing = editing && editing !== "new" ? editing : null;

  return (
    <BottomSheet visible={editing !== null} onClose={close}>
      <Text variant="heading">{existing ? "Payment from customer" : "Add payment from customer"}</Text>
      <CustomerPicker pumpId={pumpId} customers={salesSetup.customers} value={customerId} onChange={setCustomerId} disabled={locked} />
      <NumericInput label="Amount" value={amount} onChangeText={setAmount} unit="₹" error={a.kind === "bad" ? a.message : undefined} />
      <Text variant="label" tone="secondary">
        How was it paid?
      </Text>
      <ChipGroup>
        {methods.map((t) => (
          <Chip key={t.id} small label={t.name} selected={t.id === typeId} onPress={() => setTypeId(t.id)} />
        ))}
      </ChipGroup>
      {typeId ? (
        <FieldHint>
          {isBank
            ? "Bank transfers come outside the shifts, so this is only recorded (not taken off any shift)."
            : `This money is inside Shift ${shift.code}'s ${salesSetup.types.find((t) => t.id === typeId)?.name} total, so it is taken off Shift ${shift.code}.`}
        </FieldHint>
      ) : null}
      {(save.error ?? remove.error) ? <Banner tone="danger" title={(save.error ?? remove.error)!.message} /> : null}
      <Button
        label="Save payment"
        disabled={!ok}
        loading={save.isPending}
        onPress={() =>
          ok &&
          save.mutate(
            { id: existing?.id ?? newId(), shiftId: isBank ? null : shift.id, customerId: customerId!, typeId: typeId!, amount: (a as { value: string }).value },
            { onSuccess: close },
          )
        }
      />
      {existing ? <Button label="Remove" variant="ghost" loading={remove.isPending} onPress={() => remove.mutate(existing.id, { onSuccess: close })} /> : null}
    </BottomSheet>
  );
}
