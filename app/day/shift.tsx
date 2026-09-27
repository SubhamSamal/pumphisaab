import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Pressable, View, type TextInput } from "react-native";
import {
  Banner,
  BottomSheet,
  Button,
  Card,
  Chip,
  ChipGroup,
  Divider,
  ErrorState,
  FieldError,
  FieldHint,
  KeyValueRow,
  NozzleColumnHeader,
  NozzleGroupHeader,
  NozzleRow,
  NumericInput,
  SaveIndicator,
  ScreenBody,
  ScreenHeader,
  Skeleton,
  StickyActionBar,
  Text,
  ToggleRow,
  useIsWide,
} from "@/components/ui";
import { shiftLitres, type Product } from "@/calc";
import { evaluate, inUseNozzles, lineKey, openingKey, openingOf, shiftHours, shiftInputs, shiftProgress, type TypedClosings } from "@/features/day/model";
import {
  useApproveMeterChange,
  useDay,
  useOwnerSetOpening,
  useDaySetup,
  useDeleteTest,
  useSaveNozzleReading,
  useSaveTest,
  useSetAttendant,
  useShiftData,
  type Day,
  type DaySetup,
  type NozzleLine,
  type SetupNozzle,
  type Shift,
  type ShiftData,
  type Test,
} from "@/features/day/queries";
import { useSaveState } from "@/features/day/saveState";
import { useMembership } from "@/features/session/SessionProvider";
import { useStaff, type StaffMember } from "@/features/setup/queries";
import { track } from "@/lib/analytics";
import { Decimal } from "@/lib/decimal";
import { fmtClock, fmtDate, fmtLitres, fmtMeter, fmtRupees, istDate } from "@/lib/format";
import { readTypedNumber } from "@/lib/numberInput";
import { newId } from "@/lib/uuid";

const FUELS: Product[] = ["HSD", "MS"];

/** Shift meter readings and testing (canvas F5, PRD F5): H1, H2, H8. */
export default function ShiftScreen() {
  const me = useMembership();
  const router = useRouter();
  const wide = useIsWide();
  const { date, code } = useLocalSearchParams<{ date: string; code: string }>();
  const setup = useDaySetup(me.pump.id);
  const day = useDay(me.pump.id, date);
  const data = useShiftData(day.data?.id);
  const staff = useStaff(me.pump.id);
  const save = useSaveState();

  const shift = data.data?.shifts.find((s) => s.code === code);
  const failed = setup.error ?? day.error ?? data.error ?? staff.error;
  const ready = setup.data && day.data && data.data && staff.data && shift;

  return (
    <>
      <ScreenHeader
        title={`Shift ${code} readings`}
        subtitle={shift ? shiftHours(shift) : undefined}
        wide={wide}
        onBack={() => router.back()}
        right={ready ? <SaveIndicator state={save.state} waiting={save.waiting} /> : undefined}
      />
      {failed ? (
        <ScreenBody>
          <ErrorState
            title="Couldn't load the shift"
            body="Check the internet and try again. Nothing you typed is lost."
            onRetry={() => {
              setup.refetch();
              day.refetch();
              data.refetch();
              staff.refetch();
            }}
          />
        </ScreenBody>
      ) : !ready ? (
        <ScreenBody>
          <Skeleton height={120} />
          <Skeleton height={320} />
        </ScreenBody>
      ) : (
        <ShiftForm
          pumpId={me.pump.id}
          isOwner={me.role === "owner"}
          setup={setup.data}
          day={day.data}
          data={data.data}
          shift={shift}
          staff={staff.data}
          onDone={() => router.back()}
        />
      )}
    </>
  );
}

type SheetState = { nozzle: SetupNozzle; line: NozzleLine | undefined } | null;

