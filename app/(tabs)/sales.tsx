import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import {
  Banner,
  Button,
  Card,
  DifferenceValue,
  Divider,
  ErrorState,
  FieldHint,
  Icon,
  KeyValueRow,
  ScreenBody,
  SegmentedControl,
  Skeleton,
  StatusPill,
  Text,
} from "@/components/ui";
import { explainReceived } from "@/calc";
import { customerPaymentInputs, expenseInputs, evaluate, shiftHours, shiftInputs, type SalesBundle } from "@/features/day/model";
import { useDay, useDaySetup, useExpenses, useSalesData, useSalesSetup, useSaveShiftPayment, useShiftData, type PaymentType, type Shift } from "@/features/day/queries";
import { useSelectedDay } from "@/features/day/SelectedDay";
import { useMembership } from "@/features/session/SessionProvider";
import { MainHeader } from "@/features/shell/MainHeader";
import { Decimal } from "@/lib/decimal";
import { fmtDate, fmtRupees } from "@/lib/format";

type SalesView = "shift" | "type";

/** Sales tab (canvas F6): all money in one place. By shift (did it match?) and By type (day totals). */
export default function SalesScreen() {
  const me = useMembership();
  const router = useRouter();
  const { date, serverKnown } = useSelectedDay();
  const setup = useDaySetup(me.pump.id);
  const day = useDay(me.pump.id, serverKnown ? date : undefined);
  const shifts = useShiftData(day.data?.id);
  const salesSetup = useSalesSetup(me.pump.id);
  const sales = useSalesData(day.data?.id);
  const expenses = useExpenses(day.data?.id);
  const saveOther = useSaveShiftPayment(me.pump.id, day.data?.id);
  const [view, setView] = useState<SalesView>("shift");

  const failed = setup.error ?? day.error ?? shifts.error ?? salesSetup.error ?? sales.error ?? expenses.error;
  const ready = setup.data && day.data && shifts.data && salesSetup.data && sales.data && expenses.data;

  const openShift = (s: Shift) => router.push({ pathname: "/day/sales", params: { date, code: s.code } });

  let body: React.ReactNode;
  if (failed) {
    body = (
      <ErrorState
        title="Couldn't load sales"
        body="Check the internet and try again. Nothing you typed is lost."
        onRetry={() => (setup.refetch(), day.refetch(), shifts.refetch(), salesSetup.refetch(), sales.refetch(), expenses.refetch())}
      />
    );
  } else if (!ready) {
    body = (
      <View className="gap-8">
        <Skeleton height={48} />
        <Skeleton height={160} />
        <Skeleton height={160} />
      </View>
    );
  } else {
    const bundle: SalesBundle = { setup: salesSetup.data, data: sales.data };
    const result = evaluate(
      setup.data,
      day.data,
      [],
      shiftInputs(setup.data, shifts.data, {}, bundle),
      [],
      customerPaymentInputs(shifts.data.shifts, bundle),
      expenseInputs(setup.data, expenses.data),
    );
    const list = shifts.data.shifts;
    const received = result.shifts.reduce((s, m) => s.plus(m.received), new Decimal(0));

    body = (
      <>
        {day.data.isLocked ? <Banner tone="info" icon="lock" title="This day is locked" /> : null}
        {!day.data.priceConfirmed ? <Banner tone="warning" title="Confirm today's price on Today first">Should have and credit slips need it.</Banner> : null}
        <SegmentedControl
          options={[
            { value: "shift", label: "By shift" },
            { value: "type", label: "By type" },
          ]}
          value={view}
          onChange={setView}
        />

        {view === "shift" ? (
          list.map((s) => {
            const m = result.shifts.find((x) => x.shift === s.code);
            return (
              <Pressable key={s.id} onPress={() => openShift(s)} accessibilityRole="button" accessibilityLabel={`Shift ${s.code} sales`}>
                <Card>
                  <View className="flex-row flex-wrap items-center justify-between gap-8">
                    <View>
                      <Text variant="heading">{`Shift ${s.code}`}</Text>
                      <Text variant="label" weight="400" tone="secondary">
                        {shiftHours(s)}
                      </Text>
                    </View>
                    {m ? (
                      <DifferenceValue value={m.difference} unit="rupees" withinLimit={m.withinLimit && !m.difference.isZero()} />
                    ) : s.salesDoneAt ? (
                      <StatusPill status="draft" label="Done" />
                    ) : (
                      <Icon name="chevronRight" color="text-secondary" />
                    )}
                  </View>
                  {m ? (
                    <>
                      <KeyValueRow label="Should have (meters)" value={fmtRupees(m.shouldHave, "input")} />
                      {explainReceived(m).map((l) => (
                        <KeyValueRow key={l.label} label={l.label} value={l.amount} indent />
                      ))}
                      <Divider />
                      <KeyValueRow label="Received" big value={fmtRupees(m.received, "input")} />
                    </>
                  ) : (
                    <FieldHint>{s.salesDoneAt ? "Readings or price missing, so it can't be matched yet." : "Tap to count the cash and type this shift's money."}</FieldHint>
                  )}
                </Card>
              </Pressable>
            );
          })
        ) : (
          <ByType
            shifts={list}
            types={salesSetup.data.types}
            bundle={bundle}
            received={received}
            locked={day.data.isLocked}
            onNoneToday={(t) => {
              for (const s of list) {
                const row = sales.data!.payments.find((p) => p.shiftId === s.id && p.typeId === t.id);
                if (!row || row.amount === null) saveOther.mutate({ shiftId: s.id, typeId: t.id, amount: "0" });
              }
            }}
            onOpen={openShift}
          />
        )}
        {saveOther.error ? <Banner tone="danger" title={saveOther.error.message} /> : null}
      </>
    );
  }

  return (
    <>
      <MainHeader title="Sales" subtitle={fmtDate(date, "weekday")} />
      <ScreenBody>{body}</ScreenBody>
    </>
  );
}