function ShiftForm({
  pumpId,
  isOwner,
  setup,
  day,
  data,
  shift,
  staff,
  onDone,
}: {
  pumpId: string;
  isOwner: boolean;
  setup: DaySetup;
  day: Day;
  data: ShiftData;
  shift: Shift;
  staff: StaffMember[];
  onDone: () => void;
}) {
  const saveReading = useSaveNozzleReading(pumpId, day.id);
  const setAttendant = useSetAttendant(pumpId, day.id);
  const approve = useApproveMeterChange(day.id);
  const locked = day.isLocked;
  const [openedAt] = useState(() => Date.now());
  const [problem, setProblem] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetState>(null);

  // Closings as typed on screen (saved when the box is left).
  const lineOf = (nozzleId: string) => data.lines.find((l) => l.shiftId === shift.id && l.nozzleId === nozzleId);
  const [closings, setClosings] = useState<Record<string, string>>(() =>
    Object.fromEntries(inUseNozzles(setup).map((n) => [n.id, lineOf(n.id)?.closing ?? ""])),
  );
  // Openings typed here: only where there's no earlier closing to copy (first reading in the app).
  const [openings, setOpenings] = useState<Record<string, string>>(() =>
    Object.fromEntries(inUseNozzles(setup).map((n) => [n.id, lineOf(n.id)?.openingTyped ? (lineOf(n.id)?.opening ?? "") : ""])),
  );
  const typesOpening = (line: NozzleLine | undefined) => !line?.hasPrevious || !line.previousClosing;

  // What the engine sees: valid typed numbers only.
  const typed: TypedClosings = useMemo(() => {
    const out: TypedClosings = {};
    for (const [nozzleId, v] of Object.entries(closings)) {
      const r = readTypedNumber(v, 2);
      out[lineKey(shift.id, nozzleId)] = r.kind === "ok" ? r.value : null;
    }
    for (const [nozzleId, v] of Object.entries(openings)) {
      const line = data.lines.find((l) => l.shiftId === shift.id && l.nozzleId === nozzleId);
      if (!typesOpening(line)) continue;
      const r = readTypedNumber(v, 2);
      out[openingKey(shift.id, nozzleId)] = r.kind === "ok" ? r.value : null;
    }
    return out;
  }, [closings, openings, shift.id, data.lines]);
  const inputs = useMemo(() => shiftInputs(setup, data, typed), [setup, data, typed]);
  const result = useMemo(() => evaluate(setup, day, [], inputs), [setup, day, inputs]);
  const index = data.shifts.findIndex((s) => s.id === shift.id);
  const litres = shiftLitres(inputs[index]);
  const progress = shiftProgress(shift, setup, data, typed);
  const issues = result.hardErrors.filter((e) => e.where?.shift === shift.code);
  const before = index > 0 ? data.shifts[index - 1] : undefined;

  const refs = useRef<Record<string, TextInput | null>>({});
  const order = FUELS.flatMap((f) => inUseNozzles(setup).filter((n) => n.product === f));
  const focusNextEmpty = (after: string) => {
    const start = order.findIndex((n) => n.id === after);
    const next = [...order.slice(start + 1), ...order.slice(0, start)].find((n) => !closings[n.id]);
    if (next) refs.current[next.id]?.focus();
  };

  const saveClosing = (n: SetupNozzle) => {
    const r = readTypedNumber(closings[n.id], 2);
    if (r.kind === "bad") return;
    const line = lineOf(n.id);
    const value = r.kind === "ok" ? r.value : null;
    const saved = line?.closing ?? null;
    if (value === saved || (value && saved && new Decimal(value).equals(new Decimal(saved)))) return;
    if (issues.some((i) => i.code === "H1" && i.where?.nozzleId === n.id)) {
      track("hard_error_shown", { rule_code: "H1", section: `shift${shift.code}` });
      return; // the database would refuse it too
    }
    setProblem(null);
    saveReading.mutate(
      { shiftId: shift.id, nozzleId: n.id, closing: value },
      {
        onSuccess: () => track("field_autosaved", { section: `shift${shift.code}` }),
        onError: (e) => {
          track("draft_save_failed", { section: `shift${shift.code}` });
          setProblem(e.message);
        },
      },
    );
  };

  // First reading in the app: the typed opening is saved when its box is left.
  const saveOpening = (n: SetupNozzle) => {
    const r = readTypedNumber(openings[n.id], 2);
    if (r.kind === "bad") return;
    const line = lineOf(n.id);
    const value = r.kind === "ok" ? r.value : null;
    const saved = line?.openingTyped ? (line.opening ?? null) : null;
    if (value === saved || (value && saved && new Decimal(value).equals(new Decimal(saved)))) return;
    setProblem(null);
    saveReading.mutate(
      { shiftId: shift.id, nozzleId: n.id, opening: value, openingTyped: value !== null },
      { onSuccess: () => track("field_autosaved", { section: `shift${shift.code}` }), onError: (e) => setProblem(e.message) },
    );
  };

  const people = data.attendants.filter((a) => a.shiftId === shift.id);
  const staffShown = staff.filter((s) => s.isActive || people.some((p) => p.staffId === s.id));
  const priceOf = (f: Product) => (day.priceConfirmed ? day.confirmed[f] : undefined);

  const finish = () => {
    if (progress.done) track("section_completed", { section: `shift${shift.code}`, duration_sec: Math.round((Date.now() - openedAt) / 1000) });
    onDone();
  };

  return (
    <>
      <ScreenBody
        sticky={
          <StickyActionBar
            note={
              progress.done ? undefined : (
                <Text variant="label" tone="secondary" className="text-center">
                  {progress.typedCount < progress.total
                    ? `Type ${progress.total - progress.typedCount} more closing reading${progress.total - progress.typedCount === 1 ? "" : "s"}`
                    : "Tick who worked this shift"}
                </Text>
              )
            }
          >
            <Button label={progress.done ? "Done" : "Back to Today"} variant={progress.done ? "primary" : "secondary"} onPress={finish} />
          </StickyActionBar>
        }
      >
        {locked ? <Banner tone="info" icon="lock" title="This day is locked" /> : null}
        {istDate(shift.endsAt) !== day.businessDate ? (
          <Banner tone="info" icon="clock">
            {`Counts in ${fmtDate(day.businessDate, "short")}'s day. Ends at ${fmtClock(shift.endsAt)} on ${fmtDate(istDate(shift.endsAt), "short")}.`}
          </Banner>
        ) : null}
        {problem ? <Banner tone="danger" title={problem} /> : null}

        <View className="gap-8">
          <Text variant="label" tone="secondary">
            Who worked this shift
          </Text>
          {staffShown.length === 0 ? (
            <FieldHint>No staff yet. Add the attendants in Profile › Staff.</FieldHint>
          ) : (
            <ChipGroup>
              {staffShown.map((s) => {
                const ticked = people.find((p) => p.staffId === s.id);
                return (
                  <Chip
                    key={s.id}
                    label={s.name}
                    selected={Boolean(ticked)}
                    onPress={
                      locked
                        ? undefined
                        : () =>
                            setAttendant.mutate(
                              { shiftId: shift.id, staffId: s.id, on: !ticked, attendantId: ticked?.id },
                              { onError: (e) => setProblem(e.message) },
                            )
                    }
                  />
                );
              })}
            </ChipGroup>
          )}
        </View>

        {FUELS.map((fuel) => {
          const nozzles = inUseNozzles(setup).filter((n) => n.product === fuel);
          if (nozzles.length === 0) return null;
          const price = priceOf(fuel);
          return (
            <View key={fuel} className="gap-8">
              <NozzleGroupHeader product={fuel} detail={price ? `· ${fmtRupees(price, "input")}/L` : undefined} />
              <NozzleColumnHeader />
              <View>
                {nozzles.map((n) => {
                  const line = lineOf(n.id);
                  const typeOpening = typesOpening(line);
                  const o = readTypedNumber(openings[n.id], 2);
                  const opening = typeOpening ? (o.kind === "ok" ? o.value : null) : openingOf(line);
                  const r = readTypedNumber(closings[n.id], 2);
                  const h1 = issues.find((i) => i.code === "H1" && i.where?.nozzleId === n.id);
                  const sale = opening && r.kind === "ok" && !h1 ? new Decimal(r.value).minus(opening) : null;
                  const pending = line?.meterChange === "PENDING";
                  return (
                    <NozzleRow
                      key={n.id}
                      label={n.label}
                      opening={opening ? fmtMeter(opening) : undefined}
                      openingInput={
                        typeOpening
                          ? {
                              value: openings[n.id],
                              onChange: (t) => setOpenings((c) => ({ ...c, [n.id]: t })),
                              onBlur: () => saveOpening(n),
                              editable: !locked,
                            }
                          : undefined
                      }
                      closing={closings[n.id]}
                      onChangeClosing={(t) => setClosings((c) => ({ ...c, [n.id]: t }))}
                      onBlur={() => saveClosing(n)}
                      sale={sale ? fmtMeter(sale) : undefined}
                      error={o.kind === "bad" ? o.message : r.kind === "bad" ? r.message : h1 ? "Less than the opening. Check the meter." : undefined}
                      openingState={pending ? "pending" : line?.meterChange === "APPROVED" && line.openingTyped ? "approved" : "copied"}
                      note={
                        pending
                          ? isOwner
                            ? `New opening waits for your approval (last closing ${fmtMeter(line?.previousClosing ?? "0")}).`
                            : "New opening waits for the owner. Keep working."
                          : line?.meterChange === "APPROVED" && line.openingTyped
                            ? `Meter change approved (last closing ${fmtMeter(line.previousClosing ?? "0")}).`
                            : typeOpening && line?.hasPrevious && !openings[n.id]
                              ? `${before ? `Shift ${before.code}` : "Last night's shift"} has no closing yet. Type the opening from the meter.`
                              : undefined
                      }
                      noteTone={line?.meterChange === "APPROVED" && line.openingTyped && !pending ? "success" : "warning"}
                      noteAction={
                        pending && isOwner && line?.readingId && !locked
                          ? {
                              label: "Approve",
                              loading: approve.isPending,
                              onPress: () =>
                                approve.mutate(line.readingId as string, {
                                  onSuccess: () => track("meter_change_approved", { shift: shift.code }),
                                  onError: (e) => setProblem(e.message),
                                }),
                            }
                          : undefined
                      }
                      editable={!locked}
                      onPressOpening={locked || typeOpening ? undefined : () => setSheet({ nozzle: n, line })}
                      inputRef={(el) => {
                        refs.current[n.id] = el;
                      }}
                      onSubmitEditing={() => focusNextEmpty(n.id)}
                    />
                  );
                })}
              </View>
            </View>
          );
        })}

        <TestingCard pumpId={pumpId} setup={setup} day={day} shift={shift} tests={data.tests.filter((t) => t.shiftId === shift.id)} issues={issues} locked={locked} />

        {progress.typedCount === progress.total && progress.total > 0 ? (
          <Card tone="summary">
            <Text variant="heading">{`Shift ${shift.code} meter sale`}</Text>
            {FUELS.filter((f) => inUseNozzles(setup).some((n) => n.product === f)).map((f) => {
              const sold = litres.soldAsPerMeters[f];
              const price = priceOf(f);
              const tested = litres.testLitres[f];
              return (
                <KeyValueRow
                  key={f}
                  label={`${f} · ${fmtLitres(sold)}${price ? ` × ${fmtRupees(price, "input")}` : ""}${tested.isZero() ? "" : ` (after ${fmtLitres(tested)} testing)`}`}
                  value={price ? fmtRupees(sold.times(price)) : fmtLitres(sold)}
                />
              );
            })}
            <Divider />
            {day.priceConfirmed ? (
              <KeyValueRow
                label="Should have"
                big
                value={fmtRupees(
                  FUELS.reduce((sum, f) => (priceOf(f) ? sum.plus(litres.soldAsPerMeters[f].times(priceOf(f) as string)) : sum), new Decimal(0)),
                )}
              />
            ) : (
              <FieldHint>Confirm today&apos;s price on Today to see rupees.</FieldHint>
            )}
          </Card>
        ) : null}
      </ScreenBody>

      <OpeningSheet
        pumpId={pumpId}
        dayId={day.id}
        shift={shift}
        before={before}
        state={sheet}
        isOwner={isOwner}
        onClose={() => setSheet(null)}
      />
    </>
  );
}

/** Tap on a locked opening: meter change (H2, no reason asked), the very first opening, or the owner's approval. */
function OpeningSheet({
  pumpId,
  dayId,
  shift,
  before,
  state,
  isOwner,
  onClose,
}: {
  pumpId: string;
  dayId: string;
  shift: Shift;
  before?: Shift;
  state: SheetState;
  isOwner: boolean;
  onClose: () => void;
}) {
  const saveReading = useSaveNozzleReading(pumpId, dayId);
  const ownerSave = useOwnerSetOpening(pumpId, dayId);
  const approve = useApproveMeterChange(dayId);
  const [value, setValue] = useState("");
  const [last, setLast] = useState<SheetState>(null);
  if (state !== last) {
    setLast(state);
    setValue(state?.line?.openingTyped && state.line.opening ? state.line.opening : "");
  }
  const close = () => {
    saveReading.reset();
    ownerSave.reset();
    approve.reset();
    onClose();
  };
  if (!state) return <BottomSheet visible={false} onClose={close}>{null}</BottomSheet>;

  const { nozzle, line } = state;
  // Opened only from a copied (locked) opening, so the previous closing is known.
  const previous = line?.previousClosing ?? "";
  const earlier = before ? `Shift ${before.code}` : "Last night's shift";
  const r = readTypedNumber(value, 2);
  const pending = line?.meterChange === "PENDING";
  const problem = (saveReading.error ?? ownerSave.error ?? approve.error)?.message;
  const approved = line?.meterChange === "APPROVED" && line.openingTyped;

  const send = () => {
    if (r.kind !== "ok") return;
    if (isOwner) {
      // The owner's own change needs no approval round-trip: saved and approved together.
      ownerSave.mutate(
        { shiftId: shift.id, nozzleId: nozzle.id, opening: r.value },
        { onSuccess: () => (track("meter_change_approved", { shift: shift.code, by: "owner" }), close()) },
      );
      return;
    }
    saveReading.mutate(
      { shiftId: shift.id, nozzleId: nozzle.id, opening: r.value, openingTyped: true },
      {
        onSuccess: () => {
          if (!new Decimal(r.value).equals(previous)) track("meter_change_requested", { shift: shift.code });
          close();
        },
      },
    );
  };
  const keep = () =>
    saveReading.mutate({ shiftId: shift.id, nozzleId: nozzle.id, openingTyped: false }, { onSuccess: close });

  return (
    <BottomSheet visible onClose={close}>
      <Text variant="heading">{pending ? `Approve ${nozzle.label} opening?` : approved ? `${nozzle.label} opening (approved)` : `Change ${nozzle.label} opening?`}</Text>
      <KeyValueRow label={`${earlier} closed at`} value={fmtMeter(previous)} />
      <NumericInput label="New opening" value={value} onChangeText={setValue} error={r.kind === "bad" ? r.message : undefined} />
      <Text variant="body" tone="secondary">
        {isOwner
          ? "Only if the meter was replaced or repaired. Your change is approved straight away."
          : "Only if the meter was replaced or repaired. The owner approves it; keep working meanwhile."}
      </Text>
      {problem ? <Banner tone="danger" title={problem} /> : null}
      {isOwner && pending && line?.readingId ? (
        <Button
          label="Approve new opening"
          icon="check"
          loading={approve.isPending}
          onPress={() => approve.mutate(line.readingId as string, { onSuccess: () => (track("meter_change_approved", { shift: shift.code }), close()) })}
        />
      ) : null}
      <Button
        label={isOwner ? (pending ? "Save a different opening" : "Save new opening") : "Send to owner"}
        variant={isOwner && pending ? "secondary" : "primary"}
        loading={saveReading.isPending || ownerSave.isPending}
        disabled={r.kind !== "ok" || (pending && isOwner && r.kind === "ok" && line?.opening != null && new Decimal(r.value).equals(line.opening))}
        onPress={send}
      />
      {previous ? <Button label={`Keep ${fmtMeter(previous)}`} variant="ghost" onPress={keep} /> : null}
    </BottomSheet>
  );
}