/** One row per way of payment: the day's total and the split by shift. "None today" for unused types (D3). */
function ByType({
  shifts,
  types,
  bundle,
  received,
  locked,
  onNoneToday,
  onOpen,
}: {
  shifts: Shift[];
  types: PaymentType[];
  bundle: SalesBundle;
  received: Decimal;
  locked: boolean;
  onNoneToday: (t: PaymentType) => void;
  onOpen: (s: Shift) => void;
}) {
  const { data, setup } = bundle;
  const cashOf = (s: Shift) => {
    const counted = data.counts
      .filter((c) => c.shiftId === s.id)
      .reduce((sum, c) => sum.plus(new Decimal(setup.notes.find((n) => n.id === c.noteId)?.value ?? "0").times(c.count)), new Decimal(0));
    const cash = setup.types.find((t) => t.kind === "CASH");
    const row = data.payments.find((p) => p.shiftId === s.id && p.typeId === cash?.id);
    return row || data.counts.some((c) => c.shiftId === s.id) ? counted.plus(row?.coins ?? "0") : null;
  };
  const amountOf = (t: PaymentType, s: Shift): Decimal | null => {
    if (t.kind === "CASH") return cashOf(s);
    if (t.kind === "CREDIT") {
      const slips = data.slips.filter((x) => x.shiftId === s.id);
      return slips.length ? slips.reduce((sum, x) => sum.plus(x.rupees), new Decimal(0)) : null;
    }
    const row = data.payments.find((p) => p.shiftId === s.id && p.typeId === t.id);
    return row?.amount != null ? new Decimal(row.amount) : null;
  };

  return (
    <View className="gap-8">
      <Card tone="summary">
        <KeyValueRow label="Received so far (after drawer cash and customer payments)" big value={fmtRupees(received)} />
      </Card>
      {types.map((t) => {
        const perShift = shifts.map((s) => ({ s, v: amountOf(t, s) }));
        const total = perShift.reduce((sum, x) => sum.plus(x.v ?? 0), new Decimal(0));
        const empty = perShift.every((x) => x.v === null);
        const slipCount = t.kind === "CREDIT" ? data.slips.length : 0;
        return (
          <Card key={t.id}>
            <View className="flex-row items-center justify-between gap-8">
              <Text variant="heading">{t.name}</Text>
              <Text variant="heading">{fmtRupees(total)}</Text>
            </View>
            <Text variant="label" weight="400" tone="secondary">
              {(t.kind === "CREDIT" ? `${slipCount} slip${slipCount === 1 ? "" : "s"} · ` : "") +
                perShift.map(({ s, v }) => `${s.code} ${v === null ? "—" : fmtRupees(v)}`).join(" · ")}
            </Text>
            {empty && t.kind === "OTHER" && !locked ? (
              <Button label={`None today (₹0 in every shift)`} size="M" variant="ghost" onPress={() => onNoneToday(t)} />
            ) : null}
            {empty && t.kind === "CREDIT" ? <FieldHint>No credit slips yet. Add them from a shift; Done on a shift with none counts as none.</FieldHint> : null}
          </Card>
        );
      })}
      <View className="flex-row flex-wrap gap-8">
        {shifts.map((s) => (
          <Button key={s.id} label={`Open Shift ${s.code}`} size="M" variant="secondary" onPress={() => onOpen(s)} />
        ))}
      </View>
    </View>
  );
}