/** Testing: nozzle + litres, taken off the sale because the fuel goes back into the tank. */
function TestingCard({
  pumpId,
  setup,
  day,
  shift,
  tests,
  issues,
  locked,
}: {
  pumpId: string;
  setup: DaySetup;
  day: Day;
  shift: Shift;
  tests: Test[];
  issues: { code: string; message: string; where?: { nozzleId?: string } }[];
  locked: boolean;
}) {
  const saveTest = useSaveTest(pumpId, day.id);
  const deleteTest = useDeleteTest(day.id);
  const nozzles = inUseNozzles(setup);
  const [litres, setLitres] = useState<Record<string, string>>({});
  const defaultLitres = setup.rules.testing.defaultLitres;
  const problem = (saveTest.error ?? deleteTest.error)?.message;

  const add = () => {
    const nozzleId = nozzles.find((n) => !tests.some((t) => t.nozzleId === n.id))?.id ?? nozzles[0]?.id;
    if (nozzleId) saveTest.mutate({ id: newId(), shiftId: shift.id, nozzleId, litres: defaultLitres });
  };
  const toggle = (on: boolean) => {
    if (on) add();
    else tests.forEach((t) => deleteTest.mutate(t.id));
  };

  return (
    <Card>
      <ToggleRow label="Testing done this shift?" helper="5 L measure check" value={tests.length > 0} onChange={locked ? () => {} : toggle} />
      {tests.map((t) => {
        const typed = litres[t.id] ?? t.litres;
        const r = readTypedNumber(typed, 2);
        const h8 = issues.find((i) => i.code === "H8" && i.where?.nozzleId === t.nozzleId);
        const saveLitres = () => {
          if (r.kind !== "ok" || new Decimal(r.value).isZero() || new Decimal(r.value).equals(t.litres)) return;
          saveTest.mutate({ id: t.id, shiftId: shift.id, nozzleId: t.nozzleId, litres: r.value });
        };
        return (
          <View key={t.id} className="gap-8 border-t border-border pt-12">
            <Text variant="label" tone="secondary">
              Nozzle
            </Text>
            <ChipGroup>
              {nozzles.map((n) => (
                <Chip
                  key={n.id}
                  small
                  label={n.label}
                  selected={t.nozzleId === n.id}
                  onPress={locked || t.nozzleId === n.id ? undefined : () => saveTest.mutate({ id: t.id, shiftId: shift.id, nozzleId: n.id, litres: t.litres })}
                />
              ))}
            </ChipGroup>
            <NumericInput
              label="Litres tested"
              value={typed}
              onChangeText={(v) => setLitres((c) => ({ ...c, [t.id]: v }))}
              onBlur={saveLitres}
              unit="L"
              disabled={locked}
              error={r.kind === "bad" ? r.message : r.kind === "empty" || (r.kind === "ok" && new Decimal(r.value).isZero()) ? "Type the litres tested." : undefined}
            />
            {h8 ? <FieldError message={h8.message} /> : null}
            {!locked ? (
              <Pressable onPress={() => deleteTest.mutate(t.id)} accessibilityRole="button" className="self-start py-8">
                <Text variant="body" weight="600" tone="danger">
                  Remove this test
                </Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
      {tests.length > 0 && !locked ? <Button label="Add another nozzle" icon="plus" size="M" variant="ghost" onPress={add} /> : null}
      {tests.length > 0 ? (
        <Text variant="label" weight="400" tone="muted">
          Tested fuel is taken off the sale, so it isn&apos;t counted as money due. Pour it back into the tank.
        </Text>
      ) : null}
      {problem ? <Banner tone="danger" title={problem} /> : null}
    </Card>
  );
}
